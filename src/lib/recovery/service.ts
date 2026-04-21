import { db } from "@/lib/db";
import type {
  Prisma,
  RecoveryPlan,
  RecoveryPlanStatus,
  RecoveryAuditAction,
  RecoveryFailurePolicy,
} from "@prisma/client";
import {
  assertTransition,
  isActive,
  isTerminal,
  RecoveryTransitionError,
} from "./status";
import {
  buildRequiredPeriods,
  evaluatePayment,
  resolvePaymentPeriod,
} from "./on-time";

/**
 * Recovery plan service. All plan mutations go through this module so the
 * state machine + audit logging stay consistent.
 *
 * Every public function here is transactional where cross-table writes
 * matter (plan status + payment log + audit log + ledger must land
 * together-or-not-at-all).
 */

// ────────────────────────────────────────────────────────────────
// Audit helper — centralises the audit-log write so we never forget
// ────────────────────────────────────────────────────────────────

async function writeAudit(
  tx: Prisma.TransactionClient,
  recoveryPlanId: string,
  action: RecoveryAuditAction,
  actorId: string | null,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await tx.recoveryAuditLog.create({
    data: {
      recoveryPlanId,
      action,
      actorId,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}

// ────────────────────────────────────────────────────────────────
// Plan creation
// ────────────────────────────────────────────────────────────────

export interface CreateRecoveryPlanInput {
  tenantId: string; // TenantProfile.id
  landlordId: string; // Auth scope (PM for the tenant's unit)
  originalBalance: number;
  forgivenessAmount: number;
  requiredPayments: number;
  startDate: Date;
  graceDays?: number;
  failurePolicy?: RecoveryFailurePolicy;
  notes?: string;
  createdById: string;
  /** If true, plan activates immediately. Otherwise stays PLAN_OFFERED. */
  activateImmediately?: boolean;
}

export class RecoveryValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = "RecoveryValidationError";
  }
}

/**
 * Create a new recovery plan for a delinquent tenant.
 *
 * Validates:
 *  - tenant belongs to the PM (via unit → property → landlordId)
 *  - forgivenessAmount ≤ originalBalance
 *  - requiredPayments in [1, 12]
 *  - no other ACTIVE / AT_RISK / OFFERED plan already exists for this tenant
 *
 * Snapshots the required periods based on the tenant's unit dueDay so
 * the deal terms can't drift if the unit's rent schedule changes later.
 */
export async function createRecoveryPlan(
  input: CreateRecoveryPlanInput
): Promise<RecoveryPlan> {
  const {
    tenantId,
    landlordId,
    originalBalance,
    forgivenessAmount,
    requiredPayments,
    startDate,
    graceDays = 0,
    failurePolicy = "FAIL",
    notes,
    createdById,
    activateImmediately = false,
  } = input;

  if (forgivenessAmount < 0)
    throw new RecoveryValidationError("forgivenessAmount must be ≥ 0", "forgivenessAmount");
  if (forgivenessAmount > originalBalance)
    throw new RecoveryValidationError(
      "forgivenessAmount cannot exceed originalBalance",
      "forgivenessAmount"
    );
  if (requiredPayments < 1 || requiredPayments > 12)
    throw new RecoveryValidationError(
      "requiredPayments must be between 1 and 12",
      "requiredPayments"
    );
  if (graceDays < 0 || graceDays > 30)
    throw new RecoveryValidationError(
      "graceDays must be between 0 and 30",
      "graceDays"
    );

  const tenant = await db.tenantProfile.findUnique({
    where: { id: tenantId },
    include: {
      unit: {
        select: {
          id: true,
          dueDay: true,
          property: { select: { id: true, landlordId: true } },
        },
      },
    },
  });
  if (!tenant) throw new RecoveryValidationError("Tenant not found", "tenantId");
  if (!tenant.unit) throw new RecoveryValidationError("Tenant has no unit assignment", "tenantId");
  if (tenant.unit.property.landlordId !== landlordId) {
    throw new RecoveryValidationError(
      "Tenant does not belong to this PM",
      "tenantId"
    );
  }

  const existing = await db.recoveryPlan.findFirst({
    where: {
      tenantId,
      status: { in: ["PLAN_OFFERED", "PLAN_ACTIVE", "PLAN_AT_RISK"] },
    },
  });
  if (existing) {
    throw new RecoveryValidationError(
      `Tenant already has an open recovery plan (${existing.id}, status=${existing.status})`,
      "tenantId"
    );
  }

  const periods = buildRequiredPeriods(
    startDate,
    requiredPayments,
    tenant.unit.dueDay,
    graceDays
  );
  const endDate = periods[periods.length - 1].graceEnd;
  const requiredPeriodKeys = periods.map((p) => p.periodKey);

  const initialStatus: RecoveryPlanStatus = activateImmediately
    ? "PLAN_ACTIVE"
    : "PLAN_OFFERED";

  const plan = await db.$transaction(async (tx) => {
    const created = await tx.recoveryPlan.create({
      data: {
        tenantId,
        propertyId: tenant.unit!.property.id,
        unitId: tenant.unit!.id,
        landlordId,
        originalBalance,
        forgivenessAmount,
        requiredPayments,
        status: initialStatus,
        startDate,
        endDate,
        graceDays,
        failurePolicy,
        requiredPeriodKeys,
        notes: notes || null,
        createdById,
      },
    });

    await writeAudit(tx, created.id, "CREATED", createdById, {
      originalBalance,
      forgivenessAmount,
      requiredPayments,
      graceDays,
      failurePolicy,
      requiredPeriodKeys,
    });
    if (activateImmediately) {
      await writeAudit(tx, created.id, "ACTIVATED", createdById, {
        fromStatus: "PLAN_OFFERED",
        toStatus: "PLAN_ACTIVE",
      });
    } else {
      await writeAudit(tx, created.id, "OFFERED", createdById, {});
    }

    return created;
  });

  return plan;
}

// ────────────────────────────────────────────────────────────────
// Plan activation (PLAN_OFFERED → PLAN_ACTIVE)
// ────────────────────────────────────────────────────────────────

export async function activatePlan(
  planId: string,
  actorId: string
): Promise<RecoveryPlan> {
  return db.$transaction(async (tx) => {
    const plan = await tx.recoveryPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new RecoveryValidationError("Plan not found");
    assertTransition(plan.status, "PLAN_ACTIVE");

    const updated = await tx.recoveryPlan.update({
      where: { id: planId },
      data: { status: "PLAN_ACTIVE" },
    });
    await writeAudit(tx, planId, "ACTIVATED", actorId, {
      fromStatus: plan.status,
      toStatus: "PLAN_ACTIVE",
    });
    return updated;
  });
}

// ────────────────────────────────────────────────────────────────
// Plan cancellation (only from PLAN_OFFERED)
// ────────────────────────────────────────────────────────────────

export async function cancelPlan(
  planId: string,
  actorId: string,
  reason: string
): Promise<RecoveryPlan> {
  return db.$transaction(async (tx) => {
    const plan = await tx.recoveryPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new RecoveryValidationError("Plan not found");
    assertTransition(plan.status, "PLAN_CANCELLED");

    const updated = await tx.recoveryPlan.update({
      where: { id: planId },
      data: {
        status: "PLAN_CANCELLED",
        cancelledAt: new Date(),
        cancelledReason: reason,
      },
    });
    await writeAudit(tx, planId, "CANCELLED", actorId, {
      fromStatus: plan.status,
      toStatus: "PLAN_CANCELLED",
      reason,
    });
    return updated;
  });
}

// ────────────────────────────────────────────────────────────────
// Apply a completed payment to a plan
// ────────────────────────────────────────────────────────────────

/**
 * Given a COMPLETED payment, check whether it credits an active recovery
 * plan. Idempotent — calling this multiple times with the same paymentId
 * produces the same terminal state (either one RecoveryPaymentLog row or
 * a no-op).
 *
 * Returns `null` if the payment doesn't match any open plan; otherwise
 * returns the updated plan + the log row that was created.
 *
 * This is the core of the "payment hook" the user spec calls for. It is
 * safe to invoke:
 *   (a) From inside /api/payments/charge right after a status flips to
 *       COMPLETED (optional future wiring).
 *   (b) From the reconciliation endpoint below, which sweeps batches.
 *   (c) Manually from admin tooling after a back-dated payment entry.
 */
export async function applyPaymentToRecovery(paymentId: string): Promise<{
  plan: RecoveryPlan;
  log: { id: string; periodKey: string; wasOnTime: boolean };
} | null> {
  return db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        tenantId: true,
        type: true,
        status: true,
        amount: true,
        paidAt: true,
        dueDate: true,
      },
    });
    if (!payment) return null;
    if (payment.status !== "COMPLETED") return null;
    if (!payment.paidAt) return null;

    const plan = await tx.recoveryPlan.findFirst({
      where: {
        tenantId: payment.tenantId,
        status: { in: ["PLAN_ACTIVE", "PLAN_AT_RISK"] },
      },
    });
    if (!plan) return null;

    const periodKey = resolvePaymentPeriod(
      { dueDate: payment.dueDate, paidAt: payment.paidAt, type: payment.type },
      plan.requiredPeriodKeys
    );
    if (!periodKey) return null;

    // Idempotency check.
    const existing = await tx.recoveryPaymentLog.findUnique({
      where: {
        recoveryPlanId_paymentId: {
          recoveryPlanId: plan.id,
          paymentId: payment.id,
        },
      },
    });
    if (existing) {
      return {
        plan,
        log: {
          id: existing.id,
          periodKey: existing.periodKey,
          wasOnTime: existing.wasOnTime,
        },
      };
    }

    const periods = buildRequiredPeriods(
      plan.startDate,
      plan.requiredPayments,
      new Date(plan.startDate).getUTCDate() === 1
        ? 1
        : new Date(plan.startDate).getUTCDate(),
      plan.graceDays
    );
    const window = periods.find((p) => p.periodKey === periodKey)!;
    const evalResult = evaluatePayment(payment.paidAt, window);

    // If there's already a MISSED log for this period (shouldn't happen
    // because of the unique(planId, periodKey) constraint, but guard):
    // the unique constraint will error — caller should retry via a later
    // reconciliation pass after clearing the stale MISSED entry.

    const log = await tx.recoveryPaymentLog.create({
      data: {
        recoveryPlanId: plan.id,
        paymentId: payment.id,
        periodKey,
        amount: payment.amount,
        wasOnTime: evalResult.wasOnTime,
        status: evalResult.wasOnTime ? "COUNTED" : "MISSED",
      },
    });

    // Advance plan state based on whether this was on-time.
    let nextStatus: RecoveryPlanStatus = plan.status;
    let nextCompletedPayments = plan.completedPayments;

    if (evalResult.wasOnTime) {
      nextCompletedPayments = plan.completedPayments + 1;
      await writeAudit(tx, plan.id, "PAYMENT_COUNTED", null, {
        paymentId: payment.id,
        periodKey,
        amount: payment.amount,
        daysLate: evalResult.daysLate,
      });

      if (nextCompletedPayments >= plan.requiredPayments) {
        nextStatus = "PLAN_COMPLETED";
        await writeAudit(tx, plan.id, "COMPLETED", null, {
          fromStatus: plan.status,
          toStatus: "PLAN_COMPLETED",
          totalPayments: nextCompletedPayments,
        });
      } else if (plan.status === "PLAN_AT_RISK") {
        // Late-but-in-grace payment landed — pull back to ACTIVE.
        nextStatus = "PLAN_ACTIVE";
      }
    } else {
      // Payment was past grace — that's a failure. Apply failurePolicy.
      await writeAudit(tx, plan.id, "PAYMENT_MISSED", null, {
        paymentId: payment.id,
        periodKey,
        daysLate: evalResult.daysLate,
        failurePolicy: plan.failurePolicy,
      });

      if (plan.failurePolicy === "FAIL") {
        nextStatus = "PLAN_FAILED";
      } else {
        // RESET: keep active, zero progress.
        nextCompletedPayments = 0;
        nextStatus =
          plan.status === "PLAN_AT_RISK" ? "PLAN_ACTIVE" : plan.status;
      }
    }

    if (nextStatus !== plan.status) {
      assertTransition(plan.status, nextStatus);
    }

    const updates: Prisma.RecoveryPlanUpdateInput = {
      completedPayments: nextCompletedPayments,
    };
    if (nextStatus !== plan.status) {
      updates.status = nextStatus;
      if (nextStatus === "PLAN_FAILED") {
        updates.failedAt = new Date();
        updates.failedReason = `Missed period ${periodKey} past grace`;
        await writeAudit(tx, plan.id, "FAILED", null, {
          fromStatus: plan.status,
          toStatus: "PLAN_FAILED",
          periodKey,
        });
      }
      if (nextStatus === "PLAN_COMPLETED") {
        updates.completedAt = new Date();
      }
    }

    const updated = await tx.recoveryPlan.update({
      where: { id: plan.id },
      data: updates,
    });

    // If we've just completed, apply forgiveness in the SAME transaction
    // so the state + ledger are inseparable.
    if (nextStatus === "PLAN_COMPLETED") {
      await applyForgivenessInTx(tx, updated);
    }

    return {
      plan: updated,
      log: { id: log.id, periodKey, wasOnTime: evalResult.wasOnTime },
    };
  });
}

// ────────────────────────────────────────────────────────────────
// Forgiveness → ledger entry
// ────────────────────────────────────────────────────────────────

/**
 * Apply the forgiveness credit to the tenant's ledger. This creates a
 * negative-amount LedgerEntry of type RECOVERY_FORGIVENESS and stamps
 * the plan with the resulting entry id + timestamp.
 *
 * Called inline from `applyPaymentToRecovery` when the plan transitions
 * to COMPLETED; exported so admin tooling can re-apply if a prior run
 * partially failed (the plan is idempotent — we only create if not yet
 * applied).
 *
 * NOTE: this is the only place the forgiveness credit is written. It
 * does NOT modify the original charge entries; the overdue balance
 * history stays intact, and this credit shows up as a clean negative
 * line item on the tenant ledger.
 */
async function applyForgivenessInTx(
  tx: Prisma.TransactionClient,
  plan: RecoveryPlan
): Promise<void> {
  if (plan.forgivenessLedgerEntryId) return; // already applied
  if (Number(plan.forgivenessAmount) <= 0) return; // nothing to credit

  // Look up last balance to write a correct balanceAfter.
  const last = await tx.ledgerEntry.findFirst({
    where: { tenantId: plan.tenantId },
    orderBy: { createdAt: "desc" },
    select: { balanceAfter: true },
  });
  const previousBalance = last ? Number(last.balanceAfter) : 0;
  const forgiveness = Number(plan.forgivenessAmount);
  const newBalance = previousBalance - forgiveness;

  // periodKey: the month forgiveness is applied (today). LedgerEntry's
  // unique([tenantId, periodKey, type, paymentId]) — type/paymentId both
  // differ from anything prior so this won't conflict.
  const now = new Date();
  const periodKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const entry = await tx.ledgerEntry.create({
    data: {
      tenantId: plan.tenantId,
      unitId: plan.unitId!,
      type: "RECOVERY_FORGIVENESS",
      amount: -forgiveness, // negative — credit reduces balance owed
      balanceAfter: newBalance,
      periodKey,
      description: `Recovery plan forgiveness — $${forgiveness.toFixed(2)} credited after ${plan.requiredPayments} consecutive on-time payments`,
      metadata: { recoveryPlanId: plan.id },
    },
  });

  await tx.recoveryPlan.update({
    where: { id: plan.id },
    data: {
      forgivenessLedgerEntryId: entry.id,
      forgivenessAppliedAt: now,
    },
  });

  await writeAudit(tx, plan.id, "FORGIVENESS_APPLIED", null, {
    ledgerEntryId: entry.id,
    amount: forgiveness,
    previousBalance,
    newBalance,
  });
}

// ────────────────────────────────────────────────────────────────
// Lookup helpers
// ────────────────────────────────────────────────────────────────

export async function getActivePlanForTenant(tenantId: string) {
  return db.recoveryPlan.findFirst({
    where: {
      tenantId,
      status: { in: ["PLAN_OFFERED", "PLAN_ACTIVE", "PLAN_AT_RISK"] },
    },
    include: {
      paymentLogs: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function getPlanById(planId: string) {
  return db.recoveryPlan.findUnique({
    where: { id: planId },
    include: {
      paymentLogs: { orderBy: { createdAt: "asc" } },
      auditLogs: { orderBy: { createdAt: "desc" } },
      tenant: { select: { id: true, userId: true, user: { select: { name: true, email: true, phone: true } } } },
      unit: { select: { id: true, unitNumber: true } },
      property: { select: { id: true, name: true } },
    },
  });
}

// ────────────────────────────────────────────────────────────────
// Admin / PM manual override
// ────────────────────────────────────────────────────────────────

export interface ManualUpdateInput {
  actorId: string;
  note: string;
  overrides?: {
    status?: RecoveryPlanStatus;
    completedPayments?: number;
    forgivenessAmount?: number;
    notes?: string;
  };
}

/**
 * Privileged manual override — lets an admin nudge a plan out of a
 * stuck state, adjust forgiveness terms, or correct the completed-
 * payment count after a back-dated cash payment. EVERY change is
 * audit-logged with the actor and the before/after snapshot so the
 * override is reversible by a human reader of the audit log.
 *
 * Status transitions still go through `assertTransition` — admins can't
 * invent illegal transitions (e.g. un-fail a failed plan) without
 * cancelling and creating a fresh one.
 */
export async function manualUpdatePlan(
  planId: string,
  input: ManualUpdateInput
): Promise<RecoveryPlan> {
  const { actorId, note, overrides = {} } = input;
  if (!note || !note.trim())
    throw new RecoveryValidationError("An explanatory note is required for manual overrides");

  return db.$transaction(async (tx) => {
    const plan = await tx.recoveryPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new RecoveryValidationError("Plan not found");

    const data: Prisma.RecoveryPlanUpdateInput = {};
    const diff: Record<string, { from: unknown; to: unknown }> = {};

    if (
      overrides.status !== undefined &&
      overrides.status !== plan.status
    ) {
      assertTransition(plan.status, overrides.status);
      data.status = overrides.status;
      diff.status = { from: plan.status, to: overrides.status };
    }
    if (
      overrides.completedPayments !== undefined &&
      overrides.completedPayments !== plan.completedPayments
    ) {
      if (
        overrides.completedPayments < 0 ||
        overrides.completedPayments > plan.requiredPayments
      ) {
        throw new RecoveryValidationError(
          "completedPayments must be between 0 and requiredPayments",
          "completedPayments"
        );
      }
      data.completedPayments = overrides.completedPayments;
      diff.completedPayments = {
        from: plan.completedPayments,
        to: overrides.completedPayments,
      };
    }
    if (
      overrides.forgivenessAmount !== undefined &&
      Number(overrides.forgivenessAmount) !== Number(plan.forgivenessAmount)
    ) {
      if (overrides.forgivenessAmount < 0)
        throw new RecoveryValidationError(
          "forgivenessAmount must be ≥ 0",
          "forgivenessAmount"
        );
      if (overrides.forgivenessAmount > Number(plan.originalBalance))
        throw new RecoveryValidationError(
          "forgivenessAmount cannot exceed originalBalance",
          "forgivenessAmount"
        );
      if (plan.forgivenessLedgerEntryId) {
        throw new RecoveryValidationError(
          "Cannot change forgivenessAmount after it has been applied to the ledger"
        );
      }
      data.forgivenessAmount = overrides.forgivenessAmount;
      diff.forgivenessAmount = {
        from: Number(plan.forgivenessAmount),
        to: overrides.forgivenessAmount,
      };
    }
    if (overrides.notes !== undefined && overrides.notes !== plan.notes) {
      data.notes = overrides.notes;
      diff.notes = { from: plan.notes, to: overrides.notes };
    }

    const updated = Object.keys(data).length
      ? await tx.recoveryPlan.update({ where: { id: planId }, data })
      : plan;

    await writeAudit(tx, planId, "MANUAL_OVERRIDE", actorId, {
      note,
      diff,
    });

    return updated;
  });
}

// ────────────────────────────────────────────────────────────────
// Reconciliation — sweep recently-completed payments into plans
// ────────────────────────────────────────────────────────────────

/**
 * Batch-apply all unprocessed COMPLETED payments to their matching plans.
 *
 * Scope: payments landed in the last `sinceHours` hours that don't yet
 * have a corresponding RecoveryPaymentLog row for any active plan. Used
 * by the /api/cron/recovery-reconcile endpoint on a schedule, and safe
 * to invoke manually from admin tooling.
 *
 * Returns { scanned, applied, errors } for observability.
 */
export async function reconcileRecentPayments(sinceHours = 48): Promise<{
  scanned: number;
  applied: number;
  errors: Array<{ paymentId: string; error: string }>;
}> {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

  // Only tenants with active plans are candidates.
  const activeTenantIds = await db.recoveryPlan
    .findMany({
      where: { status: { in: ["PLAN_ACTIVE", "PLAN_AT_RISK"] } },
      select: { tenantId: true },
    })
    .then((rows) => [...new Set(rows.map((r) => r.tenantId))]);

  if (activeTenantIds.length === 0) {
    return { scanned: 0, applied: 0, errors: [] };
  }

  const candidates = await db.payment.findMany({
    where: {
      tenantId: { in: activeTenantIds },
      status: "COMPLETED",
      paidAt: { gte: since },
      type: "RENT",
    },
    select: { id: true },
  });

  const errors: Array<{ paymentId: string; error: string }> = [];
  let applied = 0;
  for (const { id } of candidates) {
    try {
      const result = await applyPaymentToRecovery(id);
      if (result) applied += 1;
    } catch (err) {
      const msg =
        err instanceof RecoveryTransitionError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      errors.push({ paymentId: id, error: msg });
    }
  }
  return { scanned: candidates.length, applied, errors };
}

// Re-export status helpers for API layer convenience.
export { isActive, isTerminal };

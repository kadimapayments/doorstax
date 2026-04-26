import { db } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { periodKeyFromDate } from "@/lib/ledger";
import { reserveReceiptNumber } from "./receipt-number";

/**
 * Record an offline (cash / check) payment for a tenant.
 *
 * Single transaction (Serializable isolation):
 *   1. Look up tenant → unit → property → ownerId; verify the property
 *      belongs to the actor's landlord.
 *   2. Look up the OWNER for that specific property (via
 *      `property.ownerId`) — NOT a blanket `findFirst({ landlordId })`.
 *      Fixes the multi-owner gotcha: a PM with multiple owners and
 *      different cash policies gets the right answer per-property.
 *   3. Verify the chosen method is enabled on that owner
 *      (`acceptsCash` / `acceptsChecks`).
 *   4. Reserve the next receipt number (atomic increment on User row).
 *   5. Create the Payment row — status COMPLETED immediately because
 *      cash is final and check is optimistically credited (Phase 2
 *      bounce flow handles NSF returns via REVERSAL ledger entry).
 *   6. Write the corresponding PAYMENT ledger entry, locked, linked
 *      to the Payment via paymentId.
 *
 * Returns `{ paymentId, receiptNumber }` or throws a typed error
 * the API layer maps to a 400/404/409.
 */

export interface RecordOfflinePaymentInput {
  tenantId: string; // TenantProfile.id
  amount: number;
  method: "cash" | "check";
  dateReceived: Date;
  notes?: string;
  /** When method=check, the check number gets prepended to notes for
   *  audit ("Check #1234 — April rent"). */
  checkNumber?: string;
  /** The User.id who's recording the receipt (PM or team member).
   *  Used both for landlordId resolution and as collectedByUserId on
   *  the Payment row. */
  actorId: string;
  /** The landlord whose books this belongs to. Distinct from actorId
   *  to support admin "View as PM" impersonation: actor is the admin,
   *  landlord is the PM. Resolved by the API layer via
   *  `resolveApiLandlord()`. */
  landlordId: string;
}

export class OfflinePaymentError extends Error {
  constructor(
    message: string,
    public status: number,
    public code:
      | "TENANT_NOT_FOUND"
      | "TENANT_NO_UNIT"
      | "PROPERTY_OWNERSHIP"
      | "OWNER_NOT_FOUND"
      | "METHOD_NOT_ENABLED"
      | "VALIDATION"
  ) {
    super(message);
    this.name = "OfflinePaymentError";
  }
}

export async function recordOfflinePayment(
  input: RecordOfflinePaymentInput
): Promise<{ paymentId: string; receiptNumber: string }> {
  if (input.amount <= 0) {
    throw new OfflinePaymentError("Amount must be positive", 400, "VALIDATION");
  }

  // Tenant + unit + property lookup happens OUTSIDE the transaction —
  // these are read-only and we don't need them under serializable
  // isolation (we re-verify nothing changed inside the tx via the
  // landlordId match on the Payment write).
  const tenant = await db.tenantProfile.findUnique({
    where: { id: input.tenantId },
    select: {
      id: true,
      unitId: true,
      unit: {
        select: {
          id: true,
          property: {
            select: {
              id: true,
              landlordId: true,
              ownerId: true,
            },
          },
        },
      },
    },
  });

  if (!tenant) {
    throw new OfflinePaymentError("Tenant not found", 404, "TENANT_NOT_FOUND");
  }
  if (!tenant.unitId || !tenant.unit) {
    throw new OfflinePaymentError(
      "Tenant has no unit assignment",
      400,
      "TENANT_NO_UNIT"
    );
  }
  if (tenant.unit.property.landlordId !== input.landlordId) {
    throw new OfflinePaymentError(
      "Tenant does not belong to this property manager",
      403,
      "PROPERTY_OWNERSHIP"
    );
  }

  // Multi-owner gotcha: each property has its own owner. Look up
  // policy on the owner of THIS property, not the first owner under
  // the landlord.
  const ownerId = tenant.unit.property.ownerId;
  if (!ownerId) {
    throw new OfflinePaymentError(
      "Property has no owner assigned — set an owner before recording cash or checks",
      400,
      "OWNER_NOT_FOUND"
    );
  }
  const owner = await db.owner.findUnique({
    where: { id: ownerId },
    select: { acceptsCash: true, acceptsChecks: true },
  });
  if (!owner) {
    throw new OfflinePaymentError("Owner not found", 404, "OWNER_NOT_FOUND");
  }
  if (input.method === "cash" && !owner.acceptsCash) {
    throw new OfflinePaymentError(
      "This owner is not configured to accept cash. Toggle Accept Cash on the owner first.",
      400,
      "METHOD_NOT_ENABLED"
    );
  }
  if (input.method === "check" && !owner.acceptsChecks) {
    throw new OfflinePaymentError(
      "This owner is not configured to accept checks. Toggle Accept Checks on the owner first.",
      400,
      "METHOD_NOT_ENABLED"
    );
  }

  // Build the memo line.
  const memoParts: string[] = [];
  if (input.method === "check" && input.checkNumber?.trim()) {
    memoParts.push(`Check #${input.checkNumber.trim()}`);
  }
  if (input.notes?.trim()) {
    memoParts.push(input.notes.trim());
  }
  const composedNotes = memoParts.length > 0 ? memoParts.join(" — ") : null;

  // ── Atomic transaction ──
  const result = await db.$transaction(
    async (tx) => {
      const receiptNumber = await reserveReceiptNumber(tx, input.landlordId);

      const payment = await tx.payment.create({
        data: {
          tenantId: tenant.id,
          unitId: tenant.unit!.id,
          landlordId: input.landlordId,
          amount: input.amount,
          type: "RENT",
          status: "COMPLETED",
          paymentMethod: input.method,
          paidAt: input.dateReceived,
          processedAt: new Date(),
          dueDate: input.dateReceived,
          source: "offline",
          receiptNumber,
          collectedByUserId: input.actorId,
          dateReceived: input.dateReceived,
          notes: composedNotes,
        },
      });

      // Inline ledger write — same semantics as recordPayment() in
      // src/lib/ledger.ts but bound to THIS transaction so the receipt
      // number, Payment row, and ledger entry land or rollback together.
      const latest = await tx.ledgerEntry.findFirst({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: "desc" },
        select: { balanceAfter: true },
      });
      const prevBalance = latest?.balanceAfter ?? new Decimal(0);
      const amount = new Decimal(input.amount.toString());
      const balanceAfter = new Decimal(prevBalance.toString()).minus(amount);

      const description =
        input.method === "cash"
          ? `Cash receipt — ${receiptNumber}`
          : `Check receipt — ${receiptNumber}`;

      await tx.ledgerEntry.create({
        data: {
          tenantId: tenant.id,
          unitId: tenant.unit!.id,
          type: "PAYMENT",
          amount: amount.negated(), // negative = credit
          balanceAfter,
          periodKey: periodKeyFromDate(input.dateReceived),
          description,
          paymentId: payment.id,
          locked: true,
          createdById: input.actorId,
        },
      });

      return { paymentId: payment.id, receiptNumber };
    },
    { isolationLevel: "Serializable" }
  );

  // ── Recovery-plan auto-apply (best-effort, post-commit) ──
  // If the tenant has an active RecoveryPlan, credit this payment to
  // it now instead of waiting for the recovery-reconcile cron. The
  // call is idempotent (RecoveryPaymentLog has unique(planId, paymentId))
  // so the cron re-running later is harmless.
  //
  // Errors are swallowed: the cash receipt has already landed and the
  // tenant ledger is already credited; recovery tracking failing is a
  // soft issue that the cron will eventually heal.
  try {
    const { applyPaymentToRecovery } = await import("@/lib/recovery/service");
    await applyPaymentToRecovery(result.paymentId);
  } catch (err) {
    console.error(
      "[offline-payment] applyPaymentToRecovery failed (non-blocking):",
      err
    );
  }

  return result;
}

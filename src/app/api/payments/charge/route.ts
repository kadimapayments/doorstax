import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { resolveApiLandlord } from "@/lib/api-landlord";
import { getMerchantCredentials } from "@/lib/kadima/merchant-context";
import { merchantCreateSaleFromVault } from "@/lib/kadima/merchant-gateway";
import { checkMerchantApproval } from "@/lib/kadima/merchant-guard";
import { assertUnitPropertyApproved } from "@/lib/property-guard";
import { pickSecCode } from "@/lib/kadima/sec-code";
import { recordPayment, periodKeyFromDate } from "@/lib/ledger";
import {
  recordOfflinePayment,
  OfflinePaymentError,
} from "@/lib/offline-payments/record";
import { reserveReceiptNumber } from "@/lib/offline-payments/receipt-number";
import { applyPaymentToRecovery } from "@/lib/recovery/service";
import { paymentLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * POST /api/payments/charge
 *
 * PM-initiated charge with method picker support.
 *
 * The bug Walter Parker exposed: previously this route hard-coded
 * `paymentMethod: "card"` and silently created a PENDING Payment row
 * when the tenant had no card on file (no Kadima call, no error).
 * That left ghost rows on the books and the PM thinking they'd
 * charged a tenant who in fact had no payment method.
 *
 * Fix: method picker + hard blocks BEFORE Payment.create. If the
 * chosen method can't possibly succeed (no card on file, no bank on
 * file, owner doesn't accept cash, etc.) we reject with 400 + a
 * specific error code so the UI can say something useful. No more
 * ghost rows.
 *
 * Preserves the existing safeguards from the prior implementation:
 *   - resolveApiLandlord (admin "View as PM" support)
 *   - assertUnitPropertyApproved (underwriter gate — properties not
 *     yet cleared by underwriting can't process live money)
 *   - checkMerchantApproval (PM's merchant must be approved)
 *   - merchantCreateSaleFromVault (PM-merchant credentials, NOT
 *     platform DBA — every other payment route in the codebase uses
 *     this pattern)
 *   - vault card verification (catches deleted-card-on-file before
 *     the gateway call)
 *
 * Adds:
 *   - paymentMethod in request body ("card" | "ach" | "cash" | "check")
 *   - hard blocks on missing payment data per method
 *   - PM-side ACH path (createAchFromVault + SEC=PPD)
 *   - cash / check delegation to recordOfflinePayment service
 */

const chargeSchema = z.object({
  tenantId: z.string().min(1, "Tenant is required"),
  unitId: z.string().min(1, "Unit is required"),
  amount: z.coerce.number().min(0.01, "Amount must be at least $0.01"),
  type: z.enum(["RENT", "DEPOSIT", "FEE"]).default("RENT"),
  description: z.string().optional(),
  source: z
    .enum(["tenant-portal", "virtual-terminal", "autopay", "scheduled"])
    .optional(),
  // ─── Method picker (new) ───
  paymentMethod: z
    .enum(["card", "ach", "cash", "check"])
    .default("card"),
  // ─── Cash / check optional fields ───
  checkNumber: z.string().max(30).optional(),
  checkDate: z.string().optional(),
  payerBankName: z.string().max(120).optional(),
  memoLine: z.string().max(200).optional(),
  checkSubType: z
    .enum(["PERSONAL", "MONEY_ORDER", "CASHIERS_CHECK"])
    .optional(),
  dateReceived: z.string().optional(),
  notes: z.string().max(2000).optional(),
  // ─── Recovery plan opt-in ───
  // When true, after the payment lands COMPLETED we synchronously call
  // applyPaymentToRecovery() to credit the tenant's active recovery
  // plan. The result lands on the response as `recovery: {...}` so the
  // UI can show "Applied to plan — 2/3 payments counted".
  // Only meaningful for type=RENT — non-rent payments don't satisfy
  // recovery period checks regardless.
  applyToRecoveryPlan: z.boolean().optional(),

  // ─── Apply to existing outstanding charge ───
  // When set, the route updates the referenced Payment row from
  // PENDING/FAILED to COMPLETED instead of creating a new Payment.
  // This closes the "Cindy has a $50 PENDING charge AND a new $50
  // payment, ledger nets but the PENDING row stays open" gap.
  //
  // Server validates: payment exists, belongs to this tenant, is
  // PENDING or FAILED, amount + type match the request.
  appliesToPaymentId: z.string().optional(),

  // ─── Multi-charge auto-allocation ───
  // When true (and appliesToPaymentId is NOT set), server walks the
  // tenant's outstanding charges oldest-first and allocates the
  // payment amount across them: full-settle each charge until the
  // amount runs out, partial-settle the last one if the amount
  // doesn't divide evenly.
  //
  // V1 limitation: cash/check only. Card/ACH multi-charge would
  // require N gateway calls (doubling fees) or a schema change for
  // a master-payment row pattern — punted to V2. Card/ACH requests
  // with autoAllocate=true reject with 400.
  autoAllocate: z.boolean().optional(),
});

// ─── Helper: fire the accounting journal entry for an incoming payment ───
// Called after every COMPLETED payment write so cash, check, card, and ACH
// all show up in the chart of accounts (Rent Revenue 4000, Late Fee Income
// 4100, etc.). Idempotent via journalIncomingPayment's dedup guard. Fire-
// and-forget — accounting failures don't block the user response, but they
// do log loudly so ops can spot them.
async function tryJournalPayment(
  paymentId: string,
  pmId: string
): Promise<void> {
  try {
    const { seedDefaultAccounts } = await import(
      "@/lib/accounting/chart-of-accounts"
    );
    await seedDefaultAccounts(pmId);
    const { journalIncomingPayment } = await import(
      "@/lib/accounting/auto-entries"
    );
    await journalIncomingPayment(paymentId);
  } catch (err) {
    console.error("[accounting] journalIncomingPayment failed:", err);
  }
}

// ─── Helper: apply to recovery plan + shape the response field ───
// Best-effort. Never throws; if the apply fails, the payment stands
// and the UI shows a warning toast instead of a success message.
async function tryApplyToRecovery(
  paymentId: string
): Promise<{
  applied: boolean;
  reason?: string;
  plan?: {
    id: string;
    status: string;
    completedPayments: number;
    requiredPayments: number;
  };
  log?: { periodKey: string; wasOnTime: boolean };
}> {
  try {
    const result = await applyPaymentToRecovery(paymentId);
    if (!result) {
      return {
        applied: false,
        reason:
          "Payment didn't match an active recovery plan. Either no active plan, or the period key isn't in the plan's required list.",
      };
    }
    return {
      applied: true,
      plan: {
        id: result.plan.id,
        status: result.plan.status,
        completedPayments: result.plan.completedPayments,
        requiredPayments: result.plan.requiredPayments,
      },
      log: result.log,
    };
  } catch (err) {
    console.error("[charge] applyPaymentToRecovery failed:", err);
    return {
      applied: false,
      reason: err instanceof Error ? err.message : "Recovery apply failed",
    };
  }
}

export async function POST(req: Request) {
  const ctx = await resolveApiLandlord();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate-limit by the actor (admin if impersonating, PM otherwise) —
  // matches every other charge / payment route in the codebase.
  const rl = await paymentLimiter.limit(ctx.actorId);
  if (!rl.success) return rateLimitResponse(rl.reset);

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const data = chargeSchema.parse(body);

    // Verify landlord owns this unit + tenant assignment + grab owner
    // config (acceptsCash / acceptsChecks) and Kadima terminal id in
    // the same query.
    const tenant = await db.tenantProfile.findFirst({
      where: {
        id: data.tenantId,
        unitId: data.unitId,
        unit: { property: { landlordId: ctx.landlordId } },
      },
      include: {
        unit: {
          include: {
            property: {
              select: {
                kadimaTerminalId: true,
                owner: {
                  select: { acceptsCash: true, acceptsChecks: true },
                },
              },
            },
          },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant or unit not found" },
        { status: 404 }
      );
    }

    // ─── Underwriter gate: property must be APPROVED ───
    // Live / legacy properties default to APPROVED; only properties
    // that went through the new boarding wizard start PENDING_REVIEW.
    // Applies to every method including cash/check — if the property
    // isn't cleared, no money moves at all.
    const propertyGuard = await assertUnitPropertyApproved(data.unitId);
    if (!propertyGuard.ok) {
      return NextResponse.json(
        { error: propertyGuard.reason },
        { status: 403 }
      );
    }

    // ─── Method-specific hard blocks ───
    // Reject before creating any Payment row if the method can't
    // possibly succeed. Replaces the old "create row, then maybe
    // try Kadima, then maybe leave PENDING" path that silently
    // dropped ghost rows when a tenant had no vault on file.
    if (data.paymentMethod === "card") {
      if (!tenant.kadimaCustomerId || !tenant.kadimaCardTokenId) {
        return NextResponse.json(
          {
            error:
              "Tenant has no card on file. Choose a different method or have them add one in their portal.",
            code: "NO_CARD_ON_FILE",
          },
          { status: 400 }
        );
      }
    }

    if (data.paymentMethod === "ach") {
      // Card vault and ACH vault are SEPARATE Kadima namespaces.
      // ACH requires `kadimaAchCustomerId` (provisioned via POST
      // /ach/customer in the tenant onboarding payment-method route).
      // Tenants who onboarded before kadimaAchCustomerId existed will
      // have kadimaAccountId set but kadimaAchCustomerId null — fail
      // closed and ask them to re-add their bank.
      if (!tenant.kadimaAchCustomerId || !tenant.kadimaAccountId) {
        return NextResponse.json(
          {
            error:
              "Tenant has no bank account on file. Choose a different method or have them add one in their portal.",
            code: "NO_ACH_ON_FILE",
          },
          { status: 400 }
        );
      }
    }

    if (data.paymentMethod === "cash") {
      if (!tenant.unit?.property?.owner?.acceptsCash) {
        return NextResponse.json(
          {
            error:
              "Cash payments are not enabled for this property. Enable on the owner page first.",
            code: "CASH_NOT_ACCEPTED",
          },
          { status: 400 }
        );
      }
    }

    if (data.paymentMethod === "check") {
      if (!tenant.unit?.property?.owner?.acceptsChecks) {
        return NextResponse.json(
          {
            error:
              "Check payments are not enabled for this property. Enable on the owner page first.",
            code: "CHECK_NOT_ACCEPTED",
          },
          { status: 400 }
        );
      }
      if (!data.checkNumber?.trim()) {
        return NextResponse.json(
          { error: "Check number is required.", code: "MISSING_CHECK_NUMBER" },
          { status: 400 }
        );
      }
    }

    // ═══════════════════════════════════════════════════════════
    //  MULTI-CHARGE AUTO-ALLOCATION (autoAllocate=true)
    // ═══════════════════════════════════════════════════════════
    //
    // PM hands in one cash/check covering multiple back-charges.
    // Walks outstanding charges oldest-first, full-settles each
    // one until the payment amount is consumed, partial-settles the
    // last one if the math doesn't divide evenly. ALL allocations
    // happen in a single Serializable transaction — either every
    // charge gets settled or none of them do.
    //
    // Cash/check only in V1 (gateway-fee + audit considerations
    // documented in the autoAllocate field's zod comment).
    if (data.autoAllocate && !data.appliesToPaymentId) {
      if (data.paymentMethod !== "cash" && data.paymentMethod !== "check") {
        return NextResponse.json(
          {
            error:
              "Multi-charge allocation isn't supported for card or ACH yet. Pick one charge at a time, or use cash/check.",
            code: "AUTO_ALLOCATE_METHOD_UNSUPPORTED",
          },
          { status: 400 }
        );
      }

      // Pull every open charge for this tenant + unit, oldest first.
      // dueDate is the natural ordering signal (matches how the PM
      // thinks about "what's been overdue longest"); createdAt is the
      // tiebreaker for charges with the same dueDate (e.g. April rent
      // + April late fee both due Apr 1, but the late fee was created
      // 5 days later by the late-fees cron).
      const charges = await db.payment.findMany({
        where: {
          tenantId: data.tenantId,
          unitId: data.unitId,
          landlordId: ctx.landlordId,
          status: { in: ["PENDING", "FAILED"] },
          voidedAt: null,
        },
        orderBy: [
          { dueDate: "asc" },
          { createdAt: "asc" },
        ],
      });

      if (charges.length === 0) {
        return NextResponse.json(
          {
            error:
              "No outstanding charges to allocate against. Clear auto-allocate to record this as a new charge.",
            code: "NO_OUTSTANDING_CHARGES",
          },
          { status: 400 }
        );
      }

      const totalOutstanding = charges.reduce(
        (sum, c) => sum + Number(c.amount),
        0
      );
      if (data.amount > totalOutstanding + 0.005) {
        return NextResponse.json(
          {
            error: `Payment of $${data.amount.toFixed(2)} exceeds total outstanding of $${totalOutstanding.toFixed(2)}. Lower the amount or clear auto-allocate.`,
            code: "AMOUNT_EXCEEDS_OUTSTANDING",
          },
          { status: 400 }
        );
      }

      // ── Compute allocations ──
      // Walk charges, peeling off full-settles until the payment
      // amount runs out. The LAST allocation (and only that one) may
      // be a partial — when the remaining amount is less than the
      // current charge's amount.
      type Allocation = {
        charge: (typeof charges)[number];
        amount: number;
        partial: boolean;
      };
      const allocations: Allocation[] = [];
      let remaining = data.amount;
      for (const charge of charges) {
        if (remaining <= 0.005) break;
        const chargeAmt = Number(charge.amount);
        if (remaining >= chargeAmt - 0.005) {
          allocations.push({ charge, amount: chargeAmt, partial: false });
          remaining = Math.round((remaining - chargeAmt) * 100) / 100;
        } else {
          allocations.push({ charge, amount: remaining, partial: true });
          remaining = 0;
        }
      }

      // Sanity: at least one allocation. (Guaranteed by the
      // outstanding-charges length check above + amount > 0 from
      // zod, but belt-and-suspenders.)
      if (allocations.length === 0) {
        return NextResponse.json(
          { error: "Could not compute allocations", code: "ALLOC_FAILED" },
          { status: 500 }
        );
      }

      // Compose check metadata for the notes field — fold all the
      // bonus fields into a single notes string the same way the
      // single-charge cash/check settle path does.
      const extras: string[] = [];
      if (data.paymentMethod === "check") {
        if (data.checkSubType) extras.push(`Type: ${data.checkSubType}`);
        if (data.checkDate) extras.push(`Check date: ${data.checkDate}`);
        if (data.payerBankName?.trim())
          extras.push(`Bank: ${data.payerBankName.trim()}`);
        if (data.memoLine?.trim())
          extras.push(`Memo: ${data.memoLine.trim()}`);
      }
      const composedNotes = [
        data.notes ?? data.description,
        extras.length > 0 ? extras.join(" · ") : null,
        `Auto-allocated across ${allocations.length} charge${allocations.length === 1 ? "" : "s"}`,
      ]
        .filter(Boolean)
        .join(" — ");

      const checkNumberSuffix =
        data.paymentMethod === "check" && data.checkNumber?.trim()
          ? ` — Check #${data.checkNumber.trim()}`
          : "";

      const settledAt = data.dateReceived
        ? new Date(data.dateReceived)
        : new Date();

      // ── Atomic walk: every allocation settles or none do ──
      // The Serializable isolation level matches the single-charge
      // settle path. Inside the tx we reserve a fresh receipt number
      // per allocation (so each settled charge has its own paper
      // trail), update the existing PENDING row, optionally create a
      // remainder row (only on the last allocation if partial), and
      // write a per-charge ledger PAYMENT entry.
      const txResult = await db.$transaction(
        async (tx) => {
          const settled: Array<{
            chargeId: string;
            paymentId: string;
            receiptNumber: string;
            amount: number;
            originalAmount: number;
            partial: boolean;
            description: string | null;
          }> = [];
          let remainderId: string | null = null;

          for (const alloc of allocations) {
            const receiptNumber = await reserveReceiptNumber(
              tx,
              ctx.landlordId
            );

            const charge = alloc.charge;
            const originalAmount = Number(charge.amount);
            const isPartial = alloc.partial;
            const baseDesc =
              (charge.description?.trim() || charge.type) as string;
            const partialDesc = isPartial
              ? `${baseDesc} (partial — $${alloc.amount.toFixed(2)} of $${originalAmount.toFixed(2)})`
              : null;

            const updated = await tx.payment.update({
              where: { id: charge.id },
              data: {
                status: "COMPLETED",
                paymentMethod: data.paymentMethod,
                paidAt: settledAt,
                processedAt: new Date(),
                source: "offline",
                receiptNumber,
                collectedByUserId: ctx.actorId,
                dateReceived: settledAt,
                notes: composedNotes || null,
                ...(isPartial && {
                  amount: new Decimal(alloc.amount.toString()),
                  description: partialDesc,
                }),
              },
            });

            // Remainder row — only on the partial allocation, which by
            // construction is always the LAST one (we exit the loop
            // immediately after a partial). Same shape as the single-
            // charge partial path so audit logic is consistent.
            if (isPartial) {
              const remainderAmt = Math.round(
                (originalAmount - alloc.amount) * 100
              ) / 100;
              const remainder = await tx.payment.create({
                data: {
                  tenantId: charge.tenantId,
                  unitId: charge.unitId,
                  landlordId: charge.landlordId,
                  amount: new Decimal(remainderAmt.toString()),
                  type: charge.type,
                  status: "PENDING",
                  dueDate: charge.dueDate,
                  description: `${baseDesc} (remaining $${remainderAmt.toFixed(2)})`,
                  source: charge.source ?? null,
                },
              });
              remainderId = remainder.id;
            }

            // Ledger PAYMENT entry — one per allocation. Tied to the
            // settled charge's id so each charge has a clean 1-to-1
            // mapping to its ledger entry.
            const ledgerPeriodKey = periodKeyFromDate(
              charge.dueDate || new Date()
            );
            const latest = await tx.ledgerEntry.findFirst({
              where: { tenantId: charge.tenantId },
              orderBy: { createdAt: "desc" },
              select: { balanceAfter: true },
            });
            const prevBalance = latest?.balanceAfter ?? new Decimal(0);
            const allocAmount = new Decimal(alloc.amount.toString());
            const balanceAfter = new Decimal(
              prevBalance.toString()
            ).minus(allocAmount);

            await tx.ledgerEntry.create({
              data: {
                tenantId: charge.tenantId,
                unitId: charge.unitId,
                type: "PAYMENT",
                amount: allocAmount.negated(),
                balanceAfter,
                periodKey: ledgerPeriodKey,
                description: `${
                  data.paymentMethod === "cash" ? "Cash" : "Check"
                } receipt — ${receiptNumber}${checkNumberSuffix}${
                  isPartial ? " (partial)" : ""
                }`,
                paymentId: updated.id,
                locked: true,
                createdById: ctx.actorId,
              },
            });

            settled.push({
              chargeId: charge.id,
              paymentId: updated.id,
              receiptNumber,
              amount: alloc.amount,
              originalAmount,
              partial: isPartial,
              description: charge.description,
            });
          }

          return { settled, remainderId };
        },
        { isolationLevel: "Serializable" }
      );

      // Best-effort post-commit hooks: journal each settled payment
      // to the chart of accounts, apply each one to recovery if the
      // PM opted in and the charge was RENT-typed.
      for (const s of txResult.settled) {
        tryJournalPayment(s.paymentId, ctx.landlordId);
      }
      const recoveryResults: Array<Awaited<
        ReturnType<typeof tryApplyToRecovery>
      >> = [];
      if (data.applyToRecoveryPlan) {
        for (const s of txResult.settled) {
          const charge = allocations.find((a) => a.charge.id === s.chargeId)
            ?.charge;
          if (charge?.type === "RENT") {
            recoveryResults.push(await tryApplyToRecovery(s.paymentId));
          }
        }
      }

      return NextResponse.json(
        {
          success: true,
          charged: true,
          method: data.paymentMethod,
          autoAllocated: true,
          allocations: txResult.settled,
          remainderChargeId: txResult.remainderId,
          ...(recoveryResults.length > 0 && {
            recoveryResults,
          }),
        },
        { status: 200 }
      );
    }

    // ═══════════════════════════════════════════════════════════
    //  SETTLE EXISTING OUTSTANDING CHARGE (appliesToPaymentId)
    // ═══════════════════════════════════════════════════════════
    //
    // When the PM is paying-against an existing PENDING / FAILED
    // Payment row (e.g. Cindy already had a $50 PENDING late-fee
    // charge and just handed in a check for it), we update that row
    // in place instead of creating a new one. Closes the gap where
    // a new payment would settle the ledger but leave the original
    // PENDING charge floating forever.
    if (data.appliesToPaymentId) {
      const existing = await db.payment.findFirst({
        where: {
          id: data.appliesToPaymentId,
          tenantId: data.tenantId,
          unitId: data.unitId,
          landlordId: ctx.landlordId,
        },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Outstanding charge not found", code: "CHARGE_NOT_FOUND" },
          { status: 404 }
        );
      }
      if (existing.status !== "PENDING" && existing.status !== "FAILED") {
        return NextResponse.json(
          {
            error: `Charge is already ${existing.status.toLowerCase()} — cannot apply payment to it.`,
            code: "CHARGE_NOT_OPEN",
          },
          { status: 409 }
        );
      }
      if (existing.voidedAt) {
        return NextResponse.json(
          { error: "Charge is voided.", code: "CHARGE_VOIDED" },
          { status: 409 }
        );
      }
      // ── Partial-settle support ──
      // V2 invariant: payment amount must be > 0 and <= outstanding
      // charge amount. Less-than means partial settle (split into
      // settled portion + remainder PENDING row); equal means full
      // settle (existing behavior); greater-than is rejected — the
      // PM should use multi-charge allocation instead of overpaying
      // a single charge.
      const outstandingAmount = Number(existing.amount);
      if (data.amount > outstandingAmount + 0.005) {
        return NextResponse.json(
          {
            error: `Payment of $${data.amount.toFixed(2)} exceeds the outstanding charge of $${outstandingAmount.toFixed(2)}. To settle multiple charges with one payment, clear the selection and let auto-allocation match them.`,
            code: "AMOUNT_OVER_CHARGE",
          },
          { status: 400 }
        );
      }
      const isPartialSettle = outstandingAmount - data.amount > 0.005;
      const remainderAmount = isPartialSettle
        ? Math.round((outstandingAmount - data.amount) * 100) / 100
        : 0;

      // Description rewrites — when partial, the now-settled row gets
      // "(partial — $50 of $100)" appended so the audit trail makes
      // sense at a glance, and the remainder row gets "(remaining $50)"
      // suffix so the outstanding-charges card distinguishes it from
      // any sibling rows.
      const baseDesc =
        (existing.description?.trim() || existing.type) as string;
      const partialOriginalDesc = isPartialSettle
        ? `${baseDesc} (partial — $${data.amount.toFixed(2)} of $${outstandingAmount.toFixed(2)})`
        : null;
      const remainderDesc = isPartialSettle
        ? `${baseDesc} (remaining $${remainderAmount.toFixed(2)})`
        : null;

      // Period key for the ledger entry — anchor on the original
      // charge's dueDate so the payment lands in the same period the
      // charge was posted to. Falls back to "now" if dueDate is missing.
      const ledgerPeriodKey = periodKeyFromDate(
        existing.dueDate || new Date()
      );
      const settledAt = data.dateReceived
        ? new Date(data.dateReceived)
        : new Date();

      // ── Cash / check: inline settle (no new Payment, no recordOfflinePayment) ──
      if (
        data.paymentMethod === "cash" ||
        data.paymentMethod === "check"
      ) {
        // Compose notes the same way the new-charge branch does so
        // check metadata is preserved on the settled row.
        const extras: string[] = [];
        if (data.paymentMethod === "check") {
          if (data.checkSubType) extras.push(`Type: ${data.checkSubType}`);
          if (data.checkDate) extras.push(`Check date: ${data.checkDate}`);
          if (data.payerBankName?.trim())
            extras.push(`Bank: ${data.payerBankName.trim()}`);
          if (data.memoLine?.trim())
            extras.push(`Memo: ${data.memoLine.trim()}`);
        }
        const composedNotes = [
          data.notes ?? data.description,
          extras.length > 0 ? extras.join(" · ") : null,
          existing.description ? `Settled: ${existing.description}` : null,
        ]
          .filter(Boolean)
          .join(" — ");

        const checkNumberSuffix =
          data.paymentMethod === "check" && data.checkNumber?.trim()
            ? ` — Check #${data.checkNumber.trim()}`
            : "";

        const settleResult = await db.$transaction(
          async (tx) => {
            const receiptNumber = await reserveReceiptNumber(
              tx,
              ctx.landlordId
            );

            const updated = await tx.payment.update({
              where: { id: existing.id },
              data: {
                status: "COMPLETED",
                paymentMethod: data.paymentMethod,
                paidAt: settledAt,
                processedAt: new Date(),
                source: "offline",
                receiptNumber,
                collectedByUserId: ctx.actorId,
                dateReceived: settledAt,
                notes: composedNotes || null,
                // ── Partial-settle: shrink the original row to the
                // amount actually paid and rewrite description so
                // it's audit-clear. The remainder lands as a brand-
                // new PENDING row (created below) so it shows up in
                // the outstanding-charges card on its own.
                ...(isPartialSettle && {
                  amount: new Decimal(data.amount.toString()),
                  description: partialOriginalDesc,
                }),
              },
            });

            // ── Remainder row (only on partial) ──
            // Same type / tenant / unit / landlord / dueDate as the
            // original. Status stays PENDING — outstanding-charges
            // endpoint will pick it up. No ledger entry needed; the
            // original CHARGE entry already covers the obligation.
            let remainderId: string | null = null;
            if (isPartialSettle) {
              const remainder = await tx.payment.create({
                data: {
                  tenantId: existing.tenantId,
                  unitId: existing.unitId,
                  landlordId: existing.landlordId,
                  amount: new Decimal(remainderAmount.toString()),
                  type: existing.type,
                  status: "PENDING",
                  dueDate: existing.dueDate,
                  description: remainderDesc,
                  source: existing.source ?? null,
                },
              });
              remainderId = remainder.id;
            }

            // Inline ledger PAYMENT entry — tied to the same Payment id
            // we just settled, so the audit trail is single-keyed.
            const latest = await tx.ledgerEntry.findFirst({
              where: { tenantId: existing.tenantId },
              orderBy: { createdAt: "desc" },
              select: { balanceAfter: true },
            });
            const prevBalance = latest?.balanceAfter ?? new Decimal(0);
            const amount = new Decimal(data.amount.toString());
            const balanceAfter = new Decimal(
              prevBalance.toString()
            ).minus(amount);

            await tx.ledgerEntry.create({
              data: {
                tenantId: existing.tenantId,
                unitId: existing.unitId,
                type: "PAYMENT",
                amount: amount.negated(),
                balanceAfter,
                periodKey: ledgerPeriodKey,
                description: `${
                  data.paymentMethod === "cash" ? "Cash" : "Check"
                } receipt — ${receiptNumber}${checkNumberSuffix}${
                  isPartialSettle ? " (partial)" : ""
                }`,
                paymentId: updated.id,
                locked: true,
                createdById: ctx.actorId,
              },
            });

            return { paymentId: updated.id, receiptNumber, remainderId };
          },
          { isolationLevel: "Serializable" }
        );

        // Cash / check settle: fire the journal hook so the receipt
        // hits the chart of accounts (Rent Revenue, Late Fee Income,
        // etc.) just like card / ACH does.
        tryJournalPayment(settleResult.paymentId, ctx.landlordId);

        const recovery =
          data.applyToRecoveryPlan && existing.type === "RENT"
            ? await tryApplyToRecovery(settleResult.paymentId)
            : undefined;

        return NextResponse.json(
          {
            success: true,
            paymentId: settleResult.paymentId,
            receiptNumber: settleResult.receiptNumber,
            charged: true,
            method: data.paymentMethod,
            settledChargeId: existing.id,
            // ── Partial-settle response shape ──
            // When isPartialSettle, the response carries the remainder
            // metadata so the form can show "Settled $50 of $100 — $50
            // remains as a new charge" in the success toast.
            ...(isPartialSettle && {
              partialSettle: {
                paidAmount: data.amount,
                originalAmount: outstandingAmount,
                remainderAmount,
                remainderChargeId: settleResult.remainderId,
              },
            }),
            ...(recovery !== undefined && { recovery }),
          },
          { status: 200 }
        );
      }

      // ── Card / ACH settle: gateway call against existing Payment ──
      const approvalCheck = await checkMerchantApproval(ctx.landlordId);
      if (!approvalCheck.approved) {
        return NextResponse.json(
          {
            error:
              approvalCheck.reason ||
              "Merchant account not approved for payments",
          },
          { status: 403 }
        );
      }

      const merchantCreds = await getMerchantCredentials(ctx.landlordId);
      const terminalIdOverride =
        tenant.unit?.property?.kadimaTerminalId || undefined;

      if (data.paymentMethod === "card") {
        try {
          const result = await merchantCreateSaleFromVault(merchantCreds, {
            cardToken: tenant.kadimaCardTokenId!,
            amount: data.amount,
            terminalIdOverride,
          });
          const approved = result.status?.status === "Approved";
          const cardLast4 = result.card?.number
            ? String(result.card.number)
            : undefined;

          await db.payment.update({
            where: { id: existing.id },
            data: {
              status: approved ? "COMPLETED" : "FAILED",
              paymentMethod: "card",
              kadimaTransactionId: String(result.id),
              kadimaStatus: result.status?.status || null,
              paidAt: approved ? new Date() : null,
              processedAt: new Date(),
              ...(!approved && {
                failedReason: `Gateway declined: ${result.status?.status || "unknown"}`,
              }),
              ...(cardLast4 && { cardLast4 }),
              // Partial-settle: shrink the original row and rewrite
              // description on success only. If the gateway declined
              // we leave amount/description alone so the PM can retry
              // for the full balance.
              ...(approved && isPartialSettle && {
                amount: new Decimal(data.amount.toString()),
                description: partialOriginalDesc,
              }),
            },
          });

          // Spawn the remainder PENDING row on a successful partial
          // settle. Done OUTSIDE the gateway try/catch so a card
          // approval but Prisma error during remainder-creation logs
          // loudly without rolling back the gateway charge.
          let remainderChargeId: string | null = null;
          if (approved && isPartialSettle) {
            try {
              const remainder = await db.payment.create({
                data: {
                  tenantId: existing.tenantId,
                  unitId: existing.unitId,
                  landlordId: existing.landlordId,
                  amount: new Decimal(remainderAmount.toString()),
                  type: existing.type,
                  status: "PENDING",
                  dueDate: existing.dueDate,
                  description: remainderDesc,
                  source: existing.source ?? null,
                },
              });
              remainderChargeId = remainder.id;
            } catch (remErr) {
              console.error(
                "[charge] partial-settle remainder row creation failed:",
                remErr
              );
            }
          }

          if (approved) {
            recordPayment({
              tenantId: existing.tenantId,
              unitId: existing.unitId,
              paymentId: existing.id,
              amount: data.amount,
              periodKey: ledgerPeriodKey,
              description: `Settled charge — ${existing.description || existing.type}${
                isPartialSettle ? " (partial)" : ""
              }`,
            }).catch((e) =>
              console.error("[ledger] settle ledger entry failed:", e)
            );
            tryJournalPayment(existing.id, ctx.landlordId);
          }

          const recovery =
            approved && data.applyToRecoveryPlan && existing.type === "RENT"
              ? await tryApplyToRecovery(existing.id)
              : undefined;

          return NextResponse.json(
            {
              success: true,
              paymentId: existing.id,
              charged: approved,
              method: "card",
              settledChargeId: existing.id,
              ...(approved && isPartialSettle && {
                partialSettle: {
                  paidAmount: data.amount,
                  originalAmount: outstandingAmount,
                  remainderAmount,
                  remainderChargeId,
                },
              }),
              ...(recovery !== undefined && { recovery }),
              ...(approved
                ? {}
                : { error: `Payment declined: ${result.status?.status || "unknown"}` }),
            },
            { status: 200 }
          );
        } catch (chargeErr: unknown) {
          const errMsg =
            chargeErr instanceof Error
              ? chargeErr.message
              : "Payment gateway error";
          await db.payment.update({
            where: { id: existing.id },
            data: {
              status: "FAILED",
              kadimaStatus: "gateway_error",
              failedReason: errMsg,
              processedAt: new Date(),
            },
          });
          return NextResponse.json(
            {
              success: false,
              paymentId: existing.id,
              charged: false,
              error: "Payment gateway error — charge marked failed",
              code: "GATEWAY_ERROR",
            },
            { status: 502 }
          );
        }
      }

      // ─── ACH settle ───
      // Use the platform vault (createAchFromVault) — same reason as
      // the tenant outstanding-charge pay route: the ACH customer +
      // account were provisioned under the platform DBA via
      // POST /ach/customer in onboarding. The PM merchant API key
      // can't reach those records, and merchantCreateAchDebit also
      // omits `dba.id` from the request body.
      try {
        const secCode = pickSecCode({ kind: "pm_back_office_standing" });
        const { createAchFromVault } = await import("@/lib/kadima/ach");
        const achResult = (await createAchFromVault({
          customerId: tenant.kadimaAchCustomerId!,
          accountId: tenant.kadimaAccountId!,
          amount: data.amount,
          secCode,
          memo: `Settle charge — ${existing.description || existing.type}`,
        })) as {
          id?: string | number;
          status?: { status?: string } | string;
        };
        const rawStatus =
          typeof achResult.status === "string"
            ? achResult.status
            : achResult.status?.status;
        // ACH submitted = PROCESSING. Kadima doesn't return "Approved"
        // for ACH submissions — it returns "Submitted" / "Pending" /
        // null because settlement is async (1–3 biz days). If we got
        // here without throwing, the submission was accepted; the
        // reconciliation cron later promotes PROCESSING → COMPLETED on
        // settle, or → FAILED + REVERSAL on bounce. The catch block
        // below handles all synchronous rejections.
        const submitted = true;

        await db.payment.update({
          where: { id: existing.id },
          data: {
            status: "PROCESSING",
            paymentMethod: "ach",
            kadimaTransactionId:
              achResult.id != null ? String(achResult.id) : null,
            kadimaStatus: rawStatus || "Submitted",
            // paidAt only on settle (reconciliation cron sets it).
            // processedAt = "we handed it to Kadima" — safe to set now.
            processedAt: new Date(),
            achSecCode: secCode,
            achLast4: tenant.bankLast4 ?? undefined,
            ...(submitted && isPartialSettle && {
              amount: new Decimal(data.amount.toString()),
              description: partialOriginalDesc,
            }),
          },
        });

        // Spawn the remainder PENDING row at submit time so the
        // tenant's outstanding-charges view immediately reflects the
        // partial split. If the ACH bounces later, the parent
        // PROCESSING row flips to FAILED via reconciliation; the
        // remainder PENDING row remains independent and uneffected.
        let remainderChargeId: string | null = null;
        if (submitted && isPartialSettle) {
          try {
            const remainder = await db.payment.create({
              data: {
                tenantId: existing.tenantId,
                unitId: existing.unitId,
                landlordId: existing.landlordId,
                amount: new Decimal(remainderAmount.toString()),
                type: existing.type,
                status: "PENDING",
                dueDate: existing.dueDate,
                description: remainderDesc,
                source: existing.source ?? null,
              },
            });
            remainderChargeId = remainder.id;
          } catch (remErr) {
            console.error(
              "[charge] partial-settle remainder row creation failed:",
              remErr
            );
          }
        }

        if (submitted) {
          // Write the PAYMENT ledger entry at submission time so the
          // tenant's outstanding-charges card immediately reflects the
          // settlement. If the ACH later bounces, the reconciliation
          // cron creates a REVERSAL ledger entry to undo this.
          recordPayment({
            tenantId: existing.tenantId,
            unitId: existing.unitId,
            paymentId: existing.id,
            amount: data.amount,
            periodKey: ledgerPeriodKey,
            description: `Settled charge (ACH) — ${existing.description || existing.type}${
              isPartialSettle ? " (partial)" : ""
            }`,
          }).catch((e) =>
            console.error("[ledger] settle ledger entry failed:", e)
          );
          tryJournalPayment(existing.id, ctx.landlordId);
        }

        const recovery =
          submitted && data.applyToRecoveryPlan && existing.type === "RENT"
            ? await tryApplyToRecovery(existing.id)
            : undefined;

        return NextResponse.json(
          {
            success: true,
            paymentId: existing.id,
            charged: submitted,
            method: "ach",
            // PROCESSING flag — clients (the charge form, the toast)
            // can use this to show "ACH submitted, settles in 1–3
            // business days" instead of "Charged".
            achProcessing: true,
            settledChargeId: existing.id,
            ...(submitted && isPartialSettle && {
              partialSettle: {
                paidAmount: data.amount,
                originalAmount: outstandingAmount,
                remainderAmount,
                remainderChargeId,
              },
            }),
            ...(recovery !== undefined && { recovery }),
          },
          { status: 200 }
        );
      } catch (chargeErr: unknown) {
        const errMsg =
          chargeErr instanceof Error
            ? chargeErr.message
            : "ACH gateway error";
        await db.payment.update({
          where: { id: existing.id },
          data: {
            status: "FAILED",
            kadimaStatus: "gateway_error",
            failedReason: errMsg,
            processedAt: new Date(),
          },
        });
        return NextResponse.json(
          {
            success: false,
            paymentId: existing.id,
            charged: false,
            error: "ACH gateway error — charge marked failed",
            code: "GATEWAY_ERROR",
          },
          { status: 502 }
        );
      }
    }

    // ─── Cash / check: delegate to offline payments service ───
    // The service runs its own atomic transaction (reserve receipt
    // number → create Payment → write ledger entry), so we just
    // adapt the request fields to its signature and translate
    // OfflinePaymentError back to HTTP. The bonus check fields
    // (payerBankName, memoLine, checkSubType, checkDate) get folded
    // into the notes payload until the service grows columns for
    // them in a future drop.
    if (data.paymentMethod === "cash" || data.paymentMethod === "check") {
      // Fold the extra check metadata into the notes line so it's
      // preserved on the Payment.notes field for audit. Once the
      // offline-payments service grows dedicated columns we can
      // pass these through structurally instead.
      const extras: string[] = [];
      if (data.paymentMethod === "check") {
        if (data.checkSubType) extras.push(`Type: ${data.checkSubType}`);
        if (data.checkDate) extras.push(`Check date: ${data.checkDate}`);
        if (data.payerBankName?.trim())
          extras.push(`Bank: ${data.payerBankName.trim()}`);
        if (data.memoLine?.trim())
          extras.push(`Memo: ${data.memoLine.trim()}`);
      }
      const composedNotes = [
        data.notes ?? data.description,
        extras.length > 0 ? extras.join(" · ") : null,
      ]
        .filter(Boolean)
        .join(" — ");

      try {
        const result = await recordOfflinePayment({
          tenantId: data.tenantId,
          landlordId: ctx.landlordId,
          actorId: ctx.actorId,
          amount: data.amount,
          method: data.paymentMethod,
          dateReceived: data.dateReceived
            ? new Date(data.dateReceived)
            : new Date(),
          notes: composedNotes || undefined,
          checkNumber:
            data.paymentMethod === "check" ? data.checkNumber : undefined,
        });

        // Apply to recovery plan if the PM opted in. Cash and check
        // payments are RENT-typed inside recordOfflinePayment, so they
        // can satisfy a plan period as long as the period key matches.
        const recovery =
          data.applyToRecoveryPlan && data.type === "RENT"
            ? await tryApplyToRecovery(result.paymentId)
            : undefined;

        return NextResponse.json(
          {
            success: true,
            paymentId: result.paymentId,
            receiptNumber: result.receiptNumber,
            charged: true,
            method: data.paymentMethod,
            ...(recovery !== undefined && { recovery }),
          },
          { status: 201 }
        );
      } catch (err) {
        if (err instanceof OfflinePaymentError) {
          return NextResponse.json(
            { error: err.message, code: err.code },
            { status: err.status }
          );
        }
        throw err;
      }
    }

    // ─── Kadima methods (card / ACH) ───
    // Verify PM's merchant application is approved before any gateway
    // call. Cash/check skip this — they're not gated on Kadima at all.
    const approvalCheck = await checkMerchantApproval(ctx.landlordId);
    if (!approvalCheck.approved) {
      return NextResponse.json(
        {
          error:
            approvalCheck.reason ||
            "Merchant account not approved for payments",
        },
        { status: 403 }
      );
    }

    // Create the Payment row in PENDING; we'll update it with the
    // gateway result.
    const payment = await db.payment.create({
      data: {
        tenantId: data.tenantId,
        unitId: data.unitId,
        landlordId: ctx.landlordId,
        amount: data.amount,
        type: data.type,
        status: "PENDING",
        paymentMethod: data.paymentMethod,
        dueDate: new Date(),
        description: data.description,
        source: data.source || null,
      },
    });

    const merchantCreds = await getMerchantCredentials(ctx.landlordId);
    const terminalIdOverride =
      tenant.unit?.property?.kadimaTerminalId || undefined;

    // ─── Card path ───
    if (data.paymentMethod === "card") {
      try {
        // Vault card verification — make sure the saved card token
        // still exists on the Kadima vault before we try to charge it.
        // Catches "tenant deleted their card from the portal" cases
        // before they hit the gateway as a generic decline.
        try {
          const { listCards } = await import("@/lib/kadima/customer-vault");
          const vaultCards = await listCards(tenant.kadimaCustomerId!);
          const cardExists = vaultCards.items?.some(
            (c: { id?: number | string; token?: string }) =>
              String(c.id) === tenant.kadimaCardTokenId ||
              String(c.token) === tenant.kadimaCardTokenId
          );
          if (!cardExists) {
            await db.payment.update({
              where: { id: payment.id },
              data: {
                status: "FAILED",
                failedReason: "Vault card no longer exists",
                processedAt: new Date(),
              },
            });
            return NextResponse.json(
              {
                success: false,
                paymentId: payment.id,
                charged: false,
                error: "Tenant's saved card is no longer available",
                code: "VAULT_CARD_MISSING",
              },
              { status: 400 }
            );
          }
        } catch (vaultErr) {
          // Vault verification is best-effort — proceed with the
          // charge attempt and let the gateway decide.
          console.error(
            "[charge] Vault card verification failed:",
            vaultErr
          );
        }

        const result = await merchantCreateSaleFromVault(merchantCreds, {
          cardToken: tenant.kadimaCardTokenId!,
          amount: data.amount,
          terminalIdOverride,
        });

        const approved = result.status?.status === "Approved";
        const cardLast4 = result.card?.number
          ? String(result.card.number)
          : undefined;

        await db.payment.update({
          where: { id: payment.id },
          data: {
            status: approved ? "COMPLETED" : "FAILED",
            kadimaTransactionId: String(result.id),
            kadimaStatus: result.status?.status || null,
            paidAt: approved ? new Date() : null,
            processedAt: new Date(),
            ...(!approved && {
              failedReason: `Gateway declined: ${result.status?.status || "unknown"}`,
            }),
            ...(cardLast4 && { cardLast4 }),
          },
        });

        if (approved) {
          recordPayment({
            tenantId: data.tenantId,
            unitId: data.unitId,
            paymentId: payment.id,
            amount: data.amount,
            periodKey: periodKeyFromDate(new Date()),
            description: `PM charge — ${data.description || data.type}`,
          }).catch((e) =>
            console.error("[ledger] PM charge entry failed:", e)
          );
          tryJournalPayment(payment.id, ctx.landlordId);
        }

        const recovery =
          approved && data.applyToRecoveryPlan && data.type === "RENT"
            ? await tryApplyToRecovery(payment.id)
            : undefined;

        return NextResponse.json(
          {
            success: true,
            paymentId: payment.id,
            charged: approved,
            method: "card",
            ...(recovery !== undefined && { recovery }),
            ...(approved
              ? {}
              : { error: `Payment declined: ${result.status?.status || "unknown"}` }),
          },
          { status: 201 }
        );
      } catch (chargeErr: unknown) {
        const errMsg =
          chargeErr instanceof Error
            ? chargeErr.message
            : "Payment gateway error";
        await db.payment.update({
          where: { id: payment.id },
          data: {
            status: "FAILED",
            kadimaStatus: "gateway_error",
            failedReason: errMsg,
            processedAt: new Date(),
          },
        });

        return NextResponse.json(
          {
            success: false,
            paymentId: payment.id,
            charged: false,
            error: "Payment gateway error — payment recorded as failed",
            code: "GATEWAY_ERROR",
          },
          { status: 502 }
        );
      }
    }

    // ─── ACH path (PM-initiated) ───
    // PM-initiated back-office charge against a tenant's vaulted bank
    // account. NACHA SEC code "PPD" — assumes the tenant signed a
    // standing electronic authorisation when they vaulted the account
    // (the tenant onboarding flow captures this).
    //
    // Uses createAchFromVault (platform vault) instead of
    // merchantCreateAchDebit — the ACH customer + account were created
    // via POST /ach/customer under the platform DBA, so the platform
    // vaultClient is the only path that can reach them. Mirrors the
    // tenant outstanding-charge pay route.
    try {
      const secCode = pickSecCode({ kind: "pm_back_office_standing" });
      const { createAchFromVault } = await import("@/lib/kadima/ach");
      const result = (await createAchFromVault({
        customerId: tenant.kadimaAchCustomerId!,
        accountId: tenant.kadimaAccountId!,
        amount: data.amount,
        secCode,
        memo: `PM charge — ${data.description || data.type}`,
      })) as {
        id?: string | number;
        status?: { status?: string } | string;
      };

      const rawStatus =
        typeof result.status === "string"
          ? result.status
          : result.status?.status;
      // ACH-from-vault: if Kadima accepted submission (no exception
      // thrown), Payment goes to PROCESSING. Settlement promotes to
      // COMPLETED via reconciliation cron 1–3 biz days later, or
      // bounces flip to FAILED + REVERSAL ledger entry.
      const submitted = true;

      await db.payment.update({
        where: { id: payment.id },
        data: {
          status: "PROCESSING",
          kadimaTransactionId: result.id != null ? String(result.id) : null,
          kadimaStatus: rawStatus || "Submitted",
          // paidAt set on settle, not submit.
          processedAt: new Date(),
          achSecCode: secCode,
          achLast4: tenant.bankLast4 ?? undefined,
        },
      });

      if (submitted) {
        recordPayment({
          tenantId: data.tenantId,
          unitId: data.unitId,
          paymentId: payment.id,
          amount: data.amount,
          periodKey: periodKeyFromDate(new Date()),
          description: `PM ACH charge — ${data.description || data.type}`,
        }).catch((e) =>
          console.error("[ledger] PM ACH charge entry failed:", e)
        );
        tryJournalPayment(payment.id, ctx.landlordId);
      }

      const recovery =
        submitted && data.applyToRecoveryPlan && data.type === "RENT"
          ? await tryApplyToRecovery(payment.id)
          : undefined;

      return NextResponse.json(
        {
          success: true,
          paymentId: payment.id,
          charged: submitted,
          method: "ach",
          achProcessing: true,
          ...(recovery !== undefined && { recovery }),
        },
        { status: 201 }
      );
    } catch (chargeErr: unknown) {
      const errMsg =
        chargeErr instanceof Error
          ? chargeErr.message
          : "ACH gateway error";
      await db.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          kadimaStatus: "gateway_error",
          failedReason: errMsg,
          processedAt: new Date(),
        },
      });

      return NextResponse.json(
        {
          success: false,
          paymentId: payment.id,
          charged: false,
          error: "ACH gateway error — payment recorded as failed",
          code: "GATEWAY_ERROR",
        },
        { status: 502 }
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("[charge] unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

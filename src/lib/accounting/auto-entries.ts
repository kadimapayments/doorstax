import { db } from "@/lib/db";
import { createJournalEntry } from "./journal-engine";

/** Dedup guard — skip if journal entry already exists for this source+sourceId */
async function alreadyJournaled(pmId: string, source: string, sourceId: string) {
  const existing = await db.journalEntry.findFirst({
    where: { pmId, source, sourceId },
    select: { id: true },
  });
  return existing;
}

/** Rent payment received */
export async function journalRentPayment(params: {
  pmId: string;
  paymentId: string;
  amount: number;
  convenienceFee?: number;
  date: Date;
  propertyId?: string;
  tenantId?: string;
  unitId?: string;
  ownerId?: string;
}) {
  const dup = await alreadyJournaled(params.pmId, "RENT_PAYMENT", params.paymentId);
  if (dup) return dup;

  const lines: Parameters<typeof createJournalEntry>[0]["lines"] = [
    {
      accountCode: "1300",
      debit: params.amount + (params.convenienceFee || 0),
      memo: "Rent payment received",
      propertyId: params.propertyId,
      tenantId: params.tenantId,
      unitId: params.unitId,
    },
    {
      accountCode: "4000",
      credit: params.amount,
      memo: "Rent revenue",
      propertyId: params.propertyId,
      ownerId: params.ownerId,
    },
  ];

  if (params.convenienceFee && params.convenienceFee > 0) {
    lines.push({
      accountCode: "4400",
      credit: params.convenienceFee,
      memo: "Card convenience fee",
      propertyId: params.propertyId,
    });
  }

  return createJournalEntry({
    pmId: params.pmId,
    date: params.date,
    memo: "Rent payment",
    type: "AUTO",
    source: "RENT_PAYMENT",
    sourceId: params.paymentId,
    propertyId: params.propertyId,
    lines,
  });
}

/** Kadima batch settlement */
export async function journalBatchSettlement(params: {
  pmId: string;
  batchId: string;
  grossAmount: number;
  processingFees: number;
  netDeposit: number;
  date: Date;
}) {
  const dup = await alreadyJournaled(params.pmId, "BATCH_SETTLEMENT", params.batchId);
  if (dup) return dup;

  return createJournalEntry({
    pmId: params.pmId,
    date: params.date,
    memo: `Batch settlement \u2014 ${params.batchId}`,
    type: "AUTO",
    source: "BATCH_SETTLEMENT",
    sourceId: params.batchId,
    lines: [
      { accountCode: "1000", debit: params.netDeposit, memo: "Bank deposit" },
      { accountCode: "5900", debit: params.processingFees, memo: "Processing fees" },
      { accountCode: "1300", credit: params.grossAmount, memo: "Clear undeposited funds" },
    ],
  });
}

/** Property expense */
export async function journalExpense(params: {
  pmId: string;
  expenseId: string;
  amount: number;
  expenseAccountCode?: string;
  date: Date;
  propertyId?: string;
  ownerId?: string;
  isPaid?: boolean;
  description?: string;
}) {
  const dup = await alreadyJournaled(params.pmId, "EXPENSE", params.expenseId);
  if (dup) return dup;

  return createJournalEntry({
    pmId: params.pmId,
    date: params.date,
    memo: params.description || "Property expense",
    type: "AUTO",
    source: "EXPENSE",
    sourceId: params.expenseId,
    propertyId: params.propertyId,
    lines: [
      {
        accountCode: params.expenseAccountCode || "5000",
        debit: params.amount,
        memo: params.description,
        propertyId: params.propertyId,
        ownerId: params.ownerId,
      },
      {
        accountCode: params.isPaid ? "1000" : "2000",
        credit: params.amount,
        memo: params.isPaid ? "Paid from operating" : "Payable",
        propertyId: params.propertyId,
      },
    ],
  });
}

/** Owner payout */
export async function journalOwnerPayout(params: {
  pmId: string;
  payoutId: string;
  amount: number;
  managementFee?: number;
  date: Date;
  propertyId?: string;
  ownerId?: string;
}) {
  const dup = await alreadyJournaled(params.pmId, "PAYOUT", params.payoutId);
  if (dup) return dup;

  const lines: Parameters<typeof createJournalEntry>[0]["lines"] = [
    {
      accountCode: "2200",
      debit: params.amount + (params.managementFee || 0),
      memo: "Owner distribution",
      ownerId: params.ownerId,
      propertyId: params.propertyId,
    },
    {
      accountCode: "1000",
      credit: params.amount,
      memo: "Payout to owner",
    },
  ];

  if (params.managementFee && params.managementFee > 0) {
    lines.push({
      accountCode: "4300",
      credit: params.managementFee,
      memo: "Management fee retained",
      propertyId: params.propertyId,
    });
  }

  return createJournalEntry({
    pmId: params.pmId,
    date: params.date,
    memo: "Owner payout",
    type: "AUTO",
    source: "PAYOUT",
    sourceId: params.payoutId,
    propertyId: params.propertyId,
    lines,
  });
}

/** Refund to tenant */
export async function journalRefund(params: {
  pmId: string;
  paymentId: string;
  amount: number;
  date: Date;
  propertyId?: string;
  tenantId?: string;
  isPartial?: boolean;
}) {
  // For refunds, use paymentId + "refund" suffix to allow both payment + refund entries for same payment
  const dup = await alreadyJournaled(params.pmId, "REFUND", params.paymentId);
  if (dup) return dup;

  return createJournalEntry({
    pmId: params.pmId,
    date: params.date,
    memo: (params.isPartial ? "Partial" : "Full") + " refund",
    type: "AUTO",
    source: "REFUND",
    sourceId: params.paymentId,
    propertyId: params.propertyId,
    lines: [
      { accountCode: "4000", debit: params.amount, memo: "Revenue reversal", tenantId: params.tenantId },
      { accountCode: "1000", credit: params.amount, memo: "Refund disbursed" },
    ],
  });
}

/** Security deposit received */
export async function journalSecurityDeposit(params: {
  pmId: string;
  depositId: string;
  amount: number;
  date: Date;
  propertyId?: string;
  tenantId?: string;
}) {
  const dup = await alreadyJournaled(params.pmId, "SECURITY_DEPOSIT", params.depositId);
  if (dup) return dup;

  return createJournalEntry({
    pmId: params.pmId,
    date: params.date,
    memo: "Security deposit received",
    type: "AUTO",
    source: "SECURITY_DEPOSIT",
    sourceId: params.depositId,
    propertyId: params.propertyId,
    lines: [
      { accountCode: "1200", debit: params.amount, memo: "Deposit held", tenantId: params.tenantId, propertyId: params.propertyId },
      { accountCode: "2100", credit: params.amount, memo: "Deposit liability", tenantId: params.tenantId, propertyId: params.propertyId },
    ],
  });
}

/**
 * Unified journal-entry helper for any incoming tenant payment.
 *
 * Looks up a Payment row by id, resolves the right credit account
 * based on `payment.type`, and writes a balanced AUTO journal entry.
 * Idempotent — the existing `alreadyJournaled` dedup guard means
 * calling this twice on the same paymentId is a no-op.
 *
 * Used by:
 *   - /api/payments/charge (card / ACH / cash / check + settle paths)
 *   - recordOfflinePayment (cash / check direct path)
 *   - /api/tenant/outstanding-charges/[id]/pay (tenant settling open fees)
 *   - /api/cron/journal-payments-backfill (safety net for any path
 *     that misses the synchronous hook)
 *
 * For RENT, delegates to `journalRentPayment` so the existing dedup
 * source ("RENT_PAYMENT") stays consistent and the tenant-portal
 * payments route's prior behaviour is preserved bit-for-bit.
 *
 * For DEPOSIT, delegates to `journalSecurityDeposit` (escrow + liability,
 * not revenue — the deposit isn't earned income until forfeited).
 *
 * For FEE / APPLICATION / other, writes a fresh entry crediting the
 * matching revenue account on the chart.
 *
 * Account selection (chart-of-accounts.ts):
 *   1300 Undeposited Funds — debit side for everything except DEPOSIT
 *   1200 Security Deposit Escrow — debit side for DEPOSIT
 *   2100 Security Deposits Held — credit side for DEPOSIT
 *   4000 Rent Revenue — credit for RENT
 *   4100 Late Fee Income — default credit for FEE
 *   4200 Application Fee Income — credit for APPLICATION + FEE w/ "application" hint
 *   4500 Pet Fee Income — credit for FEE w/ "pet" hint in description
 *   4600 Parking Income — credit for FEE w/ "parking" hint
 *
 * The hint matching is conservative: substring case-insensitive on
 * `payment.description`. Anything that doesn't match falls back to
 * 4100 (Late Fee Income) so revenue is at least booked under the
 * Fee Income subtype.
 */
export async function journalIncomingPayment(paymentId: string) {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      landlordId: true,
      tenantId: true,
      unitId: true,
      amount: true,
      type: true,
      status: true,
      paidAt: true,
      description: true,
      paymentMethod: true,
      surchargeAmount: true,
      unit: {
        select: {
          propertyId: true,
          property: { select: { ownerId: true } },
        },
      },
    },
  });

  if (!payment) return null;
  if (payment.status !== "COMPLETED") return null;

  const pmId = payment.landlordId;
  const date = payment.paidAt ?? new Date();
  const amount = Number(payment.amount);
  const propertyId = payment.unit?.propertyId;
  const ownerId = payment.unit?.property?.ownerId ?? undefined;

  // RENT → reuse existing helper (preserves "RENT_PAYMENT" dedup key
  // so the tenant-portal call site's history stays consistent).
  if (payment.type === "RENT") {
    return journalRentPayment({
      pmId,
      paymentId: payment.id,
      amount,
      convenienceFee: payment.surchargeAmount
        ? Number(payment.surchargeAmount)
        : undefined,
      date,
      propertyId,
      tenantId: payment.tenantId,
      unitId: payment.unitId,
      ownerId,
    });
  }

  // DEPOSIT → escrow + liability, not revenue.
  if (payment.type === "DEPOSIT") {
    return journalSecurityDeposit({
      pmId,
      depositId: payment.id,
      amount,
      date,
      propertyId,
      tenantId: payment.tenantId,
    });
  }

  // FEE / APPLICATION → credit the right Fee Income account.
  // Dedup against "FEE_PAYMENT" / "APPLICATION_PAYMENT" so a future
  // double-fire (cron + sync hook) is safe.
  const source =
    payment.type === "APPLICATION" ? "APPLICATION_PAYMENT" : "FEE_PAYMENT";
  const dup = await alreadyJournaled(pmId, source, payment.id);
  if (dup) return dup;

  let creditAccountCode = "4100"; // default: Late Fee Income
  let creditMemo = "Fee income";
  if (payment.type === "APPLICATION") {
    creditAccountCode = "4200";
    creditMemo = "Application fee income";
  } else if (payment.description) {
    const desc = payment.description.toLowerCase();
    if (desc.includes("application")) {
      creditAccountCode = "4200";
      creditMemo = "Application fee income";
    } else if (desc.includes("pet")) {
      creditAccountCode = "4500";
      creditMemo = "Pet fee income";
    } else if (desc.includes("parking")) {
      creditAccountCode = "4600";
      creditMemo = "Parking income";
    } else if (desc.includes("laundry")) {
      creditAccountCode = "4700";
      creditMemo = "Laundry income";
    }
  }

  return createJournalEntry({
    pmId,
    date,
    memo: payment.description || `${payment.type} payment`,
    type: "AUTO",
    source,
    sourceId: payment.id,
    propertyId,
    lines: [
      {
        accountCode: "1300",
        debit: amount,
        memo: "Payment received",
        tenantId: payment.tenantId,
        unitId: payment.unitId ?? undefined,
        propertyId,
      },
      {
        accountCode: creditAccountCode,
        credit: amount,
        memo: creditMemo,
        propertyId,
        ownerId,
      },
    ],
  });
}

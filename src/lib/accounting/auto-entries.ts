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

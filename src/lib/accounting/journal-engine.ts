import { db } from "@/lib/db";

interface JournalLine {
  accountCode: string;
  debit?: number;
  credit?: number;
  memo?: string;
  propertyId?: string;
  ownerId?: string;
  tenantId?: string;
  unitId?: string;
}

interface CreateJournalEntryParams {
  pmId: string;
  date: Date;
  memo: string;
  type: "AUTO" | "MANUAL" | "ADJUSTMENT" | "REVERSAL" | "CLOSING";
  source?: string;
  sourceId?: string;
  propertyId?: string;
  lines: JournalLine[];
  createdById?: string;
}

/**
 * Create a balanced double-entry journal entry.
 * Throws if debits != credits or period is locked.
 * Updates account balances atomically.
 */
export async function createJournalEntry(params: CreateJournalEntryParams) {
  const totalDebits = params.lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredits = params.lines.reduce((s, l) => s + (l.credit || 0), 0);

  if (Math.abs(totalDebits - totalCredits) > 0.005) {
    throw new Error(
      `Journal entry not balanced. Debits: ${totalDebits.toFixed(2)}, Credits: ${totalCredits.toFixed(2)}`
    );
  }
  if (params.lines.length < 2) {
    throw new Error("Journal entry must have at least 2 lines");
  }

  const period = params.date.toISOString().slice(0, 7);

  const accountingPeriod = await db.accountingPeriod.findUnique({
    where: { pmId_period: { pmId: params.pmId, period } },
  });
  if (accountingPeriod?.status === "LOCKED") {
    throw new Error(`Accounting period ${period} is locked`);
  }

  // Resolve account codes
  const codes = [...new Set(params.lines.map((l) => l.accountCode))];
  const accounts = await db.ledgerAccount.findMany({
    where: { pmId: params.pmId, code: { in: codes }, isActive: true },
    select: { id: true, code: true, normalBalance: true },
  });
  const codeMap = new Map(accounts.map((a) => [a.code, a]));

  for (const code of codes) {
    if (!codeMap.has(code)) throw new Error(`Account code ${code} not found`);
  }

  // Next entry number
  const last = await db.journalEntry.findFirst({
    where: { pmId: params.pmId },
    orderBy: { entryNumber: "desc" },
    select: { entryNumber: true },
  });
  const entryNumber = (last?.entryNumber || 0) + 1;

  return db.$transaction(async (tx) => {
    const entry = await tx.journalEntry.create({
      data: {
        pmId: params.pmId,
        entryNumber,
        date: params.date,
        memo: params.memo,
        type: params.type,
        source: params.source,
        sourceId: params.sourceId,
        propertyId: params.propertyId,
        period,
        createdById: params.createdById,
        lines: {
          create: params.lines.map((line) => {
            const acct = codeMap.get(line.accountCode)!;
            return {
              accountId: acct.id,
              debit: line.debit || 0,
              credit: line.credit || 0,
              memo: line.memo,
              propertyId: line.propertyId || params.propertyId,
              ownerId: line.ownerId,
              tenantId: line.tenantId,
              unitId: line.unitId,
            };
          }),
        },
      },
      include: { lines: true },
    });

    // Update account balances
    for (const line of params.lines) {
      const acct = codeMap.get(line.accountCode)!;
      const change =
        acct.normalBalance === "DEBIT"
          ? (line.debit || 0) - (line.credit || 0)
          : (line.credit || 0) - (line.debit || 0);

      await tx.ledgerAccount.update({
        where: { id: acct.id },
        data: { currentBalance: { increment: change } },
      });
    }

    // Ensure accounting period exists
    await tx.accountingPeriod.upsert({
      where: { pmId_period: { pmId: params.pmId, period } },
      create: {
        pmId: params.pmId,
        period,
        year: params.date.getFullYear(),
        month: params.date.getMonth() + 1,
      },
      update: {},
    });

    return entry;
  });
}

/** Reverse a journal entry (flips debits/credits) */
export async function reverseJournalEntry(
  pmId: string,
  entryId: string,
  memo?: string
) {
  const original = await db.journalEntry.findUnique({
    where: { id: entryId },
    include: { lines: true },
  });

  if (!original || original.pmId !== pmId) throw new Error("Entry not found");
  if (original.isReversed) throw new Error("Already reversed");

  const accountIds = [...new Set(original.lines.map((l) => l.accountId))];
  const accounts = await db.ledgerAccount.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, code: true },
  });
  const idToCode = new Map(accounts.map((a) => [a.id, a.code]));

  const reversalEntry = await createJournalEntry({
    pmId,
    date: new Date(),
    memo: memo || `Reversal of JE #${original.entryNumber}`,
    type: "REVERSAL",
    source: original.source || undefined,
    sourceId: original.sourceId || undefined,
    propertyId: original.propertyId || undefined,
    lines: original.lines.map((line) => ({
      accountCode: idToCode.get(line.accountId) || "",
      debit: line.credit,
      credit: line.debit,
      memo: "Reversal",
      propertyId: line.propertyId || undefined,
      ownerId: line.ownerId || undefined,
      tenantId: line.tenantId || undefined,
      unitId: line.unitId || undefined,
    })),
  });

  await db.journalEntry.update({
    where: { id: entryId },
    data: { isReversed: true },
  });

  return reversalEntry;
}

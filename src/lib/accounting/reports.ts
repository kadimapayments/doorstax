import { db } from "@/lib/db";

interface ReportFilters {
  pmId: string;
  startDate: Date;
  endDate: Date;
  propertyId?: string;
  ownerId?: string;
}

/** Profit & Loss — Revenue minus Expenses for a period */
export async function generateProfitAndLoss(filters: ReportFilters) {
  const lines = await db.journalEntryLine.findMany({
    where: {
      journalEntry: {
        pmId: filters.pmId,
        date: { gte: filters.startDate, lte: filters.endDate },
        isPosted: true,
        isReversed: false,
      },
      ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
      ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
    },
    include: {
      account: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          subType: true,
          normalBalance: true,
        },
      },
    },
  });

  const totals = new Map<
    string,
    {
      account: (typeof lines)[0]["account"];
      totalDebit: number;
      totalCredit: number;
    }
  >();

  for (const line of lines) {
    const e = totals.get(line.accountId);
    if (e) {
      e.totalDebit += line.debit;
      e.totalCredit += line.credit;
    } else {
      totals.set(line.accountId, {
        account: line.account,
        totalDebit: line.debit,
        totalCredit: line.credit,
      });
    }
  }

  const revenue: { code: string | null; name: string; balance: number }[] = [];
  const expenses: { code: string | null; name: string; balance: number }[] = [];

  for (const [, entry] of totals) {
    const balance =
      entry.account.normalBalance === "CREDIT"
        ? entry.totalCredit - entry.totalDebit
        : entry.totalDebit - entry.totalCredit;
    const item = {
      code: entry.account.code,
      name: entry.account.name,
      balance,
    };
    if (entry.account.type === "REVENUE") revenue.push(item);
    else if (entry.account.type === "EXPENSE") expenses.push(item);
  }

  const totalRevenue = revenue.reduce((s, r) => s + r.balance, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.balance, 0);

  return {
    period: {
      start: filters.startDate.toISOString(),
      end: filters.endDate.toISOString(),
    },
    revenue: revenue.sort((a, b) =>
      (a.code || "").localeCompare(b.code || "")
    ),
    totalRevenue,
    expenses: expenses.sort((a, b) =>
      (a.code || "").localeCompare(b.code || "")
    ),
    totalExpenses,
    netIncome: totalRevenue - totalExpenses,
  };
}

/** Balance Sheet — Assets = Liabilities + Equity at a point in time */
export async function generateBalanceSheet(
  pmId: string,
  asOfDate: Date,
  propertyId?: string
) {
  const lines = await db.journalEntryLine.findMany({
    where: {
      journalEntry: {
        pmId,
        date: { lte: asOfDate },
        isPosted: true,
        isReversed: false,
      },
      ...(propertyId ? { propertyId } : {}),
    },
    include: {
      account: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          subType: true,
          normalBalance: true,
        },
      },
    },
  });

  const balances = new Map<
    string,
    { account: (typeof lines)[0]["account"]; balance: number }
  >();

  for (const line of lines) {
    const net =
      line.account.normalBalance === "DEBIT"
        ? line.debit - line.credit
        : line.credit - line.debit;
    const e = balances.get(line.accountId);
    if (e) e.balance += net;
    else balances.set(line.accountId, { account: line.account, balance: net });
  }

  const assets: { code: string | null; name: string; balance: number }[] = [];
  const liabilities: { code: string | null; name: string; balance: number }[] =
    [];
  const equity: { code: string | null; name: string; balance: number }[] = [];

  for (const [, entry] of balances) {
    if (entry.balance === 0) continue;
    const item = {
      code: entry.account.code,
      name: entry.account.name,
      balance: entry.balance,
    };
    if (entry.account.type === "ASSET") assets.push(item);
    else if (entry.account.type === "LIABILITY") liabilities.push(item);
    else if (entry.account.type === "EQUITY") equity.push(item);
  }

  // Add current net income to equity
  const pnl = await generateProfitAndLoss({
    pmId,
    startDate: new Date(asOfDate.getFullYear(), 0, 1),
    endDate: asOfDate,
    propertyId,
  });
  if (pnl.netIncome !== 0) {
    equity.push({
      code: null,
      name: "Net Income (Current Period)",
      balance: pnl.netIncome,
    });
  }

  const sort = (
    a: { code: string | null },
    b: { code: string | null }
  ) => (a.code || "zz").localeCompare(b.code || "zz");
  const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.balance, 0);
  const totalEquity = equity.reduce((s, e) => s + e.balance, 0);

  return {
    asOfDate: asOfDate.toISOString(),
    assets: assets.sort(sort),
    totalAssets,
    liabilities: liabilities.sort(sort),
    totalLiabilities,
    equity: equity.sort(sort),
    totalEquity,
    isBalanced:
      Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  };
}

/** Cash Flow — movements through bank accounts */
export async function generateCashFlow(filters: ReportFilters) {
  const bankAccounts = await db.ledgerAccount.findMany({
    where: {
      pmId: filters.pmId,
      subType: { in: ["BANK", "TRUST_BANK"] },
      isActive: true,
    },
    select: { id: true },
  });

  const lines = await db.journalEntryLine.findMany({
    where: {
      accountId: { in: bankAccounts.map((a) => a.id) },
      journalEntry: {
        pmId: filters.pmId,
        date: { gte: filters.startDate, lte: filters.endDate },
        isPosted: true,
        isReversed: false,
      },
      ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
    },
    include: {
      journalEntry: { select: { source: true, memo: true, date: true } },
    },
    orderBy: { journalEntry: { date: "asc" } },
  });

  let inflows = 0;
  let outflows = 0;
  const details = lines.map((line) => {
    const net = line.debit - line.credit;
    if (net > 0) inflows += net;
    else outflows += Math.abs(net);
    return {
      date: line.journalEntry.date,
      memo: line.journalEntry.memo,
      source: line.journalEntry.source,
      amount: net,
    };
  });

  return {
    period: {
      start: filters.startDate.toISOString(),
      end: filters.endDate.toISOString(),
    },
    inflows,
    outflows,
    netCashChange: inflows - outflows,
    details,
  };
}

/** General Ledger — all transactions for a specific account */
export async function generateGeneralLedger(
  pmId: string,
  accountId: string,
  startDate: Date,
  endDate: Date
) {
  const account = await db.ledgerAccount.findFirst({
    where: { id: accountId, pmId },
  });
  if (!account) throw new Error("Account not found");

  const prior = await db.journalEntryLine.aggregate({
    where: {
      accountId,
      journalEntry: {
        pmId,
        date: { lt: startDate },
        isPosted: true,
        isReversed: false,
      },
    },
    _sum: { debit: true, credit: true },
  });

  const openingBalance =
    account.normalBalance === "DEBIT"
      ? (prior._sum.debit || 0) - (prior._sum.credit || 0)
      : (prior._sum.credit || 0) - (prior._sum.debit || 0);

  const lines = await db.journalEntryLine.findMany({
    where: {
      accountId,
      journalEntry: {
        pmId,
        date: { gte: startDate, lte: endDate },
        isPosted: true,
        isReversed: false,
      },
    },
    include: {
      journalEntry: {
        select: {
          entryNumber: true,
          date: true,
          memo: true,
          source: true,
        },
      },
    },
    orderBy: { journalEntry: { date: "asc" } },
  });

  let running = openingBalance;
  const entries = lines.map((line) => {
    const change =
      account.normalBalance === "DEBIT"
        ? line.debit - line.credit
        : line.credit - line.debit;
    running += change;
    return {
      date: line.journalEntry.date,
      entryNumber: line.journalEntry.entryNumber,
      memo: line.memo || line.journalEntry.memo,
      source: line.journalEntry.source,
      debit: line.debit,
      credit: line.credit,
      balance: running,
    };
  });

  return {
    account: {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
    },
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    openingBalance,
    entries,
    closingBalance: running,
    totalDebits: lines.reduce((s, l) => s + l.debit, 0),
    totalCredits: lines.reduce((s, l) => s + l.credit, 0),
  };
}

/** Rent Roll — units with tenant, rent, and occupancy status */
export async function generateRentRoll(pmId: string) {
  const properties = await db.property.findMany({
    where: { landlordId: pmId },
    include: {
      units: {
        include: {
          tenantProfiles: {
            include: { user: { select: { name: true, email: true } } },
            take: 1,
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const rentRoll: {
    propertyName: string;
    unitNumber: string;
    tenantName: string | null;
    tenantEmail: string | null;
    monthlyRent: number;
    isOccupied: boolean;
    status: string;
  }[] = [];
  let totalMonthlyRent = 0;
  let occupiedUnits = 0;
  let vacantUnits = 0;

  for (const property of properties) {
    for (const unit of property.units) {
      const tenant = unit.tenantProfiles?.[0];
      const isOccupied = !!tenant;
      const rent = Number(unit.rentAmount);

      if (isOccupied) {
        occupiedUnits++;
        totalMonthlyRent += rent;
      } else {
        vacantUnits++;
      }

      rentRoll.push({
        propertyName: property.name,
        unitNumber: unit.unitNumber,
        tenantName: tenant?.user?.name || null,
        tenantEmail: tenant?.user?.email || null,
        monthlyRent: rent,
        isOccupied,
        status: unit.status,
      });
    }
  }

  const total = occupiedUnits + vacantUnits;
  return {
    rentRoll,
    summary: {
      totalUnits: total,
      occupiedUnits,
      vacantUnits,
      occupancyRate: total > 0 ? occupiedUnits / total : 0,
      totalMonthlyRent,
      annualizedRent: totalMonthlyRent * 12,
    },
  };
}

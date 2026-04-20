export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { toCsv, csvResponse } from "@/lib/reports/csv";

/**
 * GET /api/reports/cash-flow
 *
 * Query params:
 *   startDate?  — ISO date (default: 6 months ago)
 *   endDate?    — ISO date (default: today)
 *   propertyId? — scope to a single property
 *   format?     — "csv" | "json"
 *
 * Returns: monthly rollup of completed payments (income) vs expenses.
 * Grouped by YYYY-MM, sorted ascending.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (
    !session?.user ||
    !["PM", "LANDLORD"].includes(session.user.role)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const landlordId = await getEffectiveLandlordId(session.user.id);
  const propertyId = req.nextUrl.searchParams.get("propertyId") || undefined;
  const format = req.nextUrl.searchParams.get("format") || "json";

  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const startDateStr = req.nextUrl.searchParams.get("startDate");
  const endDateStr = req.nextUrl.searchParams.get("endDate");
  const startDate = startDateStr ? new Date(startDateStr) : defaultStart;
  const endDate = endDateStr
    ? new Date(endDateStr)
    : new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [payments, expenses] = await Promise.all([
    db.payment.findMany({
      where: {
        landlordId,
        status: "COMPLETED",
        paidAt: { gte: startDate, lt: endDate },
        ...(propertyId ? { unit: { propertyId } } : {}),
      },
      select: { amount: true, paidAt: true },
    }),
    db.expense.findMany({
      where: {
        landlordId,
        date: { gte: startDate, lt: endDate },
        ...(propertyId ? { propertyId } : {}),
      },
      select: { amount: true, date: true },
    }),
  ]);

  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const byMonth = new Map<string, { income: number; expenses: number }>();

  // Seed every month in range with zeros so the chart doesn't have gaps.
  const seed = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (seed < endDate) {
    byMonth.set(key(seed), { income: 0, expenses: 0 });
    seed.setMonth(seed.getMonth() + 1);
  }

  for (const p of payments) {
    if (!p.paidAt) continue;
    const k = key(new Date(p.paidAt));
    const row = byMonth.get(k) || { income: 0, expenses: 0 };
    row.income += Number(p.amount);
    byMonth.set(k, row);
  }
  for (const e of expenses) {
    const k = key(new Date(e.date));
    const row = byMonth.get(k) || { income: 0, expenses: 0 };
    row.expenses += Number(e.amount);
    byMonth.set(k, row);
  }

  const rows = Array.from(byMonth.entries())
    .map(([month, v]) => ({
      month,
      income: Number(v.income.toFixed(2)),
      expenses: Number(v.expenses.toFixed(2)),
      net: Number((v.income - v.expenses).toFixed(2)),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  if (format === "csv") {
    return csvResponse(
      toCsv(rows),
      `cash-flow-${new Date().toISOString().slice(0, 10)}.csv`
    );
  }

  const totals = rows.reduce(
    (acc, r) => ({
      income: acc.income + r.income,
      expenses: acc.expenses + r.expenses,
      net: acc.net + r.net,
    }),
    { income: 0, expenses: 0, net: 0 }
  );

  return NextResponse.json({
    rows,
    summary: {
      totalIncome: Number(totals.income.toFixed(2)),
      totalExpenses: Number(totals.expenses.toFixed(2)),
      netCashFlow: Number(totals.net.toFixed(2)),
      months: rows.length,
    },
  });
}

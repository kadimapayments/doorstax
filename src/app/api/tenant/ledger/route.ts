import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getLedgerForTenant } from "@/lib/ledger";

export async function GET() {
  const session = await resolveApiSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantProfile = await db.tenantProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      unit: { select: { rentAmount: true, dueDay: true, unitNumber: true, property: { select: { name: true } } } },
    },
  });

  if (!tenantProfile || !tenantProfile.unit) {
    return NextResponse.json({ error: "Tenant profile not found" }, { status: 404 });
  }

  const rent = Number(tenantProfile.unit.rentAmount);
  const splitPercent = tenantProfile.splitPercent;
  const monthlyCharge = rent * splitPercent / 100;

  // Try immutable ledger first
  const ledgerEntries = await getLedgerForTenant(tenantProfile.id);

  if (ledgerEntries.length > 0) {
    // ─── Immutable ledger path ───────────────────────
    // Group entries by periodKey and compute per-period totals
    const periodMap = new Map<string, {
      charge: number;
      paid: number;
      balance: number;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payments: any[];
    }>();

    for (const entry of ledgerEntries) {
      if (!periodMap.has(entry.periodKey)) {
        periodMap.set(entry.periodKey, { charge: 0, paid: 0, balance: 0, payments: [] });
      }
      const period = periodMap.get(entry.periodKey)!;

      if (entry.type === "CHARGE") {
        period.charge += Number(entry.amount);
      } else if (entry.type === "PAYMENT") {
        period.paid += Math.abs(Number(entry.amount)); // amount is negative for payments
      } else if (entry.type === "REVERSAL") {
        // Reversal reduces the paid total
        period.paid -= Number(entry.amount);
      } else if (entry.type === "ADJUSTMENT") {
        const amt = Number(entry.amount);
        if (amt > 0) {
          period.charge += amt; // positive = additional charge
        } else {
          period.paid += Math.abs(amt); // negative = credit
        }
      }

      // Track the latest balance for this period
      period.balance = Number(entry.balanceAfter);
    }

    // Convert to array, format months, sort most recent first
    const ledger = Array.from(periodMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0])) // sort ascending by period key first
      .map(([periodKey, data]) => {
        const [year, mo] = periodKey.split("-").map(Number);
        return {
          month: new Date(year, mo - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
          charge: Math.round(data.charge * 100) / 100,
          paid: Math.round(data.paid * 100) / 100,
          balance: Math.round(data.balance * 100) / 100,
          payments: data.payments,
        };
      })
      .reverse(); // most recent first

    return NextResponse.json({
      unit: tenantProfile.unit.unitNumber,
      property: tenantProfile.unit.property.name,
      monthlyCharge,
      currentBalance: ledgerEntries.length > 0
        ? Number(ledgerEntries[ledgerEntries.length - 1].balanceAfter)
        : 0,
      ledger,
    });
  }

  // ─── Fallback: computed ledger (no ledger entries yet) ───
  const payments = await db.payment.findMany({
    where: { tenantId: tenantProfile.id },
    orderBy: { dueDate: "desc" },
    select: {
      id: true,
      amount: true,
      status: true,
      paidAt: true,
      dueDate: true,
      type: true,
      paymentMethod: true,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fallbackEntries: {
    month: string;
    charge: number;
    paid: number;
    balance: number;
    payments: any[];
  }[] = [];

  const months = new Set<string>();
  const now = new Date();
  const start = tenantProfile.leaseStart || tenantProfile.createdAt;
  const startDate = new Date(start);

  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (cursor <= now) {
    months.add(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  let runningBalance = 0;
  const sortedMonths = Array.from(months).sort();

  for (const monthStr of sortedMonths) {
    const [year, mo] = monthStr.split("-").map(Number);
    const monthStart = new Date(year, mo - 1, 1);
    const monthEnd = new Date(year, mo, 0, 23, 59, 59);

    const monthPayments = payments.filter((p) => {
      const due = new Date(p.dueDate);
      return due >= monthStart && due <= monthEnd;
    });

    const totalPaid = monthPayments
      .filter((p) => p.status === "COMPLETED")
      .reduce((s, p) => s + Number(p.amount), 0);

    runningBalance += monthlyCharge - totalPaid;

    fallbackEntries.push({
      month: new Date(year, mo - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      charge: monthlyCharge,
      paid: totalPaid,
      balance: runningBalance,
      payments: monthPayments.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
    });
  }

  return NextResponse.json({
    unit: tenantProfile.unit.unitNumber,
    property: tenantProfile.unit.property.name,
    monthlyCharge,
    currentBalance: runningBalance,
    ledger: fallbackEntries.reverse(),
  });
}

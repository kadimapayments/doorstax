import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { periodKeyFromDate } from "@/lib/ledger";

/**
 * GET /api/payments/unpaid
 * Returns all active tenants with a positive ledger balance (owing money),
 * enriched with aging data and collection rate metrics.
 * Used by the Unpaid Rent dashboard page and widget.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const now = new Date();
  const currentPeriod = periodKeyFromDate(now);

  // ── Q1: All active tenants for this landlord ──────────────
  const activeTenants = await db.tenantProfile.findMany({
    where: {
      status: "ACTIVE",
      unitId: { not: null },
      unit: { property: { landlordId } },
    },
    select: {
      id: true,
      userId: true,
      splitPercent: true,
      user: { select: { name: true, email: true } },
      unit: {
        select: {
          id: true,
          unitNumber: true,
          rentAmount: true,
          property: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (activeTenants.length === 0) {
    return NextResponse.json({
      summary: {
        totalUnpaid: 0,
        delinquentCount: 0,
        collectionRate: 100,
        totalMonthlyRent: 0,
        buckets: { current: 0, thirtyPlus: 0, sixtyPlus: 0, ninetyPlus: 0 },
      },
      tenants: [],
    });
  }

  const tenantIds = activeTenants.map((t) => t.id);

  // Total monthly rent across all active tenants
  const totalMonthlyRent = activeTenants.reduce((sum, t) => {
    if (!t.unit) return sum;
    return sum + (Number(t.unit.rentAmount) * t.splitPercent) / 100;
  }, 0);

  // ── Q2: Latest ledger entry per tenant (current balance) ──
  const latestEntries = await db.ledgerEntry.findMany({
    where: { tenantId: { in: tenantIds } },
    orderBy: { createdAt: "desc" },
    distinct: ["tenantId"],
    select: { tenantId: true, balanceAfter: true },
  });

  const balanceMap = new Map<string, number>();
  for (const entry of latestEntries) {
    const bal = Number(entry.balanceAfter);
    if (bal > 0) {
      balanceMap.set(entry.tenantId, bal);
    }
  }

  // Filter to delinquent tenants only
  const delinquentTenantIds = Array.from(balanceMap.keys());

  if (delinquentTenantIds.length === 0) {
    return NextResponse.json({
      summary: {
        totalUnpaid: 0,
        delinquentCount: 0,
        collectionRate: 100,
        totalMonthlyRent,
        buckets: { current: 0, thirtyPlus: 0, sixtyPlus: 0, ninetyPlus: 0 },
      },
      tenants: [],
    });
  }

  // ── Q3 + Q4: CHARGE and PAYMENT entries for aging computation ──
  const [chargeEntries, paymentEntries, lastPayments] = await Promise.all([
    db.ledgerEntry.findMany({
      where: { tenantId: { in: delinquentTenantIds }, type: "CHARGE" },
      orderBy: { periodKey: "asc" },
      select: { tenantId: true, periodKey: true, amount: true },
    }),
    db.ledgerEntry.findMany({
      where: { tenantId: { in: delinquentTenantIds }, type: "PAYMENT" },
      select: { tenantId: true, periodKey: true, amount: true },
    }),
    // ── Q5: Last payment date per delinquent tenant ──
    db.ledgerEntry.findMany({
      where: { tenantId: { in: delinquentTenantIds }, type: "PAYMENT" },
      orderBy: { createdAt: "desc" },
      distinct: ["tenantId"],
      select: { tenantId: true, createdAt: true },
    }),
  ]);

  // Build payment totals per tenant per period
  // PAYMENT amounts are stored as negative (credits), so negate to get positive paid amount
  const paymentsByTenantPeriod = new Map<string, Map<string, number>>();
  for (const entry of paymentEntries) {
    let tenantMap = paymentsByTenantPeriod.get(entry.tenantId);
    if (!tenantMap) {
      tenantMap = new Map();
      paymentsByTenantPeriod.set(entry.tenantId, tenantMap);
    }
    const current = tenantMap.get(entry.periodKey) || 0;
    tenantMap.set(entry.periodKey, current + Math.abs(Number(entry.amount)));
  }

  // Build charges per tenant per period
  const chargesByTenantPeriod = new Map<string, { periodKey: string; amount: number }[]>();
  for (const entry of chargeEntries) {
    let charges = chargesByTenantPeriod.get(entry.tenantId);
    if (!charges) {
      charges = [];
      chargesByTenantPeriod.set(entry.tenantId, charges);
    }
    charges.push({ periodKey: entry.periodKey, amount: Number(entry.amount) });
  }

  // Build last payment date map
  const lastPaymentMap = new Map<string, Date>();
  for (const entry of lastPayments) {
    lastPaymentMap.set(entry.tenantId, entry.createdAt);
  }

  // ── Compute aging per tenant ──────────────────────────────
  function monthsDiff(periodA: string, periodB: string): number {
    const [ay, am] = periodA.split("-").map(Number);
    const [by, bm] = periodB.split("-").map(Number);
    return (by - ay) * 12 + (bm - am);
  }

  function computeAgingBucket(
    monthsOverdue: number
  ): "CURRENT" | "30_PLUS" | "60_PLUS" | "90_PLUS" {
    if (monthsOverdue <= 0) return "CURRENT";
    if (monthsOverdue === 1) return "30_PLUS";
    if (monthsOverdue === 2) return "60_PLUS";
    return "90_PLUS";
  }

  function findOldestUnpaidPeriod(tenantId: string): string {
    const charges = chargesByTenantPeriod.get(tenantId) || [];
    const payments = paymentsByTenantPeriod.get(tenantId) || new Map();

    // Walk charges from oldest to newest
    for (const charge of charges) {
      const paid = payments.get(charge.periodKey) || 0;
      if (charge.amount > paid) {
        return charge.periodKey;
      }
    }

    // Fallback — balance > 0 but no unpaid CHARGE found (manual adjustment)
    return currentPeriod;
  }

  // ── Build response rows ───────────────────────────────────
  const tenantMap = new Map(activeTenants.map((t) => [t.id, t]));

  const buckets = { current: 0, thirtyPlus: 0, sixtyPlus: 0, ninetyPlus: 0 };
  let totalUnpaid = 0;

  const tenantRows = delinquentTenantIds
    .map((tenantId) => {
      const tenant = tenantMap.get(tenantId);
      if (!tenant || !tenant.unit) return null;

      const balance = balanceMap.get(tenantId) || 0;
      const monthlyRent =
        (Number(tenant.unit.rentAmount) * tenant.splitPercent) / 100;
      const lastPaymentDate = lastPaymentMap.get(tenantId) || null;
      const oldestUnpaidPeriod = findOldestUnpaidPeriod(tenantId);
      const monthsOverdue = monthsDiff(oldestUnpaidPeriod, currentPeriod);
      const agingBucket = computeAgingBucket(monthsOverdue);
      const daysOverdue = monthsOverdue * 30;

      totalUnpaid += balance;

      switch (agingBucket) {
        case "CURRENT":
          buckets.current++;
          break;
        case "30_PLUS":
          buckets.thirtyPlus++;
          break;
        case "60_PLUS":
          buckets.sixtyPlus++;
          break;
        case "90_PLUS":
          buckets.ninetyPlus++;
          break;
      }

      return {
        tenantId,
        userId: tenant.userId,
        name: tenant.user?.name || "Unknown",
        email: tenant.user?.email || "",
        propertyId: tenant.unit.property?.id || "",
        propertyName: tenant.unit.property?.name || "",
        unitId: tenant.unit.id,
        unitNumber: tenant.unit.unitNumber,
        balance,
        monthlyRent,
        lastPaymentDate: lastPaymentDate?.toISOString() || null,
        oldestUnpaidPeriod,
        monthsOverdue,
        agingBucket,
        daysOverdue,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.balance - a!.balance);

  const collectionRate =
    totalMonthlyRent > 0
      ? Math.round(((totalMonthlyRent - totalUnpaid) / totalMonthlyRent) * 10000) / 100
      : 100;

  return NextResponse.json({
    summary: {
      totalUnpaid,
      delinquentCount: tenantRows.length,
      collectionRate: Math.max(0, Math.min(100, collectionRate)),
      totalMonthlyRent,
      buckets,
    },
    tenants: tenantRows,
  });
}

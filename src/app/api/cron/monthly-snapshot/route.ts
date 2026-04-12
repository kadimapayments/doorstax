import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTier, calculateTieredPrice } from "@/lib/residual-tiers";

/**
 * Monthly snapshot cron — runs 1st of each month at 01:00 UTC.
 *
 * Captures the previous month's key metrics for every PM with a
 * subscription. These snapshots are immutable — they freeze the state
 * of the period forever. Current-month data is always computed live.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const period = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  const periodStart = prev;
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  // All PMs with subscriptions
  const pms = await db.user.findMany({
    where: { role: "PM", subscription: { isNot: null } },
    select: { id: true },
  });

  let created = 0;
  let skipped = 0;

  for (const pm of pms) {
    // Skip if snapshot already exists
    const existing = await db.monthlySnapshot.findUnique({
      where: { pmId_period: { pmId: pm.id, period } },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const unitCount = await db.unit.count({
      where: { property: { landlordId: pm.id } },
    });
    const tier = getTier(unitCount);
    const subscriptionAmount = calculateTieredPrice(unitCount);

    // Card volume
    const cardAgg = await db.payment.aggregate({
      where: {
        landlordId: pm.id,
        status: "COMPLETED",
        paymentMethod: "card",
        createdAt: { gte: periodStart, lte: periodEnd },
      },
      _sum: { amount: true },
    });
    const cardVolume = Number(cardAgg._sum.amount || 0);

    // ACH count
    const achCount = await db.payment.count({
      where: {
        landlordId: pm.id,
        status: "COMPLETED",
        paymentMethod: "ach",
        createdAt: { gte: periodStart, lte: periodEnd },
      },
    });

    const cardRevenue = cardVolume * tier.platformCardRate;
    const achRevenue = achCount * tier.platformAchCost;
    const grossRevenue = subscriptionAmount + cardRevenue + achRevenue;
    const pmPayout = cardVolume * tier.cardRate; // Simplified — PM's card residuals
    const netRevenue = grossRevenue - pmPayout;

    await db.monthlySnapshot.create({
      data: {
        pmId: pm.id,
        period,
        unitCount,
        tierName: tier.name,
        subscriptionAmount,
        cardVolume,
        achTransactions: achCount,
        cardRevenue,
        achRevenue,
        grossRevenue,
        pmPayout,
        netRevenue,
      },
    });
    created++;
  }

  return NextResponse.json({
    period,
    pmsProcessed: pms.length,
    created,
    skipped,
  });
}

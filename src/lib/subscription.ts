import { db } from "@/lib/db";
import { calculateTieredPrice } from "@/lib/residual-tiers";

/**
 * Calculate monthly price using graduated tiered pricing.
 * $150 base (includes 50 units), then graduated per-unit cost:
 *   Units 51–99:   $3.00/unit
 *   Units 100–499: $2.50/unit
 *   Units 500–999: $2.00/unit
 *   Units 1000+:   $1.50/unit
 */
export function calculateMonthlyPrice(unitCount: number): number {
  return calculateTieredPrice(unitCount);
}

/** Sync subscription amount based on current unit count */
export async function syncSubscriptionAmount(userId: string) {
  const sub = await db.subscription.findUnique({ where: { userId } });
  if (!sub) return;

  const unitCount = await db.unit.count({
    where: { property: { landlordId: userId } },
  });
  const newAmount = calculateMonthlyPrice(unitCount);

  await db.subscription.update({
    where: { userId },
    data: {
      buildingCount: unitCount,
      currentAmount: newAmount,
    },
  });
}

/** Create a new subscription with 14-day trial */
export async function createSubscription(userId: string) {
  const unitCount = await db.unit.count({
    where: { property: { landlordId: userId } },
  });
  const amount = calculateMonthlyPrice(unitCount);
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 14);
  const nextBilling = new Date(trialEnd);

  return db.subscription.create({
    data: {
      userId,
      status: "TRIALING",
      buildingCount: unitCount,
      currentAmount: amount,
      nextBillingDate: nextBilling,
      trialEndsAt: trialEnd,
    },
  });
}

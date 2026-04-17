/**
 * Tier-aware platform revenue calculation.
 *
 * Shared between the admin overview and the full /admin/residuals report so
 * both pages show the SAME numbers. The card-margin and ACH-fee model come
 * from the residual-tiers source of truth.
 *
 * Revenue streams:
 *   1. Card processing margin — tenants pay 3.25% surcharge. After
 *      interchange, brand assessment, per-txn cost, bank revenue share,
 *      and the PM's card residual (tier-specific), DoorStax keeps the rest.
 *   2. ACH platform fee — tier-specific per transaction:
 *        Starter $6 · Growth $4 · Scale $3 · Enterprise $2
 *      Actual Kadima cost ≈ $0.50/tx; the difference is net platform ACH.
 *   3. Software subscriptions — graduated per-unit pricing via
 *      calculateTieredPrice(). Counted only for ACTIVE / TRIALING subs.
 */

import { db } from "@/lib/db";
import { getTier, calculateTieredPrice } from "@/lib/residual-tiers";

/** Card processing model — matches /admin/residuals page */
export const CARD_MODEL = {
  tenantRate: 0.0325, // 3.25% surcharge charged to tenant
  interchangeBlended: 0.0185, // blended interchange estimate
  brandAssessment: 0.0014, // card brand / network fees
  perTxnFee: 0.1, // flat $0.10 per card txn
  bankSharePct: 0.3, // 30% of gross margin goes to bank partner
} as const;

/** Kadima's per-ACH processing cost */
export const ACH_ACTUAL_COST = 0.5;

export interface PlatformRevenue {
  /** DoorStax net card processing margin (after interchange, brand, per-txn, bank share, PM residual) */
  cardRevenue: number;
  /** DoorStax net ACH revenue (tier-specific fees collected minus Kadima cost) */
  achRevenue: number;
  /** Monthly recurring software subscription revenue (active/trialing PMs only) */
  softwareMRR: number;
  /** Sum of the three streams */
  totalRevenue: number;
  /** Total gross card volume processed */
  totalCardVolume: number;
  /** Total PM card residuals paid out (reference / transparency) */
  totalPmCardPayout: number;
  /** Count of completed card transactions */
  cardTxCount: number;
  /** Count of completed ACH transactions */
  achTxCount: number;
}

interface CalcArgs {
  /** If provided, only count payments with paidAt >= this date */
  from?: Date;
  /** If provided, only count payments with paidAt <= this date */
  to?: Date;
}

/**
 * Compute DoorStax platform revenue with proper per-PM tier lookup.
 *
 * Uses live unit counts to classify each PM into a tier, then applies
 * the right platformAchCost and cardRate per payment.
 */
export async function calculatePlatformRevenue(
  args: CalcArgs = {}
): Promise<PlatformRevenue> {
  const { from, to } = args;
  const paidAtFilter: Record<string, Date> = {};
  if (from) paidAtFilter.gte = from;
  if (to) paidAtFilter.lte = to;
  const hasDateFilter = Object.keys(paidAtFilter).length > 0;

  // Pull all completed card + ACH payments in the window, plus each payment's
  // landlord (PM). We need per-PM grouping because the ACH fee and card
  // residual rate are both tier-specific.
  const payments = await db.payment.findMany({
    where: {
      status: "COMPLETED",
      paymentMethod: { in: ["card", "ach"] },
      ...(hasDateFilter ? { paidAt: paidAtFilter } : {}),
    },
    select: {
      amount: true,
      paymentMethod: true,
      landlordId: true,
    },
  });

  // Landlord unit counts — used to look up each PM's tier.
  const landlords = await db.user.findMany({
    where: { role: "PM" },
    select: {
      id: true,
      properties: {
        select: { units: { select: { id: true } } },
      },
    },
  });
  const unitCountByPm = new Map<string, number>();
  for (const ll of landlords) {
    const units = ll.properties.reduce((s, p) => s + p.units.length, 0);
    unitCountByPm.set(ll.id, units);
  }

  let totalCardVolume = 0;
  let totalCardCollected = 0; // surcharge from tenants
  let totalInterchange = 0;
  let totalBrandFees = 0;
  let totalPerTxn = 0;
  let totalBankShare = 0;
  let totalPmCardPayout = 0;
  let totalAchCollected = 0; // platform ACH fee (tier-specific) summed
  let cardTxCount = 0;
  let achTxCount = 0;

  for (const p of payments) {
    const amount = Number(p.amount);
    const units = unitCountByPm.get(p.landlordId) ?? 0;
    const tier = getTier(units);

    if (p.paymentMethod === "card") {
      totalCardVolume += amount;
      cardTxCount += 1;
      const surcharge = amount * CARD_MODEL.tenantRate;
      const interchange = amount * CARD_MODEL.interchangeBlended;
      const brandFees = amount * CARD_MODEL.brandAssessment;
      const perTxn = CARD_MODEL.perTxnFee;
      const grossMargin = surcharge - interchange - brandFees - perTxn;
      const bankShare = Math.max(0, grossMargin) * CARD_MODEL.bankSharePct;
      const pmResidual = amount * tier.cardRate;

      totalCardCollected += surcharge;
      totalInterchange += interchange;
      totalBrandFees += brandFees;
      totalPerTxn += perTxn;
      totalBankShare += bankShare;
      totalPmCardPayout += pmResidual;
    } else {
      // ACH
      achTxCount += 1;
      totalAchCollected += tier.platformAchCost;
    }
  }

  const cardRevenue =
    totalCardCollected -
    totalInterchange -
    totalBrandFees -
    totalPerTxn -
    totalBankShare -
    totalPmCardPayout;
  const achRevenue = totalAchCollected - achTxCount * ACH_ACTUAL_COST;

  // Software MRR — sum of active/trialing subscriptions.
  const subsAgg = await db.subscription.aggregate({
    where: { status: { in: ["ACTIVE", "TRIALING"] } },
    _sum: { currentAmount: true },
  });
  const subTotal = Number(subsAgg._sum.currentAmount || 0);

  // If subscription.currentAmount is missing for some PMs, recompute live from
  // tiered price — guarantees we never show $0 when there actually are active
  // PMs whose currentAmount wasn't backfilled.
  let softwareMRR = subTotal;
  if (softwareMRR === 0 && landlords.length > 0) {
    softwareMRR = 0;
    for (const ll of landlords) {
      const units = unitCountByPm.get(ll.id) ?? 0;
      softwareMRR += calculateTieredPrice(units);
    }
  }

  return {
    cardRevenue: Math.max(0, cardRevenue),
    achRevenue: Math.max(0, achRevenue),
    softwareMRR,
    totalRevenue:
      Math.max(0, cardRevenue) + Math.max(0, achRevenue) + softwareMRR,
    totalCardVolume,
    totalPmCardPayout,
    cardTxCount,
    achTxCount,
  };
}

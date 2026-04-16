/**
 * PM Residual Tier Structure
 *
 * Starter (0–99 units): NO PAYMENT MONETIZATION
 *   - Tenant pays $6.00 ACH (fixed), platform takes all $6
 *   - Card: tenant pays 3.25%, platform takes 3.25%, PM earns 0%
 *   - Fee schedule: PM can ONLY adjust management % and expenses
 *   - Payment processing fields (ACH rate, card rate, who pays) LOCKED
 *
 * Growth (100–499): Monetization unlocked
 *   - Platform ACH cost: $4.00, PM earns spread above $4
 *   - Card: platform takes 3.00%, PM earns 0.25%
 *
 * Scale (500–999): Better rates
 *   - Platform ACH cost: $3.00
 *   - Card: platform takes 2.95%, PM earns 0.30%
 *
 * Enterprise (1000+): Best rates
 *   - Platform ACH cost: $2.00
 *   - Card: platform takes 2.90%, PM earns 0.35%
 *
 * Subscription (graduated, unchanged):
 *   $150 base (first 50 units)
 *   51–99: $3.00/unit, 100–499: $2.50/unit,
 *   500–999: $2.00/unit, 1000+: $1.50/unit
 */

export interface ResidualTier {
  name: string;
  minUnits: number;
  maxUnits: number | null;
  achPayout: number;
  cardRate: number;
  perUnitCost: number;
  platformAchCost: number;
  platformCardRate: number;
  tenantAchRate: number | null;
  feeScheduleLocked: boolean;
}

/** @deprecated Use getTier(unitCount).platformAchCost instead */
export const PLATFORM_ACH_COST = 6.0;

export const RESIDUAL_TIERS: ResidualTier[] = [
  {
    name: "Starter",
    minUnits: 0,
    maxUnits: 99,
    achPayout: 0,
    cardRate: 0,
    perUnitCost: 3.0,
    platformAchCost: 6.0,
    platformCardRate: 0.0325,
    tenantAchRate: 6.0,
    feeScheduleLocked: true,
  },
  {
    name: "Growth",
    minUnits: 100,
    maxUnits: 499,
    achPayout: 0,
    cardRate: 0.0025,
    perUnitCost: 2.5,
    platformAchCost: 4.0,
    platformCardRate: 0.03,
    tenantAchRate: null,
    feeScheduleLocked: false,
  },
  {
    name: "Scale",
    minUnits: 500,
    maxUnits: 999,
    achPayout: 0,
    cardRate: 0.003,
    perUnitCost: 2.0,
    platformAchCost: 3.0,
    platformCardRate: 0.0295,
    tenantAchRate: null,
    feeScheduleLocked: false,
  },
  {
    name: "Enterprise",
    minUnits: 1000,
    maxUnits: null,
    achPayout: 0,
    cardRate: 0.0035,
    perUnitCost: 1.5,
    platformAchCost: 2.0,
    platformCardRate: 0.029,
    tenantAchRate: null,
    feeScheduleLocked: false,
  },
];

/** Look up the tier for a given unit count */
export function getTier(unitCount: number): ResidualTier {
  for (let i = RESIDUAL_TIERS.length - 1; i >= 0; i--) {
    if (unitCount >= RESIDUAL_TIERS[i].minUnits) {
      return RESIDUAL_TIERS[i];
    }
  }
  return RESIDUAL_TIERS[0];
}

/** Check if a PM can customize payment processing fees */
export function canCustomizePaymentFees(unitCount: number): boolean {
  return !getTier(unitCount).feeScheduleLocked;
}

/** Format card rate as percentage string (e.g. "0.25%") */
export function formatCardRate(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

/** Get the next tier for a given unit count, or null if already at max */
export function getNextTier(unitCount: number): ResidualTier | null {
  const current = getTier(unitCount);
  const idx = RESIDUAL_TIERS.indexOf(current);
  return idx < RESIDUAL_TIERS.length - 1 ? RESIDUAL_TIERS[idx + 1] : null;
}

/** Get the PM's per-unit subscription cost at their tier level */
export function getPerUnitCost(unitCount: number): number {
  const tier = getTier(unitCount);
  return tier.perUnitCost;
}

/**
 * Calculate monthly subscription price using graduated tiered pricing.
 * Base: $150 covers first 50 units.
 * Units 51–99:   $3.00/unit
 * Units 100–499: $2.50/unit
 * Units 500–999: $2.00/unit
 * Units 1000+:   $1.50/unit
 */
export function calculateTieredPrice(unitCount: number): number {
  const base = 150;
  const additionalUnits = Math.max(0, unitCount - 50);

  if (additionalUnits === 0) return base;

  let cost = base;
  const bracket1Units = Math.min(additionalUnits, 49);
  cost += bracket1Units * 3.0;
  const bracket2Units = Math.min(Math.max(0, additionalUnits - 49), 400);
  cost += bracket2Units * 2.5;
  const bracket3Units = Math.min(Math.max(0, additionalUnits - 449), 500);
  cost += bracket3Units * 2.0;
  const bracket4Units = Math.max(0, additionalUnits - 949);
  cost += bracket4Units * 1.5;
  return cost;
}

/* ── Agent Kickback Rates ──────────────────────────── */

/**
 * Flat per-transacting-unit kickback paid to agents.
 * Only units with at least one COMPLETED payment that month count.
 */
export const AGENT_KICKBACK_RATES: Record<string, number> = {
  Starter: 2.5,
  Growth: 2.0,
  Scale: 1.5,
  Enterprise: 1.0,
};

/**
 * Resolve the kickback rate for a given PM tier.
 *
 * If `customRates` is provided and contains a non-negative number for the
 * given tier, that overrides the default. This lets admins configure
 * per-agent custom rates via the invite / update-commission flow.
 */
export function getAgentKickback(
  tierName: string,
  customRates?: Record<string, number> | null
): number {
  if (
    customRates &&
    typeof customRates[tierName] === "number" &&
    customRates[tierName] >= 0
  ) {
    return customRates[tierName];
  }
  return AGENT_KICKBACK_RATES[tierName] ?? 2.5;
}

/**
 * Check if a PM crossed a tier boundary, persists the new tier, and
 * returns the old/new tier for notification. Returns null if no change.
 */
export async function checkTierCrossing(pmId: string): Promise<{
  previousTier: ResidualTier;
  newTier: ResidualTier;
  unitCount: number;
} | null> {
  const { db } = await import("@/lib/db");

  const unitCount = await db.unit.count({
    where: { property: { landlordId: pmId } },
  });
  const newTier = getTier(unitCount);

  const user = await db.user.findUnique({
    where: { id: pmId },
    select: { currentTier: true },
  });
  const previousTierName = user?.currentTier || "Starter";

  if (newTier.name !== previousTierName) {
    await db.user.update({
      where: { id: pmId },
      data: { currentTier: newTier.name },
    });
    const previousTier =
      RESIDUAL_TIERS.find((t) => t.name === previousTierName) ??
      RESIDUAL_TIERS[0];
    return { previousTier, newTier, unitCount };
  }
  return null;
}

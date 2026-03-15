/**
 * PM Residual Tier Structure
 *
 * Residuals only activate at 100+ units.
 * Below 100 units, PMs earn nothing.
 *
 * Subscription pricing and platform ACH costs also scale by tier.
 */

export interface ResidualTier {
  name: string;
  minUnits: number;
  maxUnits: number | null; // null = unlimited
  achPayout: number; // $ per ACH transaction paid to PM
  cardRate: number; // % of card transaction paid to PM (e.g. 0.0025 = 0.25%)
  perUnitCost: number; // $ per unit per month for subscription (graduated)
  platformAchCost: number; // $ platform earns per ACH transaction
}

/** DoorStax flat ACH cost — PM earns the spread above this */
export const PLATFORM_ACH_COST = 2.00;

export const RESIDUAL_TIERS: ResidualTier[] = [
  {
    name: "Starter",
    minUnits: 0,
    maxUnits: 99,
    achPayout: 0,       // PM earns the difference (achRate - $2.00)
    cardRate: 0,
    perUnitCost: 3.0,
    platformAchCost: 2.0,
  },
  {
    name: "Growth",
    minUnits: 100,
    maxUnits: 499,
    achPayout: 0,       // PM earns the difference (achRate - $2.00)
    cardRate: 0.0025, // 0.25%
    perUnitCost: 2.5,
    platformAchCost: 2.0,
  },
  {
    name: "Scale",
    minUnits: 500,
    maxUnits: 999,
    achPayout: 0,       // PM earns the difference (achRate - $2.00)
    cardRate: 0.003, // 0.30%
    perUnitCost: 2.0,
    platformAchCost: 2.0,
  },
  {
    name: "Enterprise",
    minUnits: 1000,
    maxUnits: null,
    achPayout: 0,       // PM earns the difference (achRate - $2.00)
    cardRate: 0.0035, // 0.35%
    perUnitCost: 1.5,
    platformAchCost: 2.0,
  },
];

/** Look up the tier for a given unit count */
export function getTier(unitCount: number): ResidualTier {
  for (let i = RESIDUAL_TIERS.length - 1; i >= 0; i--) {
    if (unitCount >= RESIDUAL_TIERS[i].minUnits) {
      return RESIDUAL_TIERS[i];
    }
  }
  return RESIDUAL_TIERS[0]; // Starter fallback
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
  const base = 150; // covers first 50 units
  const additionalUnits = Math.max(0, unitCount - 50);

  if (additionalUnits === 0) return base;

  let cost = base;

  // Bracket 1: units 51-99 (up to 49 units at $3)
  const bracket1Units = Math.min(additionalUnits, 49);
  cost += bracket1Units * 3.0;

  // Bracket 2: units 100-499 (up to 400 units at $2.50)
  const bracket2Units = Math.min(Math.max(0, additionalUnits - 49), 400);
  cost += bracket2Units * 2.5;

  // Bracket 3: units 500-999 (up to 500 units at $2.00)
  const bracket3Units = Math.min(Math.max(0, additionalUnits - 449), 500);
  cost += bracket3Units * 2.0;

  // Bracket 4: units 1000+ (remaining at $1.50)
  const bracket4Units = Math.max(0, additionalUnits - 949);
  cost += bracket4Units * 1.5;

  return cost;
}

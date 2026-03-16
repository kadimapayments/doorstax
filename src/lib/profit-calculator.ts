/**
 * PM Potential Profit Calculator — pure calculation functions.
 *
 * Revenue sources:
 *   1. Card processing residuals (% of card volume)
 *   2. ACH spread (PM charges tenant $X, platform costs $2 → PM keeps the spread)
 *   3. Late fees
 *   4. Ancillary income (optional misc revenue)
 *
 * Costs:
 *   1. Software/platform cost per unit
 */

export interface CalculatorInputs {
  units: number;
  avgRent: number;
  occupancyPct: number; // 0-100
  achPct: number; // 0-100, % of payments via ACH
  cardPct: number; // 0-100, % of payments via card
  autopayPct: number; // 0-100, % of tenants on autopay
  softwareCostPerUnit: number;
  cardFeeRate: number; // e.g., 0.25 meaning 0.25%
  achFeePerTx: number; // PM spread per ACH tx (after platform cost)
  lateFeePerUnit: number; // avg late fee revenue per unit/month
  ancillaryIncome: number; // monthly misc revenue
}

export interface CalculatorOutput {
  occupiedUnits: number;
  totalRentRoll: number;
  achVolume: number;
  cardVolume: number;
  achTxCount: number;
  cardTxCount: number;
  cardRevenue: number;
  achRevenue: number;
  lateFeeRevenue: number;
  ancillaryRevenue: number;
  monthlyGrossRevenue: number;
  monthlySoftwareCost: number;
  monthlyNetRevenue: number;
  annualNetRevenue: number;
  breakEvenUnits: number;
  softwareCostOffset: number; // how much of software cost is covered
}

export function calculateProfit(inputs: CalculatorInputs): CalculatorOutput {
  const {
    units,
    avgRent,
    occupancyPct,
    achPct,
    cardPct,
    autopayPct,
    softwareCostPerUnit,
    cardFeeRate,
    achFeePerTx,
    lateFeePerUnit,
    ancillaryIncome,
  } = inputs;

  const occupiedUnits = Math.round(units * (occupancyPct / 100));
  const totalRentRoll = occupiedUnits * avgRent;

  // Payment volume splits
  const payingUnits = Math.round(occupiedUnits * (autopayPct / 100));
  const achTxCount = Math.round(payingUnits * (achPct / 100));
  const cardTxCount = Math.round(payingUnits * (cardPct / 100));
  const achVolume = achTxCount * avgRent;
  const cardVolume = cardTxCount * avgRent;

  // Revenue calculations
  const cardRevenue = cardVolume * (cardFeeRate / 100);
  const achRevenue = achTxCount * achFeePerTx;
  const lateFeeRevenue = occupiedUnits * lateFeePerUnit;
  const ancillaryRevenue = ancillaryIncome;

  const monthlyGrossRevenue =
    cardRevenue + achRevenue + lateFeeRevenue + ancillaryRevenue;

  const monthlySoftwareCost = units * softwareCostPerUnit;
  const monthlyNetRevenue = monthlyGrossRevenue - monthlySoftwareCost;
  const annualNetRevenue = monthlyNetRevenue * 12;

  // Break-even: units where revenue = software cost
  // Revenue per unit = (cardRevPerUnit + achRevPerUnit + lateFee)
  const revPerUnit =
    occupiedUnits > 0 ? (monthlyGrossRevenue - ancillaryIncome) / occupiedUnits : 0;
  const breakEvenUnits =
    revPerUnit > softwareCostPerUnit
      ? Math.ceil(softwareCostPerUnit / (revPerUnit - softwareCostPerUnit + softwareCostPerUnit)) // simplified
      : 0;

  // Software cost offset percentage
  const softwareCostOffset =
    monthlySoftwareCost > 0
      ? Math.min(100, (monthlyGrossRevenue / monthlySoftwareCost) * 100)
      : 0;

  return {
    occupiedUnits,
    totalRentRoll,
    achVolume,
    cardVolume,
    achTxCount,
    cardTxCount,
    cardRevenue,
    achRevenue,
    lateFeeRevenue,
    ancillaryRevenue,
    monthlyGrossRevenue,
    monthlySoftwareCost,
    monthlyNetRevenue,
    annualNetRevenue,
    breakEvenUnits: Math.max(1, breakEvenUnits),
    softwareCostOffset,
  };
}

/** Preset configurations */
export const PRESETS = {
  conservative: {
    label: "Conservative",
    values: {
      occupancyPct: 85,
      achPct: 50,
      cardPct: 15,
      autopayPct: 30,
      softwareCostPerUnit: 3,
      cardFeeRate: 0.25,
      achFeePerTx: 4,
      lateFeePerUnit: 2,
      ancillaryIncome: 0,
    },
  },
  expected: {
    label: "Expected",
    values: {
      occupancyPct: 92,
      achPct: 65,
      cardPct: 25,
      autopayPct: 55,
      softwareCostPerUnit: 3,
      cardFeeRate: 0.25,
      achFeePerTx: 4,
      lateFeePerUnit: 5,
      ancillaryIncome: 0,
    },
  },
  aggressive: {
    label: "Aggressive",
    values: {
      occupancyPct: 97,
      achPct: 75,
      cardPct: 20,
      autopayPct: 75,
      softwareCostPerUnit: 3,
      cardFeeRate: 0.25,
      achFeePerTx: 4,
      lateFeePerUnit: 8,
      ancillaryIncome: 0,
    },
  },
} as const;

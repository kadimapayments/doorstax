/**
 * PM Profit Calculator — auto-adjusting with tier structure.
 *
 * Revenue sources for PM:
 *   1. Card processing residuals (tier-based % of card volume)
 *   2. ACH spread (PM charges $X, platform costs tier-specific → PM keeps spread)
 *   3. Management fees (from rent collected, not DoorStax)
 *
 * Late fees are EXCLUDED from profit calculations.
 *
 * DoorStax revenue:
 *   1. Card: 3.25% collected - interchange (~1.99%) - 30% bank share - PM residual
 *   2. ACH: tier platform rate - $0.50 actual cost
 *   3. Software subscription (graduated pricing)
 */

import {
  calculateTieredPrice,
  getTier,
  RESIDUAL_TIERS,
  type ResidualTier,
} from "./residual-tiers";

export interface CalculatorInputs {
  units: number;
  avgRent: number;
  occupancyPct: number;
  cardPct: number;
  pmAchRate: number;
  mgmtFeePct: number;
  achPayer: "tenant" | "owner";
  currentSoftwareCost: number; // What they pay now for existing PM software
}

export interface CalculatorOutput {
  tier: ResidualTier;
  occupiedUnits: number;
  monthlyRentVolume: number;
  cardPayments: number;
  achPayments: number;
  cardVolume: number;
  // PM
  softwareCost: number;
  pmCardEarnings: number;
  pmAchSpread: number;
  pmAchEarnings: number;
  totalPmPaymentEarnings: number;
  pmNetCostOrProfit: number;
  pmPaymentsCoverSoftware: boolean;
  mgmtFeeEarnings: number;
  pmTotalNetIncome: number;
  // Software savings
  currentSoftwareCost: number;
  softwareSavings: number; // currentSoftwareCost - DoorStax softwareCost (positive = saving)
  totalSavingsAndEarnings: number; // softwareSavings + totalPmPaymentEarnings
  // DoorStax
  grossCardCollected: number;
  cardCosts: number;
  cardMargin: number;
  bankShare: number;
  doorstaxCardNet: number;
  doorstaxAchCollected: number;
  doorstaxAchCost: number;
  doorstaxAchNet: number;
  doorstaxSoftware: number;
  doorstaxNet: number;
}

const CARD_TENANT_RATE = 0.0325;
const INTERCHANGE_BLENDED = 0.0199;
const BANK_SHARE_PCT = 0.3;
const ACH_ACTUAL_COST = 0.5;

export function calculateProfit(inputs: CalculatorInputs): CalculatorOutput {
  const {
    units,
    avgRent,
    occupancyPct,
    cardPct,
    pmAchRate,
    mgmtFeePct,
    achPayer,
    currentSoftwareCost = 0,
  } = inputs;

  const tier = getTier(units);
  const occupiedUnits = Math.round(units * (occupancyPct / 100));
  const achPct = 100 - cardPct;
  const monthlyRentVolume = occupiedUnits * avgRent;
  const cardPayments = Math.round(occupiedUnits * (cardPct / 100));
  const achPayments = Math.round(occupiedUnits * (achPct / 100));
  const cardVolume = cardPayments * avgRent;

  // PM earnings
  const softwareCost = calculateTieredPrice(units);
  const pmCardEarnings = cardVolume * tier.cardRate;
  const pmAchSpread = Math.max(0, pmAchRate - tier.platformAchCost);
  const pmAchEarnings = achPayer === "tenant" ? achPayments * pmAchSpread : 0;
  const totalPmPaymentEarnings = pmCardEarnings + pmAchEarnings;
  const pmNetCostOrProfit = totalPmPaymentEarnings - softwareCost;
  const pmPaymentsCoverSoftware = totalPmPaymentEarnings >= softwareCost;
  const mgmtFeeEarnings = monthlyRentVolume * (mgmtFeePct / 100);
  const pmTotalNetIncome = mgmtFeeEarnings + pmNetCostOrProfit;

  // Software savings vs current provider
  const softwareSavings = currentSoftwareCost - softwareCost;
  const totalSavingsAndEarnings = softwareSavings + totalPmPaymentEarnings;

  // DoorStax card
  const grossCardCollected = cardVolume * CARD_TENANT_RATE;
  const cardCosts = cardVolume * INTERCHANGE_BLENDED;
  const cardMargin = grossCardCollected - cardCosts;
  const bankShare = cardMargin * BANK_SHARE_PCT;
  const doorstaxCardNet = cardMargin - bankShare - pmCardEarnings;

  // DoorStax ACH
  const doorstaxAchCollected = achPayments * tier.platformAchCost;
  const doorstaxAchCost = achPayments * ACH_ACTUAL_COST;
  const doorstaxAchNet = doorstaxAchCollected - doorstaxAchCost;

  // DoorStax totals
  const doorstaxSoftware = softwareCost;
  const doorstaxNet = doorstaxCardNet + doorstaxAchNet + doorstaxSoftware;

  return {
    tier,
    occupiedUnits,
    monthlyRentVolume,
    cardPayments,
    achPayments,
    cardVolume,
    softwareCost,
    pmCardEarnings,
    pmAchSpread,
    pmAchEarnings,
    totalPmPaymentEarnings,
    pmNetCostOrProfit,
    pmPaymentsCoverSoftware,
    mgmtFeeEarnings,
    pmTotalNetIncome,
    currentSoftwareCost,
    softwareSavings,
    totalSavingsAndEarnings,
    grossCardCollected,
    cardCosts,
    cardMargin,
    bankShare,
    doorstaxCardNet,
    doorstaxAchCollected,
    doorstaxAchCost,
    doorstaxAchNet,
    doorstaxSoftware,
    doorstaxNet,
  };
}

/** Presets for quick scenario selection */
export const PRESETS = {
  conservative: {
    label: "Conservative",
    description: "85% occupancy, 20% card",
    values: {
      occupancyPct: 85,
      cardPct: 20,
      mgmtFeePct: 8,
      pmAchRate: 5,
      achPayer: "tenant" as const,
      currentSoftwareCost: 0,
    },
  },
  expected: {
    label: "Expected",
    description: "92% occupancy, 30% card",
    values: {
      occupancyPct: 92,
      cardPct: 30,
      mgmtFeePct: 8,
      pmAchRate: 5,
      achPayer: "tenant" as const,
      currentSoftwareCost: 0,
    },
  },
  optimistic: {
    label: "Optimistic",
    description: "97% occupancy, 45% card",
    values: {
      occupancyPct: 97,
      cardPct: 45,
      mgmtFeePct: 10,
      pmAchRate: 6,
      achPayer: "tenant" as const,
      currentSoftwareCost: 0,
    },
  },
};

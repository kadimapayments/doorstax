"use client";

import Link from "next/link";
import { TrendingUp, Star, ArrowRight } from "lucide-react";

/* ── Revenue math constants ─────────────────────────────────── */
const CARD_ADOPTION_RATE = 0.30;   // 30% of tenants pay by card
const ACH_ADOPTION_RATE = 0.70;    // 70% of tenants pay by ACH
const RESIDUAL_RATE = 0.0025;      // 0.25% residual on card volume
const ACH_EARNINGS_PER_TX = 4.00;  // $6 tenant fee - $2 platform cost
const AVG_RENT = 2000;

function estimateMonthlyCardResidual(units: number) {
  return units * AVG_RENT * CARD_ADOPTION_RATE * RESIDUAL_RATE;
}

function estimateMonthlyAchEarnings(units: number) {
  return Math.round(units * ACH_ADOPTION_RATE) * ACH_EARNINGS_PER_TX;
}

function estimateMonthlyRevenue(units: number) {
  return estimateMonthlyCardResidual(units) + estimateMonthlyAchEarnings(units);
}

/* ── Scaling tiers ──────────────────────────────────────────── */
const scalingTiers = [
  { label: "Mid-Size", units: 100 },
  { label: "Large", units: 250 },
  { label: "Enterprise", units: 500 },
  { label: "Mega", units: 1000 },
] as const;

/* ── Scaling Table sub-component ────────────────────────────── */
function ScalingTable({ currentUnits }: { currentUnits: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">Tier</th>
            <th className="pb-2 pr-4 font-medium">Units</th>
            <th className="pb-2 pr-4 font-medium">ACH Earnings</th>
            <th className="pb-2 pr-4 font-medium">Card Earnings</th>
            <th className="pb-2 font-medium">Monthly Total</th>
          </tr>
        </thead>
        <tbody>
          {scalingTiers.map((tier) => {
            const achEarnings = estimateMonthlyAchEarnings(tier.units);
            const cardEarnings = estimateMonthlyCardResidual(tier.units);
            const total = achEarnings + cardEarnings;
            const achieved = currentUnits >= tier.units;
            const isNext =
              !achieved &&
              (scalingTiers.findIndex((t) => t.units > currentUnits) ===
                scalingTiers.indexOf(tier));
            return (
              <tr
                key={tier.label}
                className={`border-b border-border/50 ${
                  achieved
                    ? "text-foreground"
                    : isNext
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <td className="py-2 pr-4 flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      achieved
                        ? "bg-emerald-500"
                        : isNext
                        ? "bg-primary"
                        : "bg-muted-foreground/30"
                    }`}
                  />
                  {tier.label}
                </td>
                <td className="py-2 pr-4">{tier.units.toLocaleString()}</td>
                <td className="py-2 pr-4">${achEarnings.toLocaleString()}</td>
                <td className="py-2 pr-4">${cardEarnings.toFixed(0)}</td>
                <td className="py-2 font-medium">
                  ${total.toFixed(0)}/mo
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────── */
interface PortfolioGoalProps {
  currentUnits: number;
}

export function PortfolioGoal({ currentUnits }: PortfolioGoalProps) {
  const goalUnits = 100;
  const progress = Math.min((currentUnits / goalUnits) * 100, 100);
  const unitsAway = Math.max(0, goalUnits - currentUnits);
  const currentResidual = estimateMonthlyRevenue(currentUnits);
  const goalResidual = estimateMonthlyRevenue(goalUnits);

  /* ── Congratulations State (>= 100 units) ───────────────── */
  if (currentUnits >= goalUnits) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
            <Star className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              100-Unit Portfolio &mdash; Unlocked
            </h3>
            <p className="text-sm text-muted-foreground">
              {currentUnits.toLocaleString()} units under management
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Estimated Monthly Payment Earnings
          </p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            ${currentResidual.toFixed(0)}/mo
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            ACH: ${estimateMonthlyAchEarnings(currentUnits).toLocaleString()} ({(ACH_ADOPTION_RATE * 100).toFixed(0)}% adoption, ${ACH_EARNINGS_PER_TX}/tx) + Card: ${estimateMonthlyCardResidual(currentUnits).toFixed(0)} ({(CARD_ADOPTION_RATE * 100).toFixed(0)}% adoption, {(RESIDUAL_RATE * 100).toFixed(2)}%)
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-3">
            Scale further to earn more
          </p>
          <ScalingTable currentUnits={currentUnits} />
        </div>

        <Link
          href="/dashboard/residuals"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          View your earnings
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  /* ── Progress State (< 100 units) ───────────────────────── */
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">
            100-Unit Portfolio Goal
          </h3>
          <p className="text-sm text-muted-foreground">
            Unlock payment revenue at scale
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">
            {currentUnits} / {goalUnits} units
          </span>
          <span className="text-muted-foreground">
            {progress.toFixed(0)}%
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Motivational text */}
      <p className="text-sm text-muted-foreground">
        Managers with 100 units on DoorStax generate an estimated{" "}
        <span className="font-semibold text-foreground">
          ${goalResidual.toFixed(0)}/month
        </span>{" "}
        in payment revenue. You&apos;re{" "}
        <span className="font-semibold text-foreground">
          {unitsAway} unit{unitsAway !== 1 ? "s" : ""}
        </span>{" "}
        away.
      </p>

      {/* Side-by-side revenue cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-muted/50 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Current Est. Earnings
          </p>
          <p className="text-xl font-bold text-foreground">
            ${currentResidual.toFixed(0)}/mo
          </p>
        </div>
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-xs text-muted-foreground">At 100 Units</p>
          <p className="text-xl font-bold text-primary">
            ${goalResidual.toFixed(0)}/mo
          </p>
        </div>
      </div>

      {/* Scaling table */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Revenue at scale
        </p>
        <ScalingTable currentUnits={currentUnits} />
      </div>

      {/* CTA */}
      <Link
        href="/dashboard/properties/new"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        Add a property to grow your portfolio
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

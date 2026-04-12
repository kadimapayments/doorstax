export const dynamic = "force-dynamic";

import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { formatCurrency } from "@/lib/utils";
import {
  getTier,
  calculateTieredPrice,
  RESIDUAL_TIERS,
} from "@/lib/residual-tiers";
import {
  CreditCard,
  Landmark,
  Receipt,
  DollarSign,
  Info,
  Users,
} from "lucide-react";
import {
  ResidualsTable,
  type LandlordResidualRow,
} from "@/components/admin/residuals-table";

export const metadata = { title: "Platform Revenue — Admin" };

/* ── Card processing constants ───────────────────────── */
const CARD = {
  tenantRate: 0.0325,
  interchangeBlended: 0.0185,
  brandAssessment: 0.0014,
  perTxnFee: 0.1,
  bankSharePct: 0.3,
};

const ACH_ACTUAL_COST = 0.5; // $0.50 per ACH to Kadima

export default async function AdminResidualsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireAdminPermission("admin:expenses");
  const { month } = await searchParams;

  // Date filter
  let startDate: Date;
  let endDate: Date;
  let isLive = true;

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, mo] = month.split("-").map(Number);
    startDate = new Date(year, mo - 1, 1);
    endDate = new Date(year, mo, 0, 23, 59, 59, 999);
    isLive = false;
  } else {
    startDate = new Date();
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date();
  }

  // All completed payments in the period
  const payments = await db.payment.findMany({
    where: {
      status: "COMPLETED",
      paidAt: { gte: startDate, lte: endDate },
    },
    select: {
      amount: true,
      paymentMethod: true,
      landlordId: true,
    },
  });

  // All PMs
  const landlords = await db.user.findMany({
    where: { role: "PM" },
    select: {
      id: true,
      name: true,
      properties: {
        select: { units: { select: { id: true } } },
      },
    },
  });

  // Aggregate per landlord
  const pmData = new Map<
    string,
    { cardVolume: number; cardCount: number; achCount: number }
  >();
  for (const p of payments) {
    const d = pmData.get(p.landlordId) || {
      cardVolume: 0,
      cardCount: 0,
      achCount: 0,
    };
    const amt = Number(p.amount);
    if (p.paymentMethod === "card") {
      d.cardVolume += amt;
      d.cardCount++;
    } else if (p.paymentMethod === "ach") {
      d.achCount++;
    }
    pmData.set(p.landlordId, d);
  }

  // Build rows with correct margin model
  let platformCardCollected = 0;
  let platformInterchange = 0;
  let platformBrandFees = 0;
  let platformPerTxn = 0;
  let platformBankShare = 0;
  let platformPmCardResiduals = 0;
  let platformAchCollected = 0;
  let platformAchCost = 0;
  let platformSoftwareMRR = 0;

  const rows: LandlordResidualRow[] = landlords.map((ll) => {
    const d = pmData.get(ll.id) || { cardVolume: 0, cardCount: 0, achCount: 0 };
    const units = ll.properties.reduce((s, p) => s + p.units.length, 0);
    const tier = getTier(units);

    // Card margin
    const cardCollected = d.cardVolume * CARD.tenantRate;
    const interchange = d.cardVolume * CARD.interchangeBlended;
    const brandFees = d.cardVolume * CARD.brandAssessment;
    const perTxn = d.cardCount * CARD.perTxnFee;
    const totalCardCosts = interchange + brandFees + perTxn;
    const grossCardMargin = cardCollected - totalCardCosts;
    const bankShare = grossCardMargin * CARD.bankSharePct;
    const pmCardResidual = d.cardVolume * tier.cardRate;
    const netCard = grossCardMargin - bankShare - pmCardResidual;

    // ACH margin
    const achCollected = d.achCount * tier.platformAchCost;
    const achCost = d.achCount * ACH_ACTUAL_COST;
    const netAch = achCollected - achCost;

    // Software — LIVE
    const softwareFee = calculateTieredPrice(units);

    // Accumulate platform totals
    platformCardCollected += cardCollected;
    platformInterchange += interchange;
    platformBrandFees += brandFees;
    platformPerTxn += perTxn;
    platformBankShare += bankShare;
    platformPmCardResiduals += pmCardResidual;
    platformAchCollected += achCollected;
    platformAchCost += achCost;
    platformSoftwareMRR += softwareFee;

    return {
      id: ll.id,
      name: ll.name,
      properties: ll.properties.length,
      units,
      totalVolume: d.cardVolume,
      cardVolume: d.cardVolume,
      cardPercent:
        d.cardCount + d.achCount > 0
          ? Math.round(
              (d.cardCount / (d.cardCount + d.achCount)) * 100
            )
          : 0,
      achCount: d.achCount,
      cardResidual: netCard,
      achResidual: netAch,
      softwareFee,
      totalResidual: netCard + netAch + softwareFee,
      tier: tier.name,
      pmCardPayout: pmCardResidual,
      pmAchPayout: 0,
      pmTotalPayout: pmCardResidual,
    };
  });

  // Platform totals
  const totalCardCosts =
    platformInterchange + platformBrandFees + platformPerTxn;
  const grossCardMargin = platformCardCollected - totalCardCosts;
  const netCardRevenue =
    grossCardMargin - platformBankShare - platformPmCardResiduals;
  const netAchRevenue = platformAchCollected - platformAchCost;
  const grossEarnings =
    platformCardCollected + platformAchCollected + platformSoftwareMRR;
  const netRevenue = netCardRevenue + netAchRevenue + platformSoftwareMRR;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <PageHeader
          title="Platform Revenue"
          description="Live revenue across all property managers."
        />
        {isLive && (
          <span className="inline-flex items-center gap-1.5 text-xs text-green-600 font-medium">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Live data
          </span>
        )}
      </div>

      {/* Revenue explanation */}
      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-5 space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-600" />
          How DoorStax Earns Revenue
        </h3>
        <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1.5">
          <p>
            <strong>Card Processing</strong> &mdash; Tenants pay 3.25% on
            every card payment. After estimated interchange (~1.85%), card
            brand fees (~0.14%), per-transaction costs ($0.10/tx), and 30%
            bank revenue share, DoorStax nets approximately 0.62% of card
            volume. PM residuals are then subtracted (0&ndash;0.35% by tier).
          </p>
          <p>
            <strong>ACH Processing</strong> &mdash; Platform collects $6
            (Starter), $4 (Growth), $3 (Scale), or $2 (Enterprise) per ACH
            transaction. Actual processing cost: ~$0.50/tx.
          </p>
          <p>
            <strong>Software Subscriptions</strong> &mdash; $150 base (50
            units) + graduated per-unit: $3 (51&ndash;99), $2.50
            (100&ndash;499), $2 (500&ndash;999), $1.50 (1000+). 100%
            DoorStax revenue.
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Card Revenue (Net)"
          value={formatCurrency(netCardRevenue)}
          icon={<CreditCard className="h-4 w-4" />}
        />
        <MetricCard
          label="ACH Revenue (Net)"
          value={formatCurrency(netAchRevenue)}
          icon={<Landmark className="h-4 w-4" />}
        />
        <MetricCard
          label="Software MRR"
          value={formatCurrency(platformSoftwareMRR)}
          icon={<Receipt className="h-4 w-4" />}
        />
        <MetricCard
          label="Total PM Payouts"
          value={formatCurrency(platformPmCardResiduals)}
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          label="Gross Earnings"
          value={formatCurrency(grossEarnings)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          label="Net Revenue"
          value={formatCurrency(netRevenue)}
          icon={<DollarSign className="h-4 w-4" />}
        />
      </div>

      {/* Card margin breakdown */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold">
          Card Processing Margin Breakdown
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Collected from tenants (3.25%)</span>
            <span className="font-medium">
              {formatCurrency(platformCardCollected)}
            </span>
          </div>
          <div className="flex justify-between text-red-500">
            <span>Interchange (~1.85%)</span>
            <span>-{formatCurrency(platformInterchange)}</span>
          </div>
          <div className="flex justify-between text-red-500">
            <span>Brand/network fees (~0.14%)</span>
            <span>-{formatCurrency(platformBrandFees)}</span>
          </div>
          <div className="flex justify-between text-red-500">
            <span>Per-txn fees ($0.10/tx)</span>
            <span>-{formatCurrency(platformPerTxn)}</span>
          </div>
          <div className="flex justify-between border-t pt-1">
            <span className="font-medium">Gross margin</span>
            <span className="font-medium">
              {formatCurrency(grossCardMargin)}
            </span>
          </div>
          <div className="flex justify-between text-amber-600">
            <span>Bank revenue share (30%)</span>
            <span>-{formatCurrency(platformBankShare)}</span>
          </div>
          <div className="flex justify-between text-purple-600">
            <span>PM card residuals</span>
            <span>-{formatCurrency(platformPmCardResiduals)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 font-bold text-green-600">
            <span>DoorStax net card revenue</span>
            <span>{formatCurrency(netCardRevenue)}</span>
          </div>
        </div>
      </div>

      {/* ACH margin breakdown */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold">
          ACH Processing Margin Breakdown
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>
              Collected from PMs (tier-based: $6/$4/$3/$2 per tx)
            </span>
            <span className="font-medium">
              {formatCurrency(platformAchCollected)}
            </span>
          </div>
          <div className="flex justify-between text-red-500">
            <span>Processing cost ($0.50/tx)</span>
            <span>-{formatCurrency(platformAchCost)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 font-bold text-green-600">
            <span>DoorStax net ACH revenue</span>
            <span>{formatCurrency(netAchRevenue)}</span>
          </div>
        </div>
      </div>

      {/* Manager breakdown */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Manager Breakdown</h2>
        <p className="text-sm text-muted-foreground">
          Revenue and costs per property manager. Software fees calculated
          live from current unit count.
        </p>
        <ResidualsTable rows={rows} selectedMonth={month || ""} />
      </section>
    </div>
  );
}

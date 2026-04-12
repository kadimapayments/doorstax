export const dynamic = "force-dynamic";

import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { formatCurrency } from "@/lib/utils";
import { getTier, formatCardRate } from "@/lib/residual-tiers";
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

export const metadata = { title: "Earnings — Admin" };

export default async function AdminResidualsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireAdminPermission("admin:expenses");

  const { month } = await searchParams;

  // Build date filter if month is provided (format: "YYYY-MM")
  const dateFilter: Record<string, unknown> = {};
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, mo] = month.split("-").map(Number);
    dateFilter.paidAt = {
      gte: new Date(year, mo - 1, 1),
      lt: new Date(year, mo, 1),
    };
  }

  // Fetch completed payments (optionally filtered by month)
  const payments = await db.payment.findMany({
    where: { status: "COMPLETED", ...dateFilter },
    select: {
      amount: true,
      paymentMethod: true,
      landlordId: true,
    },
  });

  // Fetch landlords with properties & units
  const landlords = await db.user.findMany({
    where: { role: "PM" },
    select: {
      id: true,
      name: true,
      properties: {
        select: {
          id: true,
          units: { select: { id: true } },
        },
      },
    },
  });

  // Fetch active subscriptions
  const subscriptions = await db.subscription.findMany({
    where: { status: { in: ["ACTIVE", "TRIALING"] } },
    select: { userId: true, currentAmount: true },
  });

  // Build subscription lookup
  const subscriptionMap = new Map<string, number>();
  for (const sub of subscriptions) {
    subscriptionMap.set(sub.userId, Number(sub.currentAmount));
  }

  // Aggregate per landlord
  const landlordMap = new Map<
    string,
    {
      cardVolume: number;
      achCount: number;
      totalVolume: number;
      totalCount: number;
      cardCount: number;
    }
  >();

  for (const p of payments) {
    const entry = landlordMap.get(p.landlordId) || {
      cardVolume: 0,
      achCount: 0,
      totalVolume: 0,
      totalCount: 0,
      cardCount: 0,
    };

    const amount = Number(p.amount);
    entry.totalVolume += amount;
    entry.totalCount++;

    if (p.paymentMethod === "card") {
      entry.cardVolume += amount;
      entry.cardCount++;
    } else if (p.paymentMethod === "ach") {
      entry.achCount++;
    }

    landlordMap.set(p.landlordId, entry);
  }

  // Build rows with PM payout calculations
  const rows: LandlordResidualRow[] = landlords.map((ll) => {
    const data = landlordMap.get(ll.id) || {
      cardVolume: 0,
      achCount: 0,
      totalVolume: 0,
      totalCount: 0,
      cardCount: 0,
    };

    const properties = ll.properties.length;
    const units = ll.properties.reduce((s, p) => s + p.units.length, 0);
    const tier = getTier(units);

    const cardResidual = data.cardVolume * 0.01; // 1% platform
    const achResidual = data.achCount * tier.platformAchCost; // Tiered ACH rate
    const softwareFee = subscriptionMap.get(ll.id) || 0;

    // PM payouts (based on tier)
    const pmCardPayout = data.cardVolume * tier.cardRate;
    const pmAchPayout = data.achCount * tier.achPayout;
    const pmTotalPayout = pmCardPayout + pmAchPayout;

    const totalResidual = cardResidual + achResidual + softwareFee;
    const cardPercent =
      data.totalCount > 0
        ? Math.round((data.cardCount / data.totalCount) * 100)
        : 0;

    return {
      id: ll.id,
      name: ll.name,
      properties,
      units,
      totalVolume: data.totalVolume,
      cardVolume: data.cardVolume,
      cardPercent,
      achCount: data.achCount,
      cardResidual,
      achResidual,
      softwareFee,
      totalResidual,
      tier: tier.name,
      pmCardPayout,
      pmAchPayout,
      pmTotalPayout,
    };
  });

  // Platform totals
  const totalCardRevenue = rows.reduce((s, r) => s + r.cardResidual, 0);
  const totalAchRevenue = rows.reduce((s, r) => s + r.achResidual, 0);
  const totalSoftwareMRR = rows.reduce((s, r) => s + r.softwareFee, 0);
  const totalPmPayouts = rows.reduce((s, r) => s + r.pmTotalPayout, 0);
  const totalEarnings = totalCardRevenue + totalAchRevenue + totalSoftwareMRR;
  const netRevenue = totalEarnings - totalPmPayouts;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Earnings"
        description="DoorStax earnings across all managers on the platform."
      />

      {/* Explanation Card */}
      <div className="rounded-lg border border-border bg-muted/30 p-5">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-foreground">
              How DoorStax Earns Revenue
            </p>
            <p className="text-muted-foreground leading-relaxed">
              DoorStax earns revenue on every payment processed through the
              platform. Revenue streams include:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>
                <strong className="text-foreground">Card Payments</strong> — 1%
                of transaction amount on every completed card payment
              </li>
              <li>
                <strong className="text-foreground">ACH Payments</strong> — Flat
                $2.00/tx across all tiers
              </li>
              <li>
                <strong className="text-foreground">Software Fees</strong> —
                $150 base (50 units) + graduated per-unit: $3 (51-499), $2.50 (500-999), $2 (1000+)
              </li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              PMs earn the ACH earnings (their rate to tenants minus $2.00 DoorStax cost) plus
              card earnings: Growth (100-499) 0.25% cards,
              Scale (500-999) 0.30% cards,
              Enterprise (1000+) 0.35% cards.
            </p>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Card Revenue (1%)"
          value={formatCurrency(totalCardRevenue)}
          icon={<CreditCard className="h-4 w-4" />}
        />
        <MetricCard
          label="ACH Revenue ($2.00/tx)"
          value={formatCurrency(totalAchRevenue)}
          icon={<Landmark className="h-4 w-4" />}
        />
        <MetricCard
          label="Software MRR"
          value={formatCurrency(totalSoftwareMRR)}
          icon={<Receipt className="h-4 w-4" />}
        />
        <MetricCard
          label="Total PM Payouts"
          value={formatCurrency(totalPmPayouts)}
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          label="Gross Earnings"
          value={formatCurrency(totalEarnings)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          label="Net Revenue"
          value={formatCurrency(netRevenue)}
          icon={<DollarSign className="h-4 w-4" />}
        />
      </div>

      {/* Landlord Breakdown Table */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Manager Breakdown</h2>
        <p className="text-sm text-muted-foreground">
          Filter and compare earnings performance across all managers. Click a
          manager name to view their full profile.
        </p>
        <ResidualsTable rows={rows} selectedMonth={month || ""} />
      </section>
    </div>
  );
}

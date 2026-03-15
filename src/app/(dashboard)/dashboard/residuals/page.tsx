"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/ui/data-table";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  CreditCard,
  DollarSign,
  Landmark,
  CalendarDays,
  Info,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { PaymentRevenue } from "@/components/dashboard/payment-revenue";

interface ResidualItem {
  id: string;
  date: string;
  tenant: string;
  unit: string;
  property: string;
  ownerName: string;
  paymentAmount: number;
  type: "card" | "ach" | "other";
  surcharge: number;
  residual: number;
}

interface ResidualSummary {
  totalTransactions: number;
  cardTransactions: number;
  achTransactions: number;
  totalCardVolume: number;
  totalCardResiduals: number;
  totalAchResiduals: number;
  totalResiduals: number;
  thisMonthResiduals: number;
}

interface TierInfo {
  name: string;
  unitCount: number;
  achPayout: number;
  cardRate: number;
  cardRateFormatted: string;
}

export default function ResidualsPage() {
  const [items, setItems] = useState<ResidualItem[]>([]);
  const [summary, setSummary] = useState<ResidualSummary>({
    totalTransactions: 0,
    cardTransactions: 0,
    achTransactions: 0,
    totalCardVolume: 0,
    totalCardResiduals: 0,
    totalAchResiduals: 0,
    totalResiduals: 0,
    thisMonthResiduals: 0,
  });
  const [tier, setTier] = useState<TierInfo | null>(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // Generate month options: current month + 11 previous
  const monthOptions = (() => {
    const opts: { label: string; value: string; from: string; to: string }[] = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const label = d.toLocaleString("default", { month: "long", year: "numeric" });
      const value = `${year}-${String(month + 1).padStart(2, "0")}`;
      const from = `${value}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const to = `${value}-${String(lastDay).padStart(2, "0")}`;
      opts.push({ label, value, from, to });
    }
    return opts;
  })();

  function fetchResiduals() {
    setLoading(true);
    const params = new URLSearchParams();

    if (selectedMonth) {
      const opt = monthOptions.find((o) => o.value === selectedMonth);
      if (opt) {
        params.set("from", opt.from);
        params.set("to", opt.to);
      }
    }

    fetch(`/api/residuals?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items || []);
        setPage(1);
        setSummary(
          data.summary || {
            totalTransactions: 0,
            cardTransactions: 0,
            achTransactions: 0,
            totalCardVolume: 0,
            totalCardResiduals: 0,
            totalAchResiduals: 0,
            totalResiduals: 0,
            thisMonthResiduals: 0,
          }
        );
        setTier(data.tier || null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchResiduals();
  }, [selectedMonth]);

  const columns: Column<ResidualItem>[] = [
    {
      key: "date",
      header: "Date",
      sortable: true,
      sortFn: (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      cell: (row) => formatDate(new Date(row.date)),
    },
    {
      key: "type",
      header: "Type",
      cell: (row) => (
        <StatusBadge
          status={row.type === "card" ? "CARD" : row.type === "ach" ? "ACH" : "OTHER"}
        />
      ),
    },
    {
      key: "tenant",
      header: "Tenant",
      cell: (row) => row.tenant,
    },
    {
      key: "property",
      header: "Property / Unit",
      cell: (row) =>
        row.unit && row.unit !== "\u2014"
          ? `${row.property} #${row.unit}`
          : row.property,
    },
    {
      key: "ownerName",
      header: "Owner",
      cell: (row) => row.ownerName || "\u2014",
    },
    {
      key: "paymentAmount",
      header: "Payment Amount",
      sortable: true,
      sortFn: (a, b) => a.paymentAmount - b.paymentAmount,
      cell: (row) => (
        <span className="font-medium">
          {formatCurrency(row.paymentAmount)}
        </span>
      ),
    },
    {
      key: "residual",
      header: "Your Earnings",
      sortable: true,
      sortFn: (a, b) => a.residual - b.residual,
      cell: (row) => (
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          {row.residual > 0 ? formatCurrency(row.residual) : "\u2014"}
        </span>
      ),
    },
  ];

  // Tier badge colors
  const tierColors: Record<string, string> = {
    Starter: "bg-muted text-muted-foreground",
    Growth: "bg-blue-500/15 text-blue-600 border-blue-500/20 dark:text-blue-400",
    Scale: "bg-purple-500/15 text-purple-600 border-purple-500/20 dark:text-purple-400",
    Enterprise: "bg-amber-500/15 text-amber-600 border-amber-500/20 dark:text-amber-400",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Earnings"
        description="Revenue from ACH and card processing through DoorStax."
      />

      {/* Current Tier Badge */}
      {tier && (
        <Card className="border-border">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Your Current Tier</p>
                <p className="text-xs text-muted-foreground">
                  {tier.unitCount} {tier.unitCount === 1 ? "unit" : "units"} in your portfolio
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className={`text-sm px-3 py-1 ${tierColors[tier.name] || ""}`}
              >
                {tier.name}
              </Badge>
              {tier.name === "Starter" && (
                <span className="text-xs text-muted-foreground">
                  Reach 100 units to start earning
                </span>
              )}
              {tier.name !== "Enterprise" && tier.name !== "Starter" && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" />
                  {tier.name === "Growth" ? "500 units for Scale" : "1,000 units for Enterprise"}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Revenue */}
      <PaymentRevenue />

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Card Earnings"
          value={formatCurrency(summary.totalCardResiduals)}
          icon={<CreditCard className="h-4 w-4" />}
        />
        <MetricCard
          label="ACH Earnings"
          value={formatCurrency(summary.totalAchResiduals)}
          icon={<Landmark className="h-4 w-4" />}
        />
        <MetricCard
          label="Total Earnings"
          value={formatCurrency(summary.totalResiduals)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          label="This Month"
          value={formatCurrency(summary.thisMonthResiduals)}
          icon={<CalendarDays className="h-4 w-4" />}
        />
      </div>

      {/* Tier Rate Table */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="space-y-2 w-full">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                Tiered Rates &amp; Pricing
              </p>
              <p className="text-xs text-blue-700/70 dark:text-blue-400/70">
                Earn more and pay less as your portfolio grows. Earnings activate at 100+ units.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-blue-700 dark:text-blue-400 border-b border-blue-200 dark:border-blue-800">
                      <th className="pb-2 pr-4 font-medium">Tier</th>
                      <th className="pb-2 pr-4 font-medium">Units</th>
                      <th className="pb-2 pr-4 font-medium">Per Unit Cost</th>
                      <th className="pb-2 pr-4 font-medium">ACH Earnings</th>
                      <th className="pb-2 font-medium">Card Rate</th>
                    </tr>
                  </thead>
                  <tbody className="text-blue-900 dark:text-blue-200">
                    {[
                      { name: "Starter", range: "0 – 99", cost: "$3.00", ach: "Your Earnings", card: "0.00%" },
                      { name: "Growth", range: "100 – 499", cost: "$3.00", ach: "Your Earnings", card: "0.25%" },
                      { name: "Scale", range: "500 – 999", cost: "$2.50", ach: "Your Earnings", card: "0.30%" },
                      { name: "Enterprise", range: "1,000+", cost: "$2.00", ach: "Your Earnings", card: "0.35%" },
                    ].map((t) => (
                      <tr
                        key={t.name}
                        className={`border-b border-blue-100 dark:border-blue-900/50 last:border-0 ${
                          tier?.name === t.name ? "font-semibold bg-blue-100/50 dark:bg-blue-900/30" : ""
                        }`}
                      >
                        <td className="py-2 pr-4">
                          {t.name}
                          {tier?.name === t.name && (
                            <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(You)</span>
                          )}
                        </td>
                        <td className="py-2 pr-4">{t.range}</td>
                        <td className="py-2 pr-4">{t.cost}/unit</td>
                        <td className="py-2 pr-4">{t.ach}</td>
                        <td className="py-2">{t.card}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-blue-600/70 dark:text-blue-400/60 mt-2">
                ACH earnings = your rate to tenants minus $2.00 DoorStax cost
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Earnings Potential */}
      <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30">
        <CardContent className="p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              Earnings Potential
            </h3>
            <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70">
              Estimated monthly earnings based on 70% ACH / 30% card blend at $2,000 avg rent
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-emerald-700 dark:text-emerald-400 border-b border-emerald-200 dark:border-emerald-800">
                  <th className="pb-2 pr-4 font-medium">Tier</th>
                  <th className="pb-2 pr-4 font-medium">Units</th>
                  <th className="pb-2 pr-4 font-medium">Card Earnings</th>
                  <th className="pb-2 pr-4 font-medium">ACH Earnings</th>
                  <th className="pb-2 pr-4 font-medium">Monthly Total</th>
                  <th className="pb-2 font-medium">Annual Total</th>
                </tr>
              </thead>
              <tbody className="text-emerald-900 dark:text-emerald-200">
                {[
                  { label: "Growth", units: 100, achSpread: 4.00, cardRate: 0.0025 },
                  { label: "Growth", units: 250, achSpread: 4.00, cardRate: 0.0025 },
                  { label: "Scale", units: 500, achSpread: 4.00, cardRate: 0.003 },
                  { label: "Enterprise", units: 1000, achSpread: 4.00, cardRate: 0.0035 },
                ].map((t) => {
                  const rentRoll = t.units * 2000;
                  const cardVol = rentRoll * 0.3;
                  const achCount = Math.round(t.units * 0.7);
                  const cardRes = cardVol * t.cardRate;
                  const achRes = achCount * t.achSpread;
                  const monthlyTotal = cardRes + achRes;
                  const annualTotal = monthlyTotal * 12;
                  return (
                    <tr key={`${t.label}-${t.units}`} className="border-b border-emerald-100 dark:border-emerald-900/50 last:border-0">
                      <td className="py-2 pr-4 font-medium">{t.label}</td>
                      <td className="py-2 pr-4">{t.units.toLocaleString()}</td>
                      <td className="py-2 pr-4">{formatCurrency(cardRes)}</td>
                      <td className="py-2 pr-4">{formatCurrency(achRes)}</td>
                      <td className="py-2 pr-4 font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(monthlyTotal)}
                      </td>
                      <td className="py-2 font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(annualTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Month/Year Filter */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Period</Label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="">All Time</option>
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Residuals Table */}
      {!loading && items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CreditCard className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="text-lg font-semibold">
              No payment earnings yet
            </h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {tier?.name === "Starter"
                ? "Earnings activate at 100+ units. Grow your portfolio to start earning on every payment."
                : "Earnings are generated when tenants pay rent via card or ACH. Commission is applied based on your current tier."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
          page={page}
          totalPages={Math.ceil(items.length / PAGE_SIZE)}
          onPageChange={setPage}
          emptyMessage="No earnings found for the selected date range."
        />
      )}
    </div>
  );
}

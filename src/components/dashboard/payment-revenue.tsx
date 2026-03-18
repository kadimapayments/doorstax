"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { CreditCard, Landmark, TrendingUp, Percent, DollarSign } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface ResidualSummary {
  totalTransactions: number;
  cardTransactions: number;
  achTransactions: number;
  totalCardVolume: number;
  totalAchVolume: number;
  totalVolume: number;
  totalCardResiduals: number;
  totalAchResiduals: number;
  totalResiduals: number;
  thisMonthResiduals: number;
}

interface ResidualTier {
  name: string;
  unitCount: number;
  cardRate: number;
  cardRateFormatted: string;
}

interface ResidualData {
  summary?: ResidualSummary;
  tier?: ResidualTier;
  locked?: boolean;
  unitCount?: number;
}

const COLORS = { card: "#a855f7", ach: "#3b82f6" };

export function PaymentRevenue() {
  const [data, setData] = useState<ResidualData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const res = await fetch(`/api/residuals?from=${from}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <Card className="border-border">
        <CardContent className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.locked || !data.summary || !data.tier) return null;

  const summary = data.summary;
  const tier = data.tier;
  const totalPayments = (summary.cardTransactions ?? 0) + (summary.achTransactions ?? 0);
  const cardPct = totalPayments > 0
    ? Math.round(((summary.cardTransactions ?? 0) / totalPayments) * 100)
    : 0;
  const achPct = 100 - cardPct;
  const projectedYearly = (summary.thisMonthResiduals ?? 0) * 12;

  const pieData = [
    { name: "Card", value: summary.totalCardVolume ?? 0, color: COLORS.card },
    { name: "ACH", value: summary.totalAchVolume ?? 0, color: COLORS.ach },
  ].filter((d) => d.value > 0);

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Payment Revenue
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Payment volume and earnings generated this month.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-[1fr_200px]">
          {/* Metrics Grid */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Total Volume */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                Total Volume (This Month)
              </div>
              <p className="mt-1 text-2xl font-bold">
                {formatCurrency(summary.totalVolume ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">
                {totalPayments} transaction{totalPayments !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Card Volume */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CreditCard className="h-4 w-4" />
                Card Volume (This Month)
              </div>
              <p className="mt-1 text-2xl font-bold">
                {formatCurrency(summary.totalCardVolume ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">
                {summary.cardTransactions ?? 0} transaction{(summary.cardTransactions ?? 0) !== 1 ? "s" : ""}
              </p>
            </div>

            {/* ACH Volume */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Landmark className="h-4 w-4" />
                ACH Volume (This Month)
              </div>
              <p className="mt-1 text-2xl font-bold">
                {formatCurrency(summary.totalAchVolume ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">
                {summary.achTransactions ?? 0} transaction{(summary.achTransactions ?? 0) !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Card vs ACH Breakdown */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Percent className="h-4 w-4" />
                Card vs ACH
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: COLORS.card }} />
                    Card {cardPct}%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: COLORS.ach }} />
                    ACH {achPct}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
                  {cardPct > 0 && (
                    <div
                      className="h-full transition-all duration-500"
                      style={{ width: `${cardPct}%`, backgroundColor: COLORS.card, borderRadius: achPct > 0 ? "9999px 0 0 9999px" : "9999px" }}
                    />
                  )}
                  {achPct > 0 && (
                    <div
                      className="h-full transition-all duration-500"
                      style={{ width: `${achPct}%`, backgroundColor: COLORS.ach, borderRadius: cardPct > 0 ? "0 9999px 9999px 0" : "9999px" }}
                    />
                  )}
                </div>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {totalPayments} total payment{totalPayments !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Revenue from Cards */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                Payment Earnings (This Month)
              </div>
              <p className="mt-1 text-2xl font-bold gradient-text">
                {formatCurrency(summary.thisMonthResiduals ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">
                {tier.name} tier @ {tier.cardRateFormatted}
              </p>
            </div>

            {/* Projected Yearly */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                Projected Yearly Revenue
              </div>
              <p className="mt-1 text-2xl font-bold">
                {formatCurrency(projectedYearly)}
              </p>
              <p className="text-xs text-muted-foreground">
                Based on this month&apos;s volume
              </p>
            </div>
          </div>

          {/* Donut Chart */}
          <div className="flex flex-col items-center justify-center">
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              Payment Mix
            </p>
            {pieData.length > 0 ? (
              <>
                <div className="h-[160px] w-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={72}
                        dataKey="value"
                        strokeWidth={2}
                        stroke="hsl(var(--card))"
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                        itemStyle={{ color: "hsl(var(--foreground))" }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={((value: any) => [
                          formatCurrency(Number(value)),
                        ]) as any}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-4 mt-2">
                  {pieData.map((d) => (
                    <span
                      key={d.name}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: d.color }}
                      />
                      {d.name} ({formatCurrency(d.value)})
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground py-8">
                No payment data yet
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

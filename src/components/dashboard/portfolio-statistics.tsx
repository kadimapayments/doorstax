"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

interface Props {
  scope: "pm" | "admin" | "owner";
}

interface MonthDatum {
  label: string;
  year: number;
  month: number;
  added: number;
  closed: number;
  total: number;
  pctAdded: number;
  pctClosed: number;
  pctGrowth: number;
}

interface PortfolioData {
  months: MonthDatum[];
}

export function PortfolioStatistics({ scope }: Props) {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/analytics/portfolio-statistics?scope=${scope}`
      );
      if (res.ok) {
        setData(await res.json());
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <Card className="border-border">
        <CardContent className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.months || data.months.length === 0) {
    return (
      <Card className="border-border">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Unable to load portfolio statistics.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">
          Portfolio Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Line/Area Chart */}
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.months}>
              <defs>
                <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradAdded" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradClosed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.4}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={{ stroke: "hsl(var(--border))" }}
                angle={-45}
                textAnchor="end"
                height={60}
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={{ stroke: "hsl(var(--border))" }}
                allowDecimals={false}
                domain={[0, "auto"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                itemStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px", paddingTop: "8px", color: "hsl(var(--foreground))" }}
              />
              <Area
                type="monotone"
                dataKey="total"
                name="Accounts"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="url(#gradTotal)"
                dot={{ r: 3, fill: "#3b82f6" }}
                activeDot={{ r: 5, strokeWidth: 2 }}
                animationDuration={800}
              />
              <Area
                type="monotone"
                dataKey="added"
                name="Added"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#gradAdded)"
                dot={{ r: 2.5, fill: "#22c55e" }}
                activeDot={{ r: 4, strokeWidth: 2 }}
                animationDuration={800}
              />
              <Area
                type="monotone"
                dataKey="closed"
                name="Closed"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#gradClosed)"
                dot={{ r: 2.5, fill: "#ef4444" }}
                activeDot={{ r: 4, strokeWidth: 2 }}
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Statistics Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-2 text-left font-medium sticky left-0 bg-card z-10">Metric</th>
                {data.months.map((m) => (
                  <th
                    key={m.label}
                    className="pb-2 text-right font-medium min-w-[70px] px-2"
                  >
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50">
                <td className="py-2.5 font-medium text-muted-foreground sticky left-0 bg-card z-10">
                  Accounts Added
                </td>
                {data.months.map((m) => (
                  <td
                    key={m.label}
                    className="py-2.5 text-right tabular-nums px-2"
                  >
                    {m.added}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2.5 font-medium text-muted-foreground sticky left-0 bg-card z-10">
                  Percent Added
                </td>
                {data.months.map((m) => (
                  <td
                    key={m.label}
                    className="py-2.5 text-right tabular-nums text-green-500 px-2"
                  >
                    {m.pctAdded.toFixed(1)}%
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2.5 font-medium text-muted-foreground sticky left-0 bg-card z-10">
                  Accounts Closed
                </td>
                {data.months.map((m) => (
                  <td
                    key={m.label}
                    className="py-2.5 text-right tabular-nums px-2"
                  >
                    {m.closed}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2.5 font-medium text-muted-foreground sticky left-0 bg-card z-10">
                  Percent Closed
                </td>
                {data.months.map((m) => (
                  <td
                    key={m.label}
                    className="py-2.5 text-right tabular-nums text-red-500 px-2"
                  >
                    {m.pctClosed.toFixed(1)}%
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border/50 font-semibold">
                <td className="py-2.5 sticky left-0 bg-card z-10">Accounts</td>
                {data.months.map((m) => (
                  <td
                    key={m.label}
                    className="py-2.5 text-right tabular-nums px-2"
                  >
                    {m.total}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="pt-2.5 font-medium text-muted-foreground sticky left-0 bg-card z-10">
                  Percent Growth
                </td>
                {data.months.map((m) => (
                  <td
                    key={m.label}
                    className={`pt-2.5 text-right tabular-nums px-2 ${
                      m.pctGrowth > 0
                        ? "text-green-500"
                        : m.pctGrowth < 0
                        ? "text-red-500"
                        : ""
                    }`}
                  >
                    {m.pctGrowth > 0 ? "+" : ""}
                    {m.pctGrowth.toFixed(1)}%
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

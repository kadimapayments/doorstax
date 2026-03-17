"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface Props {
  scope: "pm" | "admin" | "owner";
}

interface DailyDatum {
  date: string;
  approvals: number;
  declines: number;
}

interface BrandRow {
  brand: string;
  brandKey: string;
  totalAuth: number;
  totalAmount: number;
  approvalCountRatio: number;
  approvalAmountRatio: number;
}

interface DeclineReason {
  reason: string;
  count: number;
}

interface AuthData {
  dailyData: DailyDatum[];
  brandBreakdown: BrandRow[];
  declineReasons: DeclineReason[];
  totals: {
    totalAuth: number;
    totalAmount: number;
    approvalCountRatio: number;
    approvalAmountRatio: number;
  };
  month: number;
  year: number;
  monthLabel: string;
}

const BRAND_IMAGES: Record<
  string,
  { src: string; alt: string; width: number; height: number }
> = {
  visa: { src: "/trust/visa.webp", alt: "Visa", width: 40, height: 14 },
  mastercard: {
    src: "/trust/mastercard.webp",
    alt: "Mastercard",
    width: 28,
    height: 18,
  },
  amex: { src: "/trust/amex.webp", alt: "Amex", width: 32, height: 14 },
  discover: {
    src: "/trust/discover.webp",
    alt: "Discover",
    width: 40,
    height: 14,
  },
};

const DONUT_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#a855f7", // purple
  "#1e293b", // dark
  "#94a3b8", // gray
];

export function MonthlyAuthorizationDetail({ scope }: Props) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<AuthData | null>(null);
  const [loading, setLoading] = useState(true);

  const isCurrentMonth =
    month === now.getMonth() + 1 && year === now.getFullYear();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/analytics/authorizations?scope=${scope}&month=${month}&year=${year}`
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
  }, [scope, month, year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function goPrev() {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  }

  function goNext() {
    if (isCurrentMonth) return;
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  }

  if (loading) {
    return (
      <Card className="border-border">
        <CardContent className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="border-border">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Unable to load authorization data.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">
          Monthly Authorization Detail
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={goPrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground min-w-[130px] justify-center">
            <Calendar className="h-3 w-3" />
            {data.monthLabel}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={goNext}
            disabled={isCurrentMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Area Chart with gradient fill and curved lines */}
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.dailyData}>
              <defs>
                <linearGradient id="gradApprovals" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradDeclines" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.4}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                angle={-45}
                textAnchor="end"
                height={60}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                allowDecimals={false}
                domain={[0, 'auto']}
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
                type="natural"
                dataKey="approvals"
                name="Approvals"
                stroke="#22c55e"
                strokeWidth={2.5}
                fill="url(#gradApprovals)"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2 }}
                animationDuration={800}
              />
              <Area
                type="natural"
                dataKey="declines"
                name="Declines"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#gradDeclines)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2 }}
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Bottom: Table + Donut */}
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* Brand Breakdown Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 text-left font-medium"></th>
                  <th className="pb-2 text-right font-medium">
                    Total
                    <br />
                    Authorizations
                  </th>
                  <th className="pb-2 text-right font-medium">
                    Total Amount
                    <br />
                    Authorized
                  </th>
                  <th className="pb-2 text-right font-medium">
                    Approval
                    <br />
                    Count Ratio
                  </th>
                  <th className="pb-2 text-right font-medium">
                    Approval
                    <br />
                    Amount Ratio
                  </th>
                </tr>
              </thead>
              <tbody>
                {(data.brandBreakdown ?? []).map((row) => {
                  const img = BRAND_IMAGES[row.brandKey];
                  return (
                    <tr
                      key={row.brandKey}
                      className="border-b border-border/50"
                    >
                      <td className="py-3">
                        <span className="inline-flex items-center gap-2">
                          {img && (
                            <Image
                              src={img.src}
                              alt={img.alt}
                              width={img.width}
                              height={img.height}
                              className="object-contain"
                            />
                          )}
                          <span className="font-medium">{row.brand}</span>
                        </span>
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {row.totalAuth}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {formatCurrency(row.totalAmount)}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {row.approvalCountRatio.toFixed(2)}%
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {row.approvalAmountRatio.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
                {/* Totals row */}
                <tr className="font-semibold">
                  <td className="pt-3">Total</td>
                  <td className="pt-3 text-right tabular-nums">
                    {data.totals.totalAuth}
                  </td>
                  <td className="pt-3 text-right tabular-nums">
                    {formatCurrency(data.totals.totalAmount)}
                  </td>
                  <td className="pt-3 text-right tabular-nums">
                    {data.totals.approvalCountRatio.toFixed(2)}%
                  </td>
                  <td className="pt-3 text-right tabular-nums">
                    {data.totals.approvalAmountRatio.toFixed(2)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Decline Reason Donut */}
          <div>
            <p className="mb-2 text-center text-sm font-medium italic text-muted-foreground">
              Decline Reason Codes
            </p>
            {data.declineReasons.length > 0 ? (
              <>
                <div className="mx-auto h-[200px] w-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.declineReasons}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        dataKey="count"
                        nameKey="reason"
                        strokeWidth={2}
                        stroke="hsl(var(--card))"
                        animationDuration={800}
                      >
                        {data.declineReasons.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                          />
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
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
                  {data.declineReasons.map((dr, i) => (
                    <span
                      key={dr.reason}
                      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{
                          backgroundColor:
                            DONUT_COLORS[i % DONUT_COLORS.length],
                        }}
                      />
                      {dr.reason}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No declines this period
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

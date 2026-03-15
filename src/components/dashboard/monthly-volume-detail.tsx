"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight, Landmark } from "lucide-react";
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
  Line,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface Props {
  scope: "pm" | "admin" | "owner";
}

interface DailyDatum {
  date: string;
  amount: number;
  count: number;
}

interface BrandRow {
  brand: string;
  brandKey: string;
  salesCount: number;
  salesVolume: number;
  avgTicket: number;
  creditsCount: number;
  creditsVolume: number;
}

interface VolumeData {
  dailyData: DailyDatum[];
  brandBreakdown: BrandRow[];
  totals: {
    salesCount: number;
    salesVolume: number;
    avgTicket: number;
    creditsCount: number;
    creditsVolume: number;
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
  "#3b82f6", // blue - visa
  "#ef4444", // red - mastercard
  "#a855f7", // purple - amex
  "#f97316", // orange - discover
  "#22c55e", // green - ach
];

export function MonthlyVolumeDetail({ scope }: Props) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<VolumeData | null>(null);
  const [loading, setLoading] = useState(true);

  const isCurrentMonth =
    month === now.getMonth() + 1 && year === now.getFullYear();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/analytics/volume-detail?scope=${scope}&month=${month}&year=${year}`
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
          Unable to load volume data.
        </CardContent>
      </Card>
    );
  }

  // Prepare donut data — only brands with salesVolume > 0
  const donutData = data.brandBreakdown
    .filter((b) => b.salesVolume > 0)
    .map((b) => ({
      name: b.brand,
      value: b.salesVolume,
      brandKey: b.brandKey,
    }));

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">
          Monthly Volume Detail
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
        {/* Area Chart: Volume + Count */}
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.dailyData}>
              <defs>
                <linearGradient id="gradVolume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
                yAxisId="amount"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                }
                domain={[0, "auto"]}
              />
              <YAxis
                yAxisId="count"
                orientation="right"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => {
                  if (name === "Amount") return [formatCurrency(Number(value)), name];
                  return [value, name];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px", paddingTop: "8px", color: "hsl(var(--foreground))" }}
              />
              <Area
                yAxisId="amount"
                type="natural"
                dataKey="amount"
                name="Amount"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="url(#gradVolume)"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2 }}
                animationDuration={800}
              />
              <Line
                yAxisId="count"
                type="natural"
                dataKey="count"
                name="Quantity"
                stroke="#22c55e"
                strokeWidth={2}
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
                  <th className="pb-2 text-right font-medium">Sales</th>
                  <th className="pb-2 text-right font-medium">Sales Vol</th>
                  <th className="pb-2 text-right font-medium">Avg Ticket</th>
                  <th className="pb-2 text-right font-medium">Credits</th>
                  <th className="pb-2 text-right font-medium">Credits Vol</th>
                </tr>
              </thead>
              <tbody>
                {data.brandBreakdown.map((row, idx) => {
                  const img = BRAND_IMAGES[row.brandKey];
                  const isACH = row.brandKey === "ach";
                  return (
                    <tr
                      key={row.brandKey}
                      className="border-b border-border/50"
                    >
                      <td className="py-3">
                        <span className="inline-flex items-center gap-2">
                          {isACH ? (
                            <Landmark className="h-5 w-5 text-gray-700 dark:text-gray-200" />
                          ) : img ? (
                            <Image
                              src={img.src}
                              alt={img.alt}
                              width={img.width}
                              height={img.height}
                              className="object-contain"
                            />
                          ) : (
                            <span
                              className="inline-block h-3 w-3 rounded-sm"
                              style={{
                                backgroundColor:
                                  DONUT_COLORS[idx % DONUT_COLORS.length],
                              }}
                            />
                          )}
                          <span className="font-medium">{row.brand}</span>
                        </span>
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {row.salesCount}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {formatCurrency(row.salesVolume)}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {formatCurrency(row.avgTicket)}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {row.creditsCount}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {formatCurrency(row.creditsVolume)}
                      </td>
                    </tr>
                  );
                })}
                {/* Totals row */}
                <tr className="font-semibold">
                  <td className="pt-3">Total</td>
                  <td className="pt-3 text-right tabular-nums">
                    {data.totals.salesCount}
                  </td>
                  <td className="pt-3 text-right tabular-nums">
                    {formatCurrency(data.totals.salesVolume)}
                  </td>
                  <td className="pt-3 text-right tabular-nums">
                    {formatCurrency(data.totals.avgTicket)}
                  </td>
                  <td className="pt-3 text-right tabular-nums">
                    {data.totals.creditsCount}
                  </td>
                  <td className="pt-3 text-right tabular-nums">
                    {formatCurrency(data.totals.creditsVolume)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Volume Distribution Donut */}
          <div>
            <p className="mb-2 text-center text-sm font-medium italic text-muted-foreground">
              Volume Distribution
            </p>
            {donutData.length > 0 ? (
              <>
                <div className="mx-auto h-[200px] w-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        dataKey="value"
                        nameKey="name"
                        strokeWidth={2}
                        stroke="hsl(var(--card))"
                        animationDuration={800}
                      >
                        {donutData.map((entry, index) => {
                          const brandIdx = [
                            "visa",
                            "mastercard",
                            "amex",
                            "discover",
                            "ach",
                          ].indexOf(entry.brandKey);
                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                DONUT_COLORS[
                                  brandIdx >= 0
                                    ? brandIdx
                                    : index % DONUT_COLORS.length
                                ]
                              }
                            />
                          );
                        })}
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
                        formatter={(value: any) => [
                          formatCurrency(Number(value)),
                          "Volume",
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
                  {donutData.map((entry) => {
                    const brandIdx = [
                      "visa",
                      "mastercard",
                      "amex",
                      "discover",
                      "ach",
                    ].indexOf(entry.brandKey);
                    return (
                      <span
                        key={entry.brandKey}
                        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                      >
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-sm"
                          style={{
                            backgroundColor:
                              DONUT_COLORS[
                                brandIdx >= 0
                                  ? brandIdx
                                  : 0
                              ],
                          }}
                        />
                        {entry.name}
                      </span>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No volume data this period
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Home, Calendar, ChevronLeft, ChevronRight, TrendingDown } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface Props {
  scope: "pm" | "admin" | "owner";
}

interface DailyDatum {
  date: string;
  propertiesAdded: number;
  unitsAdded: number;
  propertiesRemoved: number;
  unitsRemoved: number;
}

interface PortfolioData {
  dailyData: DailyDatum[];
  summary: {
    totalPropertiesAdded: number;
    totalUnitsAdded: number;
    totalPropertiesRemoved: number;
    totalUnitsRemoved: number;
  };
  month: number;
  year: number;
  monthLabel: string;
}

export function PortfolioChangesChart({ scope }: Props) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);

  const isCurrentMonth =
    month === now.getMonth() + 1 && year === now.getFullYear();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/analytics/portfolio-changes?scope=${scope}&month=${month}&year=${year}`
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
          Unable to load portfolio data.
        </CardContent>
      </Card>
    );
  }

  if (!data.summary || !data.dailyData) {
    return (
      <Card className="border-border">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Unable to load portfolio data.
        </CardContent>
      </Card>
    );
  }

  const hasRemovals =
    data.summary.totalPropertiesRemoved > 0 || data.summary.totalUnitsRemoved > 0;

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">
          Portfolio Changes
        </CardTitle>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            <Building2 className="h-3 w-3" />+
            {data.summary.totalPropertiesAdded}
            {data.summary.totalPropertiesRemoved > 0 && (
              <span className="text-destructive"> / -{data.summary.totalPropertiesRemoved}</span>
            )}
            {" "}Properties
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-600 dark:text-violet-400">
            <Home className="h-3 w-3" />+{data.summary.totalUnitsAdded}
            {data.summary.totalUnitsRemoved > 0 && (
              <span className="text-destructive"> / -{data.summary.totalUnitsRemoved}</span>
            )}
            {" "}Units
          </span>
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
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.dailyData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.5}
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
              />
              {hasRemovals && (
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
              )}
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
                formatter={((value: any, name: any) => {
                  const absVal = Math.abs(Number(value));
                  return [absVal, name];
                }) as any}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px", paddingTop: "8px", color: "hsl(var(--foreground))" }}
              />
              <Bar
                dataKey="propertiesAdded"
                name="Properties Added"
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
                animationDuration={600}
              />
              <Bar
                dataKey="unitsAdded"
                name="Units Added"
                fill="var(--chart-2)"
                radius={[4, 4, 0, 0]}
                animationDuration={600}
              />
              {hasRemovals && (
                <>
                  <Bar
                    dataKey="propertiesRemoved"
                    name="Properties Removed"
                    fill="#ef4444"
                    radius={[0, 0, 4, 4]}
                    animationDuration={600}
                  />
                  <Bar
                    dataKey="unitsRemoved"
                    name="Units Removed"
                    fill="#f97316"
                    radius={[0, 0, 4, 4]}
                    animationDuration={600}
                  />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

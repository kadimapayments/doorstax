"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  Zap,
  Shield,
  Download,
  CalendarDays,
  ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface RentProfileData {
  tenant: {
    name: string;
    email: string;
    unit: string;
    property: string;
    address: string;
    leaseStart: string | null;
    leaseEnd: string | null;
    monthlyRent: number | null;
  };
  score: {
    paymentScore: number;
    onTimeRate: number;
    consistency: "Excellent" | "Good" | "Fair" | "Poor";
    riskLevel: "Low" | "Medium" | "High";
    avgDaysToPay: number;
    consecutiveOnTime: number;
    totalPaid: number;
  };
  monthlyPayments: { month: string; amount: number; onTime: boolean }[];
  payments: {
    id: string;
    dueDate: string;
    paidAt: string | null;
    amount: number;
    status: string;
    paymentMethod: string | null;
    daysLate: number;
  }[];
  summary: {
    totalPayments: number;
    completedPayments: number;
    totalMonths: number;
  };
}

const consistencyColor: Record<string, string> = {
  Excellent: "text-emerald-500",
  Good: "text-blue-500",
  Fair: "text-amber-500",
  Poor: "text-red-500",
};

const consistencyBg: Record<string, string> = {
  Excellent: "bg-emerald-500/15 border-emerald-500/20",
  Good: "bg-blue-500/15 border-blue-500/20",
  Fair: "bg-amber-500/15 border-amber-500/20",
  Poor: "bg-red-500/15 border-red-500/20",
};

const riskColor: Record<string, string> = {
  Low: "text-emerald-500",
  Medium: "text-amber-500",
  High: "text-red-500",
};

const riskBg: Record<string, string> = {
  Low: "bg-emerald-500/15 border-emerald-500/20",
  Medium: "bg-amber-500/15 border-amber-500/20",
  High: "bg-red-500/15 border-red-500/20",
};

export default function RentProfilePage() {
  const [data, setData] = useState<RentProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tenant/rent-profile");
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
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Unable to load rent profile data.</p>
      </div>
    );
  }

  const { tenant, score, monthlyPayments, payments, summary } = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rent Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tenant.property} &middot; Unit {tenant.unit}
        </p>
      </div>

      {/* Score Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-stagger">
        <MetricCard
          label="Payment Score"
          value={`${score.paymentScore}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          className={
            score.paymentScore >= 90
              ? "border-emerald-500/30 bg-emerald-500/5"
              : score.paymentScore >= 70
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-destructive/30 bg-destructive/5"
          }
        />
        <MetricCard
          label="On-Time Rate"
          value={`${score.onTimeRate}%`}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <MetricCard
          label="Avg Days to Pay"
          value={score.avgDaysToPay}
          icon={<Clock className="h-4 w-4" />}
        />
        <MetricCard
          label="On-Time Streak"
          value={score.consecutiveOnTime}
          icon={<Zap className="h-4 w-4" />}
        />
      </div>

      {/* DoorStax Payment Score Card */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            DoorStax Payment Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {/* On-Time Rate */}
            <div className="text-center space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                On-Time Rate
              </p>
              <p className={`text-2xl font-bold ${score.onTimeRate >= 90 ? "text-emerald-500" : score.onTimeRate >= 70 ? "text-amber-500" : "text-red-500"}`}>
                {score.onTimeRate}%
              </p>
              <div className="mx-auto h-1.5 w-full max-w-[120px] overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${score.onTimeRate >= 90 ? "bg-emerald-500" : score.onTimeRate >= 70 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${score.onTimeRate}%` }}
                />
              </div>
            </div>

            {/* Consistency */}
            <div className="text-center space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Consistency
              </p>
              <Badge
                variant="outline"
                className={`text-sm font-bold px-3 py-1 ${consistencyColor[score.consistency]} ${consistencyBg[score.consistency]}`}
              >
                {score.consistency}
              </Badge>
            </div>

            {/* Risk Level */}
            <div className="text-center space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Risk Level
              </p>
              <Badge
                variant="outline"
                className={`text-sm font-bold px-3 py-1 ${riskColor[score.riskLevel]} ${riskBg[score.riskLevel]}`}
              >
                {score.riskLevel}
              </Badge>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-border pt-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total Paid</p>
              <p className="text-sm font-bold">{formatCurrency(score.totalPaid)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Payments</p>
              <p className="text-sm font-bold">
                {summary.completedPayments}/{summary.totalPayments}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Months Tracked</p>
              <p className="text-sm font-bold">{summary.totalMonths}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment History Chart */}
      {monthlyPayments.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyPayments}>
                  <defs>
                    <linearGradient id="paymentGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5B00FF" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#5B00FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.4}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                    tickFormatter={(v: number) =>
                      `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(value) => [
                      formatCurrency(Number(value)),
                      "Amount Paid",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#5B00FF"
                    strokeWidth={2.5}
                    fill="url(#paymentGradient)"
                    dot={{ r: 3, fill: "#5B00FF" }}
                    activeDot={{ r: 5, strokeWidth: 2 }}
                    animationDuration={800}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Timeline */}
      {payments.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Payment Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {payments.map((p, idx) => {
                const isOnTime = p.status === "COMPLETED" && p.daysLate === 0;
                const isLate = p.status === "COMPLETED" && p.daysLate > 0;
                const isFailed = p.status === "FAILED";
                const isPending = p.status === "PENDING";

                return (
                  <div key={p.id} className="relative flex gap-4 pb-6 last:pb-0">
                    {/* Timeline line */}
                    {idx < payments.length - 1 && (
                      <div className="absolute left-[11px] top-6 h-full w-[2px] bg-border" />
                    )}
                    {/* Dot */}
                    <div
                      className={`relative z-10 mt-0.5 h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center ${
                        isOnTime
                          ? "border-emerald-500 bg-emerald-500/15"
                          : isLate
                          ? "border-amber-500 bg-amber-500/15"
                          : isFailed
                          ? "border-red-500 bg-red-500/15"
                          : "border-muted-foreground/30 bg-muted"
                      }`}
                    >
                      {isOnTime && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                      {isLate && <Clock className="h-3 w-3 text-amber-500" />}
                      {isFailed && <span className="text-[10px] text-red-500 font-bold">!</span>}
                      {isPending && <span className="text-[10px] text-muted-foreground">•</span>}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">
                            {formatCurrency(p.amount)}
                          </span>
                          <StatusBadge status={p.status} />
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          Due {formatDate(p.dueDate)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        {p.paidAt && <span>Paid {formatDate(p.paidAt)}</span>}
                        {isOnTime && (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] px-1.5 py-0">
                            On Time
                          </Badge>
                        )}
                        {isLate && (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px] px-1.5 py-0">
                            {p.daysLate} days late
                          </Badge>
                        )}
                        {p.paymentMethod && (
                          <span className="uppercase">{p.paymentMethod}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Download Section */}
      <Card className="border-border bg-primary/5">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" />
                Certified Rent Profile
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Download a verified rent payment record for mortgage applications,
                rental references, or credit verification.
              </p>
            </div>
            <Button
              className="gradient-bg shrink-0"
              onClick={() => window.open("/api/statements/rent-record?months=12", "_blank")}
            >
              Download PDF
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  TrendingUp,
  Scale,
  Banknote,
  FileText,
  Building2,
  Shield,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

type ReportType =
  | "profit-loss"
  | "balance-sheet"
  | "cash-flow"
  | "rent-roll"
  | "trust";

const PRESETS = [
  { label: "This Month", value: "this-month" },
  { label: "Last Month", value: "last-month" },
  { label: "This Quarter", value: "this-quarter" },
  { label: "This Year", value: "this-year" },
];

function getPresetDates(preset: string) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case "last-month":
      return {
        start: new Date(y, m - 1, 1),
        end: new Date(y, m, 0, 23, 59, 59),
      };
    case "this-quarter": {
      const qStart = Math.floor(m / 3) * 3;
      return { start: new Date(y, qStart, 1), end: now };
    }
    case "this-year":
      return { start: new Date(y, 0, 1), end: now };
    default: // this-month
      return { start: new Date(y, m, 1), end: now };
  }
}

export default function AccountingReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType | null>(null);
  const [preset, setPreset] = useState("this-month");
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reportData, setReportData] = useState<any>(null);

  async function loadReport(type: ReportType) {
    setActiveReport(type);
    setLoading(true);
    setReportData(null);

    try {
      const dates = getPresetDates(preset);
      let url = "";

      switch (type) {
        case "profit-loss":
          url = `/api/accounting/reports/profit-loss?startDate=${dates.start.toISOString()}&endDate=${dates.end.toISOString()}`;
          break;
        case "balance-sheet":
          url = `/api/accounting/reports/balance-sheet?asOfDate=${dates.end.toISOString()}`;
          break;
        case "cash-flow":
          url = `/api/accounting/reports/cash-flow?startDate=${dates.start.toISOString()}&endDate=${dates.end.toISOString()}`;
          break;
        case "rent-roll":
          url = "/api/accounting/reports/rent-roll";
          break;
        case "trust":
          url = "/api/accounting/trust";
          break;
      }

      const res = await fetch(url);
      if (res.ok) setReportData(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  const reports = [
    {
      type: "profit-loss" as const,
      label: "Profit & Loss",
      icon: TrendingUp,
      description: "Revenue minus expenses for a period",
      color: "text-emerald-500",
    },
    {
      type: "balance-sheet" as const,
      label: "Balance Sheet",
      icon: Scale,
      description: "Assets = Liabilities + Equity",
      color: "text-blue-500",
    },
    {
      type: "cash-flow" as const,
      label: "Cash Flow",
      icon: Banknote,
      description: "Cash movements through bank accounts",
      color: "text-amber-500",
    },
    {
      type: "rent-roll" as const,
      label: "Rent Roll",
      icon: Building2,
      description: "All units with rent and occupancy",
      color: "text-purple-500",
    },
    {
      type: "trust" as const,
      label: "Trust Account",
      icon: Shield,
      description: "Trust balance vs liabilities",
      color: "text-red-500",
    },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/accounting"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Accounting
      </Link>

      <PageHeader
        title="Financial Reports"
        description="Generate P&L, balance sheet, cash flow, rent roll, and trust reports."
      />

      {/* Date preset */}
      <div className="flex items-center gap-3">
        <Label className="text-sm">Period:</Label>
        <Select value={preset} onValueChange={setPreset}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Report selector */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {reports.map((r) => (
          <button
            key={r.type}
            onClick={() => loadReport(r.type)}
            className={cn(
              "rounded-xl border bg-card p-4 text-left transition-all hover:shadow-sm",
              activeReport === r.type
                ? "border-primary ring-1 ring-primary/20"
                : "border-border"
            )}
          >
            <r.icon className={cn("h-5 w-5 mb-2", r.color)} />
            <p className="text-sm font-semibold">{r.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {r.description}
            </p>
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Report Display */}
      {!loading && reportData && activeReport === "profit-loss" && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Profit & Loss Statement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Revenue */}
            <div>
              <h3 className="text-sm font-semibold text-emerald-600 mb-2">
                Revenue
              </h3>
              <div className="space-y-1">
                {reportData.revenue?.map(
                  (r: { code: string; name: string; balance: number }) => (
                    <div
                      key={r.code || r.name}
                      className="flex justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        {r.code && (
                          <span className="font-mono mr-2">{r.code}</span>
                        )}
                        {r.name}
                      </span>
                      <span>{fmt(r.balance)}</span>
                    </div>
                  )
                )}
                <div className="flex justify-between text-sm font-semibold border-t pt-1">
                  <span>Total Revenue</span>
                  <span className="text-emerald-600">
                    {fmt(reportData.totalRevenue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Expenses */}
            <div>
              <h3 className="text-sm font-semibold text-red-600 mb-2">
                Expenses
              </h3>
              <div className="space-y-1">
                {reportData.expenses?.map(
                  (e: { code: string; name: string; balance: number }) => (
                    <div
                      key={e.code || e.name}
                      className="flex justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        {e.code && (
                          <span className="font-mono mr-2">{e.code}</span>
                        )}
                        {e.name}
                      </span>
                      <span>{fmt(e.balance)}</span>
                    </div>
                  )
                )}
                <div className="flex justify-between text-sm font-semibold border-t pt-1">
                  <span>Total Expenses</span>
                  <span className="text-red-600">
                    {fmt(reportData.totalExpenses)}
                  </span>
                </div>
              </div>
            </div>

            {/* Net Income */}
            <div className="flex justify-between text-base font-bold border-t-2 pt-3">
              <span>Net Income</span>
              <span
                className={
                  reportData.netIncome >= 0
                    ? "text-emerald-600"
                    : "text-red-600"
                }
              >
                {fmt(reportData.netIncome)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && reportData && activeReport === "balance-sheet" && (
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Balance Sheet</CardTitle>
              <Badge
                variant={
                  reportData.isBalanced ? "outline" : "destructive"
                }
              >
                {reportData.isBalanced ? "Balanced" : "UNBALANCED"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {[
              {
                title: "Assets",
                items: reportData.assets,
                total: reportData.totalAssets,
                color: "text-blue-600",
              },
              {
                title: "Liabilities",
                items: reportData.liabilities,
                total: reportData.totalLiabilities,
                color: "text-amber-600",
              },
              {
                title: "Equity",
                items: reportData.equity,
                total: reportData.totalEquity,
                color: "text-purple-600",
              },
            ].map((section) => (
              <div key={section.title}>
                <h3
                  className={cn(
                    "text-sm font-semibold mb-2",
                    section.color
                  )}
                >
                  {section.title}
                </h3>
                <div className="space-y-1">
                  {section.items?.map(
                    (
                      item: {
                        code: string;
                        name: string;
                        balance: number;
                      },
                      i: number
                    ) => (
                      <div
                        key={item.code || item.name + i}
                        className="flex justify-between text-sm"
                      >
                        <span className="text-muted-foreground">
                          {item.code && (
                            <span className="font-mono mr-2">
                              {item.code}
                            </span>
                          )}
                          {item.name}
                        </span>
                        <span>{fmt(item.balance)}</span>
                      </div>
                    )
                  )}
                  <div className="flex justify-between text-sm font-semibold border-t pt-1">
                    <span>Total {section.title}</span>
                    <span className={section.color}>
                      {fmt(section.total)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!loading && reportData && activeReport === "cash-flow" && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Cash Flow Statement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Inflows</p>
                <p className="text-lg font-bold text-emerald-600">
                  {fmt(reportData.inflows)}
                </p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Outflows</p>
                <p className="text-lg font-bold text-red-600">
                  {fmt(reportData.outflows)}
                </p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Net Change</p>
                <p
                  className={cn(
                    "text-lg font-bold",
                    reportData.netCashChange >= 0
                      ? "text-emerald-600"
                      : "text-red-600"
                  )}
                >
                  {fmt(reportData.netCashChange)}
                </p>
              </div>
            </div>
            {reportData.details?.length > 0 && (
              <div className="rounded-lg border overflow-hidden max-h-[300px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                        Date
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                        Description
                      </th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.details.map(
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (d: any, i: number) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2 text-xs">
                            {new Date(d.date).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {d.memo || d.source}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2 text-xs text-right font-medium",
                              d.amount >= 0
                                ? "text-emerald-600"
                                : "text-red-600"
                            )}
                          >
                            {fmt(d.amount)}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && reportData && activeReport === "rent-roll" && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Rent Roll</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Units</p>
                <p className="text-lg font-bold">
                  {reportData.summary?.totalUnits}
                </p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Occupied</p>
                <p className="text-lg font-bold text-emerald-600">
                  {reportData.summary?.occupiedUnits}
                </p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Occupancy</p>
                <p className="text-lg font-bold">
                  {Math.round(
                    (reportData.summary?.occupancyRate || 0) * 100
                  )}
                  %
                </p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Monthly Rent</p>
                <p className="text-lg font-bold">
                  {fmt(reportData.summary?.totalMonthlyRent || 0)}
                </p>
              </div>
            </div>
            {/* Table */}
            {reportData.rentRoll?.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                        Property
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                        Unit
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                        Tenant
                      </th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">
                        Rent
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.rentRoll.map(
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (row: any, i: number) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">
                            {row.propertyName}
                          </td>
                          <td className="px-3 py-2">{row.unitNumber}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {row.tenantName || "\u2014"}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            {fmt(row.monthlyRent)}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant={
                                row.isOccupied ? "outline" : "secondary"
                              }
                              className="text-[10px]"
                            >
                              {row.isOccupied ? "Occupied" : "Vacant"}
                            </Badge>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && reportData && activeReport === "trust" && (
        <Card
          className={cn(
            "border-border",
            !reportData.isInBalance && "border-red-500/30"
          )}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Trust Account Status</CardTitle>
              {reportData.isInBalance ? (
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  In Balance
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  Variance: {fmt(reportData.variance)}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Trust Bank Balance
                </span>
                <span className="font-semibold">
                  {fmt(reportData.trustBankBalance)}
                </span>
              </div>
              <div className="border-t pt-2 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Security Deposits Held
                  </span>
                  <span>{fmt(reportData.securityDepositsHeld)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Owner Funds Payable
                  </span>
                  <span>{fmt(reportData.ownerFundsPayable)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Tenant Prepaid Rent
                  </span>
                  <span>{fmt(reportData.tenantPrepaidRent)}</span>
                </div>
              </div>
              <div className="flex justify-between text-sm font-semibold border-t pt-2">
                <span>Total Trust Liabilities</span>
                <span>{fmt(reportData.totalLiabilities)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

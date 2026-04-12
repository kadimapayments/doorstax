"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Download,
  FileText,
  FileSpreadsheet,
} from "lucide-react";

const REPORT_TYPES = [
  {
    id: "payment-summary",
    label: "Payment Summary",
    description: "All payments with tenant, property, and status details.",
  },
  {
    id: "property-income",
    label: "Property Income",
    description: "Revenue breakdown by property.",
  },
  {
    id: "delinquency",
    label: "Delinquency",
    description: "Tenants with no payment in the selected period.",
  },
];

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default function ReportsPage() {
  const [metrics, setMetrics] = useState({
    collected: 0,
    pending: 0,
    failed: 0,
    total: 0,
  });

  const now = new Date();
  const [from, setFrom] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  );
  const [to, setTo] = useState(now.toISOString().split("T")[0]);

  useEffect(() => {
    // Fetch summary metrics
    fetch(`/api/reports?type=payment-summary&from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const collected = data
            .filter((r: { status: string }) => r.status === "COMPLETED")
            .reduce((s: number, r: { amount: number }) => s + r.amount, 0);
          const pending = data
            .filter((r: { status: string }) => r.status === "PENDING")
            .reduce((s: number, r: { amount: number }) => s + r.amount, 0);
          const failed = data
            .filter((r: { status: string }) => r.status === "FAILED")
            .reduce((s: number, r: { amount: number }) => s + r.amount, 0);
          setMetrics({ collected, pending, failed, total: data.length });
        }
      });
  }, [from, to]);

  function download(type: string, format: string) {
    window.open(`/api/reports?type=${type}&format=${format}&from=${from}&to=${to}`, "_blank");
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Generate and download reports." />

      {/* Date range */}
      <div className="flex items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const d = new Date();
              setFrom(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0]);
              setTo(d.toISOString().split("T")[0]);
            }}
          >
            This Month
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const d = new Date();
              setFrom(new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split("T")[0]);
              setTo(new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split("T")[0]);
            }}
          >
            Last Month
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const d = new Date();
              setFrom(new Date(d.getFullYear(), d.getMonth() - 3, 1).toISOString().split("T")[0]);
              setTo(d.toISOString().split("T")[0]);
            }}
          >
            Last 3 Months
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Collected"
          value={formatCurrency(metrics.collected)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          label="Pending"
          value={formatCurrency(metrics.pending)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <MetricCard
          label="Failed"
          value={formatCurrency(metrics.failed)}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <MetricCard
          label="Total Transactions"
          value={metrics.total}
          icon={<BarChart3 className="h-4 w-4" />}
        />
      </div>

      {/* Report download cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_TYPES.map((report) => (
          <Card key={report.id} className="border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="h-4 w-4" />
                {report.label}
              </CardTitle>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => download(report.id, "csv")}
                >
                  <FileSpreadsheet className="mr-1 h-3 w-3" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => download(report.id, "pdf")}
                >
                  <FileText className="mr-1 h-3 w-3" />
                  PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

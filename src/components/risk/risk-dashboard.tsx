"use client";

import { useEffect, useState, Fragment } from "react";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Ban, RotateCcw, AlertTriangle, Clock, UserX, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface FlaggedRow {
  id: string;
  tenant: string;
  property: string;
  unit: string;
  amount: number;
  status: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  failureCount: number;
  date: string;
}

interface AtRiskTenant {
  tenantId: string;
  name: string;
  email: string;
  failureCount: number;
}

interface RiskData {
  metrics: {
    totalPayments: number;
    failedCount: number;
    refundedCount: number;
    failedRate: string;
    lateCount: number;
    totalLateAmount: number;
    atRiskCount: number;
  };
  flagged: FlaggedRow[];
  latePayments: FlaggedRow[];
  atRiskTenants: AtRiskTenant[];
}

export function RiskDashboard() {
  const [data, setData] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/risk")
      .then((res) => res.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-center text-muted-foreground py-10">Failed to load risk data.</p>;
  }

  const { metrics, flagged, latePayments, atRiskTenants } = data;

  return (
    <div className="space-y-8">
      <PageHeader title="Risk Overview" description="Payment failures, late payments, and at-risk tenants across your portfolio." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Failed" value={metrics.failedCount} icon={<Ban className="h-4 w-4" />} />
        <MetricCard label="Refunded" value={metrics.refundedCount} icon={<RotateCcw className="h-4 w-4" />} />
        <MetricCard label="Failure Rate" value={`${metrics.failedRate}%`} icon={<AlertTriangle className="h-4 w-4" />} />
        <MetricCard label="Late Payments" value={metrics.lateCount} icon={<Clock className="h-4 w-4" />} />
        <MetricCard label="At-Risk Tenants" value={metrics.atRiskCount} icon={<UserX className="h-4 w-4" />} />
      </div>

      {/* Flagged Transactions */}
      {flagged.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Flagged Transactions</h2>
          <RiskTableSection rows={flagged} expandedId={expandedId} onToggle={(id) => setExpandedId(expandedId === id ? null : id)} />
        </div>
      )}

      {/* Late Payments */}
      {latePayments.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Late Payments</h2>
          <RiskTableSection rows={latePayments} expandedId={expandedId} onToggle={(id) => setExpandedId(expandedId === id ? null : id)} />
        </div>
      )}

      {/* At-Risk Tenants */}
      {atRiskTenants.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">At-Risk Tenants</h2>
          <div className="rounded-lg border border-border card-glow">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Tenant</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Failures</TableHead>
                  <TableHead>Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atRiskTenants.map((t) => (
                  <TableRow key={t.tenantId} className="border-border">
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">{t.email}</TableCell>
                    <TableCell>{t.failureCount}</TableCell>
                    <TableCell>
                      <SeverityBadge severity={t.failureCount >= 3 ? "HIGH" : "MEDIUM"} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {flagged.length === 0 && latePayments.length === 0 && atRiskTenants.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          No risk flags across your portfolio. All payments are on track.
        </div>
      )}
    </div>
  );
}

function RiskTableSection({
  rows,
  expandedId,
  onToggle,
}: {
  rows: FlaggedRow[];
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border card-glow">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="w-8" />
            <TableHead>Severity</TableHead>
            <TableHead>Tenant</TableHead>
            <TableHead>Property</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const isExpanded = expandedId === row.id;
            return (
              <Fragment key={row.id}>
                <TableRow
                  className="border-border cursor-pointer hover:bg-muted/50"
                  onClick={() => onToggle(row.id)}
                  role="button"
                >
                  <TableCell className="w-8">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell><SeverityBadge severity={row.severity} /></TableCell>
                  <TableCell>{row.tenant}</TableCell>
                  <TableCell>{row.property}</TableCell>
                  <TableCell>{row.unit}</TableCell>
                  <TableCell>{formatCurrency(row.amount)}</TableCell>
                  <TableCell><StatusBadge status={row.status} /></TableCell>
                  <TableCell>{formatDate(new Date(row.date))}</TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow className="border-border">
                    <TableCell colSpan={8} className="p-4 bg-muted/20">
                      <div className="text-sm space-y-1">
                        <p><span className="text-muted-foreground">Property:</span> {row.property} — Unit {row.unit}</p>
                        <p><span className="text-muted-foreground">Amount:</span> {formatCurrency(row.amount)}</p>
                        <p><span className="text-muted-foreground">Failure Count:</span> {row.failureCount}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

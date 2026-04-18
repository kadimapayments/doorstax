"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonStats, SkeletonTable } from "@/components/ui/skeleton-loader";
import { formatCurrency } from "@/lib/utils";
import {
  Receipt,
  TrendingUp,
  AlertCircle,
  Users,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const TIERS = ["Starter", "Growth", "Scale", "Enterprise"];
const STATUSES = ["PENDING", "PAID", "WAIVED", "FAILED"];

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const INVOICE_STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  PAID: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  WAIVED: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  FAILED: "bg-red-500/10 text-red-500 border-red-500/20",
};

const SUB_STATUS_CLASS: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  TRIALING: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  PAST_DUE: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  CANCELLED: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export default function AdminBillingPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const defaultPeriod =
    now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  const [period, setPeriod] = useState(defaultPeriod);
  const [status, setStatus] = useState("");
  const [tier, setTier] = useState("");

  async function fetchData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (period) params.set("period", period);
      if (status) params.set("status", status);
      if (tier) params.set("tier", tier);
      const res = await fetch("/api/admin/billing?" + params.toString());
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, status, tier]);

  const totals = data?.totals || {};
  const upcoming: any[] = data?.upcoming || [];
  const periodInvoices: any[] = data?.periodInvoices || [];
  const subscriptions: any[] = data?.subscriptions || [];

  return (
    <div className="space-y-6 page-enter">
      <PageHeader
        title="Billing"
        description="Upcoming invoices, current-period activity, and all active subscriptions across every property manager."
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Period
          </label>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg border bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border bg-background px-3 py-1.5 text-sm"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Tier
          </label>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="rounded-lg border bg-background px-3 py-1.5 text-sm"
          >
            <option value="">All tiers</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      {loading ? (
        <SkeletonStats count={4} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-stagger">
          <Stat
            icon={<Clock className="h-4 w-4" />}
            label="Upcoming Billed"
            value={formatCurrency(totals.upcomingAmount || 0)}
            sub={`${upcoming.length} invoices`}
          />
          <Stat
            icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
            label="Collected This Period"
            value={formatCurrency(totals.periodCollected || 0)}
          />
          <Stat
            icon={<AlertCircle className="h-4 w-4 text-amber-500" />}
            label="Outstanding This Period"
            value={formatCurrency(totals.periodOutstanding || 0)}
          />
          <Stat
            icon={<Users className="h-4 w-4" />}
            label="Active Subscriptions"
            value={String(totals.activeSubscriptions || 0)}
            sub={`${totals.trialingSubscriptions || 0} trialing · ${totals.pastDueSubscriptions || 0} past due`}
          />
        </div>
      )}

      {/* Upcoming invoices */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Upcoming invoices
        </h2>
        {loading ? (
          <Card className="border-border">
            <CardContent className="p-5">
              <SkeletonTable rows={4} />
            </CardContent>
          </Card>
        ) : upcoming.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-12 w-12" />}
            title="No upcoming invoices"
            description="When BillingInvoices are generated for the next period they'll appear here."
          />
        ) : (
          <InvoiceTable rows={upcoming} />
        )}
      </section>

      {/* Period invoices */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {period} invoices
        </h2>
        {loading ? (
          <Card className="border-border">
            <CardContent className="p-5">
              <SkeletonTable rows={4} />
            </CardContent>
          </Card>
        ) : periodInvoices.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-12 w-12" />}
            title={`No invoices in ${period}`}
            description="Change the period, or wait for the next billing cycle to run."
          />
        ) : (
          <InvoiceTable rows={periodInvoices} />
        )}
      </section>

      {/* Subscriptions */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          All subscriptions
        </h2>
        {loading ? (
          <Card className="border-border">
            <CardContent className="p-5">
              <SkeletonTable rows={6} />
            </CardContent>
          </Card>
        ) : subscriptions.length === 0 ? (
          <EmptyState
            icon={<Users className="h-12 w-12" />}
            title="No subscriptions yet"
            description="Subscriptions appear here once PMs have signed up."
          />
        ) : (
          <Card className="border-border">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground uppercase tracking-wider">
                      <th className="text-left p-3">PM</th>
                      <th className="text-left p-3">Tier</th>
                      <th className="text-right p-3">Monthly</th>
                      <th className="text-center p-3">Status</th>
                      <th className="text-left p-3">Next Billing</th>
                      <th className="text-left p-3">Trial Ends</th>
                      <th className="text-center p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b last:border-0 hover:bg-muted/20"
                      >
                        <td className="p-3">
                          <div className="font-medium">{s.pmName}</div>
                          <div className="text-xs text-muted-foreground">{s.pmEmail}</div>
                        </td>
                        <td className="p-3">{s.tier}</td>
                        <td className="p-3 text-right font-medium">
                          {formatCurrency(s.currentAmount)}
                        </td>
                        <td className="p-3 text-center">
                          <Badge
                            variant="outline"
                            className={
                              SUB_STATUS_CLASS[s.status] || SUB_STATUS_CLASS.CANCELLED
                            }
                          >
                            {s.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {fmtDate(s.nextBillingDate)}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {fmtDate(s.trialEndsAt)}
                        </td>
                        <td className="p-3 text-center">
                          <Link
                            href={`/admin/merchants`}
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                            title="View PM profile"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="border-border card-hover">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
          {icon}
          <span>{label}</span>
        </div>
        <p className="text-2xl font-bold mt-2">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function InvoiceTable({ rows }: { rows: any[] }) {
  return (
    <Card className="border-border">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground uppercase tracking-wider">
                <th className="text-left p-3">PM</th>
                <th className="text-left p-3">Invoice</th>
                <th className="text-left p-3">Tier</th>
                <th className="text-right p-3">Units</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-right p-3">Credit</th>
                <th className="text-right p-3">Net</th>
                <th className="text-center p-3">Status</th>
                <th className="text-left p-3">Due / Paid</th>
                <th className="text-center p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3">
                    <div className="font-medium">{r.pmName}</div>
                    <div className="text-xs text-muted-foreground">{r.pmEmail}</div>
                  </td>
                  <td className="p-3 font-mono text-xs">{r.invoiceNumber}</td>
                  <td className="p-3">{r.tierName}</td>
                  <td className="p-3 text-right">{r.unitCount}</td>
                  <td className="p-3 text-right">{formatCurrency(r.amount)}</td>
                  <td className="p-3 text-right text-muted-foreground">
                    {r.creditAmount > 0 ? "-" + formatCurrency(r.creditAmount) : "—"}
                  </td>
                  <td className="p-3 text-right font-medium">
                    {formatCurrency(r.netAmount)}
                  </td>
                  <td className="p-3 text-center">
                    <Badge
                      variant="outline"
                      className={
                        INVOICE_STATUS_CLASS[r.status] || INVOICE_STATUS_CLASS.PENDING
                      }
                    >
                      {r.status === "PAID" && (
                        <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                      )}
                      {r.status === "FAILED" && (
                        <XCircle className="h-2.5 w-2.5 mr-1" />
                      )}
                      {r.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {r.paidAt ? `Paid ${fmtDate(r.paidAt)}` : `Due ${fmtDate(r.dueDate)}`}
                  </td>
                  <td className="p-3 text-center">
                    <Link
                      href={`/admin/merchants`}
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      title="View PM"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

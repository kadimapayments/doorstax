"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonTable } from "@/components/ui/skeleton-loader";
import {
  RecoveryProgressBar,
  RecoveryStatusBadge,
  type RecoveryPlanStatus,
} from "@/components/recovery/progress-bar";
import { formatCurrency } from "@/lib/utils";
import { LifeBuoy, AlertTriangle, ExternalLink } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const FILTERS: Array<{ value: string; label: string }> = [
  { value: "ACTIVE", label: "Active queue" },
  { value: "HISTORY", label: "History" },
  { value: "ALL", label: "All" },
];

const ACTIVE_STATUSES: RecoveryPlanStatus[] = [
  "PLAN_OFFERED",
  "PLAN_ACTIVE",
  "PLAN_AT_RISK",
];
const HISTORY_STATUSES: RecoveryPlanStatus[] = [
  "PLAN_COMPLETED",
  "PLAN_FAILED",
  "PLAN_CANCELLED",
];

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DelinquencyHubPage() {
  const [filter, setFilter] = useState<string>("ACTIVE");
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/recovery-plans");
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled) setPlans(body.plans || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const statuses: RecoveryPlanStatus[] =
      filter === "ACTIVE"
        ? ACTIVE_STATUSES
        : filter === "HISTORY"
          ? HISTORY_STATUSES
          : [...ACTIVE_STATUSES, ...HISTORY_STATUSES];
    return plans.filter((p: any) => statuses.includes(p.status));
  }, [plans, filter]);

  const activeCount = useMemo(
    () =>
      plans.filter((p: any) => ACTIVE_STATUSES.includes(p.status)).length,
    [plans]
  );

  return (
    <div className="space-y-6 page-enter">
      <PageHeader
        title="Delinquency"
        description="Structured repayment plans with forgiveness terms. Offer one from a delinquent tenant's row on Unpaid Rent."
        actions={
          <Link href="/dashboard/unpaid">
            <button className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Go to Unpaid Rent
            </button>
          </Link>
        }
      />

      <div className="flex items-end justify-between gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            View
          </label>
          <div className="flex gap-1 rounded-lg border bg-muted/10 p-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1 text-sm rounded transition ${
                  filter === f.value
                    ? "bg-background shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          {loading ? "…" : `${activeCount} active`}
        </div>
      </div>

      {loading ? (
        <Card className="border-border">
          <CardContent className="p-5">
            <SkeletonTable rows={5} />
          </CardContent>
        </Card>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<LifeBuoy className="h-12 w-12" />}
          title={
            filter === "HISTORY"
              ? "No plan history yet"
              : "No recovery plans yet"
          }
          description={
            filter === "HISTORY"
              ? "Once plans complete, fail, or get cancelled, they'll show up here."
              : "Start one by going to Unpaid Rent and clicking 'Offer plan' on a delinquent tenant's row."
          }
        />
      ) : (
        <Card className="border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="text-left p-3">Tenant</th>
                    <th className="text-left p-3">Property / Unit</th>
                    <th className="text-right p-3">Balance</th>
                    <th className="text-right p-3">Forgive</th>
                    <th className="text-left p-3 w-[180px]">Progress</th>
                    <th className="text-center p-3">Status</th>
                    <th className="text-left p-3">Updated</th>
                    <th className="text-center p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((plan: any) => (
                    <tr
                      key={plan.id}
                      className="border-b last:border-0 hover:bg-muted/20"
                    >
                      <td className="p-3">
                        <Link
                          href={`/dashboard/delinquency/${plan.id}`}
                          className="font-medium hover:underline"
                        >
                          {plan.tenant?.user?.name || "—"}
                        </Link>
                        <div className="text-[11px] text-muted-foreground">
                          {plan.tenant?.user?.email || ""}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium">
                          {plan.property?.name || "—"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Unit {plan.unit?.unitNumber || "—"}
                        </div>
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {formatCurrency(Number(plan.originalBalance))}
                      </td>
                      <td className="p-3 text-right tabular-nums text-emerald-600">
                        {formatCurrency(Number(plan.forgivenessAmount))}
                      </td>
                      <td className="p-3">
                        <RecoveryProgressBar
                          completed={plan.completedPayments}
                          required={plan.requiredPayments}
                          status={plan.status}
                          compact
                        />
                      </td>
                      <td className="p-3 text-center">
                        <RecoveryStatusBadge status={plan.status} />
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {fmtDate(plan.updatedAt)}
                      </td>
                      <td className="p-3 text-center">
                        <Link
                          href={`/dashboard/delinquency/${plan.id}`}
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Open <ExternalLink className="h-3 w-3" />
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
    </div>
  );
}

"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  RefreshCw,
  Shield,
  PlayCircle,
  X,
  Loader2,
  User as UserIcon,
  Building2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import {
  RecoveryProgressBar,
  type RecoveryPlanStatus,
} from "@/components/recovery/progress-bar";
import { PaymentLogTable } from "@/components/recovery/payment-log-table";
import { AuditLogTable } from "@/components/recovery/audit-log-table";
import { ManualOverrideDialog } from "@/components/recovery/manual-override-dialog";
import { TenantNotesPanel } from "@/components/tenant-notes/tenant-notes-panel";

/* eslint-disable @typescript-eslint/no-explicit-any */

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DelinquencyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/recovery-plans/${id}`);
      if (res.ok) {
        const body = await res.json();
        setPlan(body.plan);
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || "Failed to load plan");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function doAction(action: "activate" | "cancel") {
    if (action === "cancel") {
      const reason = window.prompt(
        "Why are you cancelling this plan? (required)"
      );
      if (!reason || !reason.trim()) return;
      setActing(action);
      const res = await fetch(`/api/recovery-plans/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: reason.trim() }),
      });
      setActing(null);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Cancel failed");
        return;
      }
      toast.success("Plan cancelled");
      await load();
      return;
    }
    setActing(action);
    const res = await fetch(`/api/recovery-plans/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setActing(null);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(body.error || `${action} failed`);
      return;
    }
    toast.success(`Plan ${action}d`);
    await load();
  }

  async function doResync() {
    setActing("resync");
    try {
      const res = await fetch(`/api/recovery-plans/${id}/resync`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Re-sync failed");
        return;
      }
      toast.success(
        `Scanned ${body.scanned} payment${body.scanned === 1 ? "" : "s"}, applied ${body.applied}`
      );
      await load();
    } finally {
      setActing(null);
    }
  }

  if (loading || !plan) {
    return (
      <div className="space-y-6 page-enter">
        <PageHeader title="Loading recovery plan…" />
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </div>
    );
  }

  const status = plan.status as RecoveryPlanStatus;
  const canActivate = status === "PLAN_OFFERED";
  const canCancel = status === "PLAN_OFFERED";
  const canResync = status === "PLAN_ACTIVE" || status === "PLAN_AT_RISK";
  const tenantName = plan.tenant?.user?.name || "—";
  const unitLabel = plan.unit
    ? `${plan.property?.name || ""} — Unit ${plan.unit.unitNumber}`
    : plan.property?.name || "—";

  return (
    <div className="space-y-6 page-enter">
      <Link
        href="/dashboard/delinquency"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Delinquency
      </Link>

      <PageHeader
        title={tenantName}
        description={unitLabel}
        actions={
          <div className="flex items-center gap-2">
            {canActivate && (
              <Button
                size="sm"
                onClick={() => doAction("activate")}
                disabled={!!acting}
              >
                {acting === "activate" ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PlayCircle className="mr-2 h-3.5 w-3.5" />
                )}
                Activate
              </Button>
            )}
            {canCancel && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => doAction("cancel")}
                disabled={!!acting}
                className="border-red-500/40 text-red-600"
              >
                {acting === "cancel" ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="mr-2 h-3.5 w-3.5" />
                )}
                Cancel
              </Button>
            )}
            {canResync && (
              <Button
                size="sm"
                variant="outline"
                onClick={doResync}
                disabled={!!acting}
                title="Check for recent rent payments and apply them to this plan"
              >
                {acting === "resync" ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                )}
                Re-sync payments
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOverrideOpen(true)}
              className="border-amber-500/40 text-amber-700"
            >
              <Shield className="mr-2 h-3.5 w-3.5" />
              Override
            </Button>
          </div>
        }
      />

      {/* ── Context strip ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <UserIcon className="h-3 w-3" />
              Tenant
            </div>
            <div className="font-medium">{tenantName}</div>
            <div className="text-xs text-muted-foreground">
              {plan.tenant?.user?.email || ""}
            </div>
            {plan.tenant?.user?.phone && (
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {plan.tenant.user.phone}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              Property / Unit
            </div>
            <div className="font-medium">{plan.property?.name || "—"}</div>
            <div className="text-xs text-muted-foreground">
              Unit {plan.unit?.unitNumber || "—"}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Created
            </div>
            <div className="text-sm">
              {fmtDate(plan.createdAt)}
            </div>
            {plan.forgivenessAppliedAt && (
              <div className="text-[11px] text-emerald-600 mt-1">
                Forgiveness applied {fmtDate(plan.forgivenessAppliedAt)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Progress ── */}
      <Card className="border-border">
        <CardContent className="p-5">
          <RecoveryProgressBar
            completed={plan.completedPayments}
            required={plan.requiredPayments}
            status={status}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {(plan.requiredPeriodKeys || []).map((pk: string) => {
              const hit = (plan.paymentLogs || []).some(
                (l: any) => l.periodKey === pk && l.status === "COUNTED"
              );
              return (
                <span
                  key={pk}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-mono border ${
                    hit
                      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                      : "bg-muted/30 text-muted-foreground"
                  }`}
                >
                  {pk}
                  {hit && " ✓"}
                </span>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Terms ── */}
      <Card className="border-border">
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Deal terms
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Term
              k="Original balance"
              v={formatCurrency(Number(plan.originalBalance))}
            />
            <Term
              k="Forgive on completion"
              v={formatCurrency(Number(plan.forgivenessAmount))}
              emphasize
            />
            <Term k="Required payments" v={String(plan.requiredPayments)} />
            <Term k="Grace days" v={String(plan.graceDays)} />
            <Term k="Failure policy" v={plan.failurePolicy} />
            <Term k="Start date" v={fmtDate(plan.startDate)} />
            <Term k="End date" v={fmtDate(plan.endDate)} />
            {plan.forgivenessLedgerEntryId && (
              <Term
                k="Ledger entry"
                v={plan.forgivenessLedgerEntryId.slice(0, 12) + "…"}
              />
            )}
          </div>
          {plan.notes && (
            <div className="mt-3 rounded-md border bg-muted/20 p-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                Notes
              </div>
              <p className="text-sm whitespace-pre-wrap">{plan.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Tenant-facing message + notes ── */}
      {plan.tenantMessage && (
        <Card className="border-border">
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Message to tenant
            </h3>
            <p className="text-sm whitespace-pre-wrap">
              {plan.tenantMessage}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Visible to the tenant on their /tenant/recovery page.
            </p>
          </CardContent>
        </Card>
      )}

      <TenantNotesPanel
        tenantId={plan.tenantId}
        recoveryPlanId={plan.id}
        title="Plan notes"
      />

      {/* ── Payment logs ── */}
      <Card className="border-border">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Payments recorded
          </h3>
          <PaymentLogTable logs={plan.paymentLogs || []} />
        </CardContent>
      </Card>

      {/* ── Audit trail ── */}
      <Card className="border-border">
        <CardContent className="p-4">
          <AuditLogTable logs={plan.auditLogs || []} />
        </CardContent>
      </Card>

      <ManualOverrideDialog
        plan={plan}
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        onSaved={load}
      />
    </div>
  );
}

function Term({
  k,
  v,
  emphasize,
}: {
  k: string;
  v: string;
  emphasize?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
        {k}
      </div>
      <div
        className={`tabular-nums ${
          emphasize ? "text-emerald-600 font-semibold" : ""
        }`}
      >
        {v}
      </div>
    </div>
  );
}

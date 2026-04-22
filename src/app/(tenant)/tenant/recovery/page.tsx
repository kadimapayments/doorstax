export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";
import {
  RecoveryProgressBar,
  RecoveryStatusBadge,
  type RecoveryPlanStatus,
} from "@/components/recovery/progress-bar";
import { LifeBuoy, CheckCircle2, AlertCircle, Info, MessageSquare, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Recovery Plan" };

/**
 * Tenant-facing recovery plan view. Read-only — tenants can't modify
 * anything here. Shows current progress, remaining periods, forgiveness
 * amount, and the consequences of a miss. Terminal plans render a
 * summary (completed = celebrate; failed/cancelled = "contact PM").
 */
export default async function TenantRecoveryPage() {
  const user = await requireRole("TENANT");

  const profile = await db.tenantProfile.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      unit: {
        select: {
          unitNumber: true,
          property: { select: { name: true } },
        },
      },
    },
  });

  if (!profile) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          Your tenant profile is being set up. Please check back soon.
        </p>
      </div>
    );
  }

  const [activeRaw, latestTerminalRaw] = await Promise.all([
    db.recoveryPlan.findFirst({
      where: {
        tenantId: profile.id,
        status: { in: ["PLAN_OFFERED", "PLAN_ACTIVE", "PLAN_AT_RISK"] },
      },
      include: { paymentLogs: { orderBy: { createdAt: "asc" } } },
    }),
    db.recoveryPlan.findFirst({
      where: {
        tenantId: profile.id,
        status: { in: ["PLAN_FAILED", "PLAN_COMPLETED", "PLAN_CANCELLED"] },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  // Defence-in-depth: after the Cindy / Walter leak regression, we also
  // verify that any plan we're about to render is actually attached to
  // THIS tenant's profile. Prisma's where clause already enforces this,
  // but surfacing the check as an explicit guard makes it loud if a
  // future refactor drops the filter.
  const active =
    activeRaw && activeRaw.tenantId === profile.id ? activeRaw : null;
  const latestTerminal =
    latestTerminalRaw && latestTerminalRaw.tenantId === profile.id
      ? latestTerminalRaw
      : null;

  const unitLabel = profile.unit
    ? `${profile.unit.property.name} — Unit ${profile.unit.unitNumber}`
    : "Your unit";

  // ── No plan at all ──
  if (!active && !latestTerminal) {
    return (
      <div className="space-y-6 page-enter">
        <PageHeader title="Recovery plan" description={unitLabel} />
        <EmptyState
          icon={<LifeBuoy className="h-12 w-12" />}
          title="No recovery plan"
          description="Your property manager hasn't offered a repayment plan. If you're behind on rent and want to talk about one, reach out to them directly."
        />
      </div>
    );
  }

  // ── Active plan takes priority ──
  if (active) {
    const status = active.status as RecoveryPlanStatus;
    const hitPeriods = new Set(
      active.paymentLogs.filter((l) => l.status === "COUNTED").map((l) => l.periodKey)
    );
    return (
      <div className="space-y-6 page-enter">
        <PageHeader title="Your recovery plan" description={unitLabel} />

        {active.tenantMessage && (
          <Card className="border-border border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-start gap-3">
              <MessageSquare className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-primary mb-1">
                  Message from your property manager
                </p>
                <p className="text-sm whitespace-pre-wrap">
                  {active.tenantMessage}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-border">
          <CardContent className="p-5 space-y-4">
            <RecoveryProgressBar
              completed={active.completedPayments}
              required={active.requiredPayments}
              status={status}
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {(active.requiredPeriodKeys || []).map((pk) => {
                const hit = hitPeriods.has(pk);
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

        <Card className="border-border">
          <CardContent className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
                  Prior balance
                </div>
                <div className="tabular-nums">
                  {formatCurrency(Number(active.originalBalance))}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
                  We&apos;ll forgive
                </div>
                <div className="tabular-nums text-emerald-600 font-semibold">
                  {formatCurrency(Number(active.forgivenessAmount))}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
                  On-time payments needed
                </div>
                <div className="tabular-nums">{active.requiredPayments}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
                  Grace period
                </div>
                <div className="tabular-nums">
                  {active.graceDays} day{active.graceDays === 1 ? "" : "s"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {status === "PLAN_OFFERED" && (
          <Card className="border-border border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4 flex items-start gap-3">
              <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Plan offered — not yet active</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your property manager has put this plan on the table. Reach out
                  to them to accept and start the clock.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {status === "PLAN_AT_RISK" && (
          <Card className="border-border border-blue-500/30 bg-blue-500/5">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Your plan is at risk</p>
                <p className="text-xs text-muted-foreground mt-1">
                  A payment is past due but still within the grace window. Pay
                  now to stay on track for forgiveness.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="rounded-lg border bg-muted/20 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">How it works</p>
          <p>
            Make each required rent payment on time (or within the{" "}
            {active.graceDays}-day grace period). When all{" "}
            {active.requiredPayments} payments are made, {formatCurrency(
              Number(active.forgivenessAmount)
            )}{" "}
            will be credited to your account.
            {active.failurePolicy === "FAIL"
              ? " If any payment is missed past grace, the plan ends and the full prior balance remains due."
              : " If you miss a payment, progress resets to 0 but the plan stays active — you can try again."}
          </p>
        </div>

        <Card className="border-border bg-primary/5 border-primary/30">
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <CreditCard className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Need to make a payment?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pay this month&apos;s rent to keep your recovery plan on track.
                </p>
              </div>
            </div>
            <Link href="/tenant/pay" className="sm:flex-shrink-0">
              <Button size="lg" className="w-full sm:w-auto">
                <CreditCard className="mr-2 h-4 w-4" />
                Make a Payment
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Terminal plan (no active) ──
  const tp = latestTerminal!;
  const completed = tp.status === "PLAN_COMPLETED";
  return (
    <div className="space-y-6 page-enter">
      <PageHeader title="Recovery plan history" description={unitLabel} />

      <Card
        className={`border-border ${
          completed
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-red-500/30 bg-red-500/5"
        }`}
      >
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            {completed ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <RecoveryStatusBadge status={tp.status as RecoveryPlanStatus} size="md" />
          </div>
          {completed ? (
            <p className="text-sm">
              You completed all {tp.requiredPayments} on-time payments.{" "}
              {formatCurrency(Number(tp.forgivenessAmount))} was credited to your
              account. Nice work.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              This plan ended without completion. Your prior balance (
              {formatCurrency(Number(tp.originalBalance))}) remains due. Contact
              your property manager to discuss next steps.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

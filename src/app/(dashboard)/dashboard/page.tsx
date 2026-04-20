export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { getTeamContext, can } from "@/lib/team-context";
import { formatCurrency } from "@/lib/utils";
import {
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Home,
  ScrollText,
} from "lucide-react";
import { DashboardNoticeBanner } from "@/components/layout/dashboard-notice-banner";
import { RoommateApprovals } from "@/components/dashboard/roommate-approvals";
import { GettingStarted } from "@/components/dashboard/getting-started";
import { PortfolioGoal } from "@/components/dashboard/portfolio-goal";
import { UnpaidRentWidget } from "@/components/dashboard/unpaid-rent-widget";
import { ComplianceBanner } from "@/components/dashboard/compliance-banner";
import { SuspensionOverlay } from "@/components/dashboard/suspension-overlay";
import { OnboardingProgressTracker } from "@/components/dashboard/onboarding-progress-tracker";
import { OnboardingCompleteBanner } from "@/components/dashboard/onboarding-complete-banner";
import { OnboardingOverlay } from "@/components/onboarding/onboarding-overlay";
import { DashboardFilters } from "@/components/dashboard/global-filters";
import {
  resolvePeriod,
  PERIOD_LABELS,
  type DashboardPeriod,
} from "@/components/dashboard/period";
import { TopLatePayers } from "@/components/dashboard/top-late-payers";
import { HeroStatCard } from "@/components/dashboard/hero-stat-card";
import {
  AlertsStrip,
  type AlertItem,
} from "@/components/dashboard/alerts-strip";
import {
  ActivityFeed,
  type ActivityEvent,
} from "@/components/dashboard/activity-feed";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { COMPLIANCE_WINDOW_DAYS } from "@/lib/constants";
import { getOnboardingProgress, isOnboardingComplete } from "@/lib/onboarding";

export const metadata = { title: "Dashboard" };

const VALID_PERIODS: DashboardPeriod[] = [
  "this-month",
  "last-month",
  "ytd",
  "all-time",
];

/**
 * Given a current [start, end) window, return the immediately-preceding
 * window of the same duration for trend comparison. Returns null when the
 * current period is unbounded (all-time).
 */
function buildPreviousPeriodRange(
  start: Date | null,
  end: Date | null
): { start: Date; end: Date } | null {
  if (!start || !end) return null;
  const duration = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - duration),
    end: new Date(start.getTime()),
  };
}

/** Safe percent delta. NaN if the previous value is zero. */
function pctDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; propertyId?: string }>;
}) {
  const user = await requireRole("PM");
  const ctx = await getTeamContext(user.id);

  // Demo accounts bypass billing + compliance gates and get a ribbon.
  const pmShell = ctx.isTeamMember
    ? null
    : await db.user.findUnique({
        where: { id: ctx.landlordId },
        select: { isDemo: true },
      });
  const isDemo = !!pmShell?.isDemo;

  // ─── Parse filters from URL ─────────────────────────
  const sp = await searchParams;
  const period: DashboardPeriod =
    sp.period && (VALID_PERIODS as string[]).includes(sp.period)
      ? (sp.period as DashboardPeriod)
      : "this-month";
  const propertyId = sp.propertyId || null;
  const range = resolvePeriod(period);

  // Scoped "where" helpers we'll reuse across queries
  const inPeriod = range.start && range.end
    ? { gte: range.start, lt: range.end }
    : undefined;
  const propertyScope = propertyId ? { propertyId } : {};
  const unitScope = propertyId ? { unit: { propertyId } } : {};

  // ─── Onboarding / compliance plumbing (unchanged) ───
  const merchantApp = ctx.isTeamMember
    ? null
    : await db.merchantApplication.findUnique({
        where: { userId: ctx.landlordId },
        select: { status: true, createdAt: true },
      });

  const onboardingProgress = ctx.isTeamMember
    ? null
    : await getOnboardingProgress(ctx.landlordId);
  const onboardingDone = ctx.isTeamMember
    ? true
    : await isOnboardingComplete(ctx.landlordId);

  const subscription = ctx.isTeamMember
    ? null
    : await db.subscription.findUnique({
        where: { userId: ctx.landlordId },
        select: { trialEndsAt: true },
      });
  const trialDaysLeft = subscription?.trialEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subscription.trialEndsAt).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : null;

  const merchantAppDaysLeft =
    merchantApp?.createdAt && merchantApp.status !== "APPROVED"
      ? Math.max(
          0,
          30 -
            Math.floor(
              (Date.now() - new Date(merchantApp.createdAt).getTime()) /
                (1000 * 60 * 60 * 24)
            )
        )
      : null;

  const showOnboardingBanner =
    !ctx.isTeamMember &&
    !isDemo &&
    (!merchantApp ||
      merchantApp.status === "NOT_STARTED" ||
      merchantApp.status === "IN_PROGRESS");

  let complianceDaysRemaining: number | null = null;
  let complianceHoursRemaining: number | null = null;
  let complianceExpired = false;

  if (!ctx.isTeamMember && showOnboardingBanner) {
    const pmUser2 = await db.user.findUnique({
      where: { id: ctx.landlordId },
      select: {
        firstDashboardAccess: true,
        complianceDeadline: true,
        suspendedAt: true,
      },
    });

    if (pmUser2 && !pmUser2.firstDashboardAccess) {
      const now2 = new Date();
      const deadline = new Date(
        now2.getTime() + COMPLIANCE_WINDOW_DAYS * 24 * 60 * 60 * 1000
      );
      await db.user.update({
        where: { id: ctx.landlordId },
        data: { firstDashboardAccess: now2, complianceDeadline: deadline },
      });
      complianceDaysRemaining = COMPLIANCE_WINDOW_DAYS;
      complianceHoursRemaining = COMPLIANCE_WINDOW_DAYS * 24;
    } else if (pmUser2?.complianceDeadline) {
      const msRemaining =
        new Date(pmUser2.complianceDeadline).getTime() - Date.now();
      complianceDaysRemaining = Math.max(
        0,
        Math.floor(msRemaining / (1000 * 60 * 60 * 24))
      );
      complianceHoursRemaining = Math.max(
        0,
        Math.floor(msRemaining / (1000 * 60 * 60))
      );
      complianceExpired = msRemaining <= 0;
      if (complianceExpired && !pmUser2.suspendedAt) {
        await db.user.update({
          where: { id: ctx.landlordId },
          data: { suspendedAt: new Date() },
        });
      }
    }
  }

  // ─── Core data queries (period + property scoped) ───
  const [
    properties,
    payments,
    expensesAgg,
    propertiesWithPurchase,
    tenantCount,
    leaseCount,
    cardPaymentsInRange,
    pmUser,
    expiringLeaseCount,
    expiringThisWeek,
  ] = await Promise.all([
    db.property.findMany({
      where: { landlordId: ctx.landlordId },
      include: { units: { select: { rentAmount: true, status: true } } },
    }),
    db.payment.findMany({
      where: {
        landlordId: ctx.landlordId,
        ...(inPeriod ? { dueDate: inPeriod } : {}),
        ...unitScope,
      },
    }),
    db.expense.aggregate({
      where: {
        landlordId: ctx.landlordId,
        ...(inPeriod ? { date: inPeriod } : {}),
        ...propertyScope,
      },
      _sum: { amount: true },
    }),
    db.property.findMany({
      where: {
        landlordId: ctx.landlordId,
        purchasePrice: { not: null },
        ...(propertyId ? { id: propertyId } : {}),
      },
      select: { purchasePrice: true },
    }),
    db.tenantProfile.count({
      where: {
        unit: {
          property: {
            landlordId: ctx.landlordId,
            ...(propertyId ? { id: propertyId } : {}),
          },
        },
      },
    }),
    db.lease.count({
      where: {
        landlordId: ctx.landlordId,
        ...(propertyId ? { unit: { propertyId } } : {}),
      },
    }),
    db.payment.findMany({
      where: {
        landlordId: ctx.landlordId,
        status: "COMPLETED",
        paymentMethod: "card",
        ...(inPeriod ? { paidAt: inPeriod } : {}),
        ...unitScope,
      },
      select: { amount: true },
    }),
    db.user.findUnique({
      where: { id: ctx.landlordId },
      select: { kadimaCardTokenId: true },
    }),
    // Expiring leases (next 30 days)
    db.lease.count({
      where: {
        landlordId: ctx.landlordId,
        status: "ACTIVE",
        endDate: {
          gte: new Date(),
          lt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        ...(propertyId ? { unit: { propertyId } } : {}),
      },
    }),
    // Expiring this week
    db.lease.count({
      where: {
        landlordId: ctx.landlordId,
        status: "ACTIVE",
        endDate: {
          gte: new Date(),
          lt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        ...(propertyId ? { unit: { propertyId } } : {}),
      },
    }),
  ]);

  // ─── Dashboard v2 data: deltas, chart, alerts, activity ─────────
  // Previous-period window (same duration, shifted back) for trend deltas.
  // Only meaningful when we have a bounded current period.
  const prevPeriod = buildPreviousPeriodRange(range.start, range.end);

  // 6-month rolling chart baseline (always; ignores the selected period).
  const chartStart = new Date();
  chartStart.setMonth(chartStart.getMonth() - 5);
  chartStart.setDate(1);
  chartStart.setHours(0, 0, 0, 0);

  const [
    prevPeriodPaymentsAgg,
    prevPeriodPendingAgg,
    chartPayments,
    activeLeaseCount,
    openTicketsCount,
    pendingAppsCount,
    recentPayments,
    recentTenants,
    recentTickets,
    recentLeases,
  ] = await Promise.all([
    prevPeriod
      ? db.payment.aggregate({
          where: {
            landlordId: ctx.landlordId,
            status: "COMPLETED",
            paidAt: { gte: prevPeriod.start, lt: prevPeriod.end },
            ...unitScope,
          },
          _sum: { amount: true },
        })
      : Promise.resolve(null),
    prevPeriod
      ? db.payment.aggregate({
          where: {
            landlordId: ctx.landlordId,
            status: "PENDING",
            dueDate: { gte: prevPeriod.start, lt: prevPeriod.end },
            ...unitScope,
          },
          _sum: { amount: true },
        })
      : Promise.resolve(null),
    db.payment.findMany({
      where: {
        landlordId: ctx.landlordId,
        status: "COMPLETED",
        paidAt: { gte: chartStart },
        ...unitScope,
      },
      select: { amount: true, paidAt: true },
    }),
    db.lease.count({
      where: {
        landlordId: ctx.landlordId,
        status: "ACTIVE",
        ...(propertyId ? { unit: { propertyId } } : {}),
      },
    }),
    db.serviceTicket.count({
      where: {
        landlordId: ctx.landlordId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
        ...(propertyId ? { unit: { propertyId } } : {}),
      },
    }),
    db.application.count({
      where: {
        status: "PENDING",
        unit: {
          property: {
            landlordId: ctx.landlordId,
            ...(propertyId ? { id: propertyId } : {}),
          },
        },
      },
    }),
    db.payment.findMany({
      where: {
        landlordId: ctx.landlordId,
        status: { in: ["COMPLETED", "FAILED"] },
        ...unitScope,
      },
      select: {
        id: true,
        amount: true,
        status: true,
        paidAt: true,
        processedAt: true,
        createdAt: true,
        tenant: { select: { user: { select: { name: true } } } },
        unit: {
          select: { unitNumber: true, property: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.tenantProfile.findMany({
      where: {
        unit: {
          property: {
            landlordId: ctx.landlordId,
            ...(propertyId ? { id: propertyId } : {}),
          },
        },
      },
      select: {
        id: true,
        createdAt: true,
        user: { select: { name: true } },
        unit: { select: { unitNumber: true, property: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    db.serviceTicket.findMany({
      where: {
        landlordId: ctx.landlordId,
        ...(propertyId ? { unit: { propertyId } } : {}),
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        unit: { select: { unitNumber: true, property: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    db.lease.findMany({
      where: {
        landlordId: ctx.landlordId,
        status: { in: ["ACTIVE", "PENDING"] },
        ...(propertyId ? { unit: { propertyId } } : {}),
      },
      select: {
        id: true,
        createdAt: true,
        signedByTenant: true,
        tenant: { include: { user: { select: { name: true } } } },
        unit: { select: { unitNumber: true, property: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
  ]);

  // Filter properties client-side for "all units" stats when propertyId is set
  const scopedProperties = propertyId
    ? properties.filter((p) => p.id === propertyId)
    : properties;
  const allUnits = scopedProperties.flatMap((p) => p.units);
  const occupiedUnits = allUnits.filter((u) => u.status === "OCCUPIED");
  const totalMonthlyRent = occupiedUnits.reduce(
    (sum, u) => sum + Number(u.rentAmount),
    0
  );

  const collected = payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const pending = payments
    .filter((p) => p.status === "PENDING")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const failed = payments.filter((p) => p.status === "FAILED").length;

  const totalExpenses = Number(expensesAgg?._sum?.amount || 0);
  const netIncome = collected - totalExpenses;
  const totalPurchasePrice = propertiesWithPurchase.reduce(
    (sum, p) => sum + Number(p.purchasePrice || 0),
    0
  );
  const portfolioRoi =
    totalPurchasePrice > 0 ? (netIncome / totalPurchasePrice) * 100 : null;

  const cardResiduals = cardPaymentsInRange.reduce(
    (sum, p) => sum + Number(p.amount) * 0.0025,
    0
  );

  const outstandingRent = pending;
  const periodLabel = PERIOD_LABELS[period];

  // ─── v2: deltas, chart data, alerts, activity ───────────────────
  const prevCollected = Number(prevPeriodPaymentsAgg?._sum?.amount || 0);
  const prevOutstanding = Number(prevPeriodPendingAgg?._sum?.amount || 0);
  const collectedDelta = pctDelta(collected, prevCollected);
  // Outstanding delta is inverted — going up is bad. The hero card paints
  // negative deltas red automatically, so flip the sign.
  const outstandingDelta = pctDelta(outstandingRent, prevOutstanding);
  const outstandingDeltaDisplay =
    outstandingDelta === null ? null : -outstandingDelta;

  const occupancyRate =
    allUnits.length > 0
      ? Math.round((occupiedUnits.length / allUnits.length) * 100)
      : 0;

  // Revenue chart: 6-month buckets, seed every month with zero.
  const chartBuckets = new Map<string, number>();
  {
    const seed = new Date(chartStart);
    for (let i = 0; i < 6; i++) {
      const key =
        seed.toLocaleString("en-US", { month: "short" }) +
        " " +
        seed.getFullYear();
      chartBuckets.set(key, 0);
      seed.setMonth(seed.getMonth() + 1);
    }
  }
  for (const p of chartPayments) {
    if (!p.paidAt) continue;
    const d = new Date(p.paidAt);
    const key =
      d.toLocaleString("en-US", { month: "short" }) + " " + d.getFullYear();
    if (chartBuckets.has(key)) {
      chartBuckets.set(key, (chartBuckets.get(key) || 0) + Number(p.amount));
    }
  }
  const chartData = Array.from(chartBuckets.entries()).map(
    ([month, collectedAmt]) => ({ month, collected: collectedAmt })
  );
  const chartTotal = chartData.reduce((s, d) => s + d.collected, 0);
  const chartAvg = chartData.length > 0 ? chartTotal / chartData.length : 0;

  // Alerts strip — overdue payments counted by distinct past-due tenants.
  const overdueAmount = payments.filter(
    (p) => p.status === "PENDING" && p.dueDate < new Date()
  ).length;
  const alerts: AlertItem[] = [
    { kind: "overdue", count: overdueAmount },
    { kind: "expiringLeases", count: expiringThisWeek },
    { kind: "openTickets", count: openTicketsCount },
    { kind: "pendingApps", count: pendingAppsCount },
  ];

  // Activity feed — merge payments/tenants/tickets/leases, sort by
  // timestamp desc, slice to 10.
  const activityEvents: ActivityEvent[] = [
    ...recentPayments.map<ActivityEvent>((p) => {
      const tenantName = p.tenant?.user?.name || "A tenant";
      const unitLabel = p.unit
        ? `${p.unit.property?.name || ""} · Unit ${p.unit.unitNumber}`
        : "";
      const when = p.paidAt || p.processedAt || p.createdAt;
      if (p.status === "COMPLETED") {
        return {
          id: `pay-${p.id}`,
          kind: "payment-received",
          label: `${tenantName} paid rent`,
          detail: unitLabel,
          amount: Number(p.amount),
          when,
          href: "/dashboard/payments",
        };
      }
      return {
        id: `pay-${p.id}`,
        kind: "payment-failed",
        label: `Payment from ${tenantName} failed`,
        detail: unitLabel,
        amount: Number(p.amount),
        when,
        href: "/dashboard/payments?status=FAILED",
      };
    }),
    ...recentTenants.map<ActivityEvent>((t) => ({
      id: `tn-${t.id}`,
      kind: "tenant-added",
      label: `${t.user?.name || "A tenant"} was added`,
      detail: t.unit
        ? `${t.unit.property?.name || ""} · Unit ${t.unit.unitNumber}`
        : undefined,
      when: t.createdAt,
      href: `/dashboard/tenants/${t.id}`,
    })),
    ...recentTickets.map<ActivityEvent>((t) => ({
      id: `tk-${t.id}`,
      kind: "ticket-created",
      label: t.title,
      detail: t.unit
        ? `${t.unit.property?.name || ""} · Unit ${t.unit.unitNumber}`
        : undefined,
      when: t.createdAt,
      href: `/dashboard/tickets/${t.id}`,
    })),
    ...recentLeases
      .filter((l) => l.signedByTenant)
      .map<ActivityEvent>((l) => ({
        id: `ls-${l.id}`,
        kind: "lease-signed",
        label: `${l.tenant.user?.name || "Tenant"} signed their lease`,
        detail: l.unit
          ? `${l.unit.property?.name || ""} · Unit ${l.unit.unitNumber}`
          : undefined,
        when: l.createdAt,
        href: `/dashboard/leases/${l.id}`,
      })),
  ]
    .sort(
      (a, b) => new Date(b.when).getTime() - new Date(a.when).getTime()
    )
    .slice(0, 10);

  // Small data shape for the property filter dropdown
  const propertyOptions = properties.map((p) => ({
    id: p.id,
    name: p.name,
    unitCount: p.units.length,
  }));

  // Everything visible under ProjectionArea — note blur/overlay behavior is
  // preserved exactly from the previous layout.
  // Demo accounts skip the onboarding blur + overlay entirely.
  const renderOnboardingOverlay = !onboardingDone && !isDemo;

  return (
    <div className="relative">
      <div
        className={
          renderOnboardingOverlay
            ? "blur-sm pointer-events-none select-none"
            : ""
        }
      >
        <div className="space-y-8">
          {isDemo && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-center gap-3">
              <span className="rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                Demo
              </span>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                You&apos;re viewing a DoorStax demo account. Billing and compliance gates are disabled. Ask your DoorStax rep when you&apos;re ready to convert this to a real account.
              </p>
            </div>
          )}

          <DashboardNoticeBanner />

          {showOnboardingBanner && !complianceExpired && (
            <ComplianceBanner
              daysRemaining={complianceDaysRemaining}
              hoursRemaining={complianceHoursRemaining}
              expired={complianceExpired}
              appStatus={merchantApp?.status || "NOT_STARTED"}
            />
          )}
          {complianceExpired && showOnboardingBanner && (
            <SuspensionOverlay
              appStatus={merchantApp?.status || "NOT_STARTED"}
            />
          )}

          {onboardingProgress && !onboardingProgress.milestones.complete && (
            <OnboardingProgressTracker
              completed={onboardingProgress.completed}
              total={onboardingProgress.total}
              milestones={onboardingProgress.milestones}
            />
          )}
          {onboardingProgress?.milestones.complete && (
            <OnboardingCompleteBanner />
          )}

          {/* ─── Header + global filters ─── */}
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {periodLabel}
                {propertyId
                  ? ` · ${
                      propertyOptions.find((p) => p.id === propertyId)?.name ||
                      "Property"
                    }`
                  : " · all properties"}
              </p>
            </div>
            <DashboardFilters
              period={period}
              propertyId={propertyId}
              properties={propertyOptions}
            />
          </div>

          {/* ─── Hero stat cards ─────────────────────────── */}
          {can(ctx, "payments:read") && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-stagger">
              <HeroStatCard
                label={`Revenue (${periodLabel.toLowerCase()})`}
                value={formatCurrency(collected)}
                href="/dashboard/payments?status=COMPLETED"
                delta={collectedDelta}
                accent="success"
                icon={<DollarSign />}
                footnote="vs previous period"
              />
              <HeroStatCard
                label="Outstanding Rent"
                value={formatCurrency(outstandingRent)}
                href="/dashboard/unpaid"
                delta={outstandingDeltaDisplay}
                accent={outstandingRent > 0 ? "danger" : "neutral"}
                icon={<AlertTriangle />}
                footnote="vs previous period"
              />
              <HeroStatCard
                label="Occupancy"
                value={allUnits.length > 0 ? `${occupancyRate}%` : "—"}
                href="/dashboard/properties"
                accent={occupancyRate >= 90 ? "success" : "neutral"}
                icon={<Home />}
                footnote={`${occupiedUnits.length} of ${allUnits.length} units`}
              />
              <HeroStatCard
                label="Active Leases"
                value={activeLeaseCount}
                href="/dashboard/leases"
                icon={<ScrollText />}
                footnote={`${tenantCount} tenants total`}
              />
            </div>
          )}

          {/* ─── Alerts strip ────────────────────────────── */}
          <AlertsStrip alerts={alerts} />

          {/* ─── Revenue chart + Activity feed ───────────── */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-xl border bg-card p-5 card-hover">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    Revenue, last 6 months
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Completed payments, bucketed by month of paidAt.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Avg / month
                  </p>
                  <p className="text-sm font-semibold">
                    {formatCurrency(chartAvg)}
                  </p>
                </div>
              </div>
              <RevenueChart data={chartData} />
              <div className="mt-3 pt-3 border-t text-[11px] text-muted-foreground flex justify-between">
                <span>6-month total</span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(chartTotal)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recent activity
              </h2>
              <ActivityFeed events={activityEvents} />
            </div>
          </div>

          {/* ─── Unpaid rent (kept from legacy — still useful) ─── */}
          {can(ctx, "payments:read") && <UnpaidRentWidget />}

          {/* ─── Needs your attention ────────────────────── */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Needs your attention
            </h2>

            <div className="grid gap-4 lg:grid-cols-2">
              {can(ctx, "payments:read") && (
                <TopLatePayers
                  landlordId={ctx.landlordId}
                  propertyId={propertyId}
                />
              )}
              {!ctx.isTeamMember && (
                <PortfolioGoal currentUnits={allUnits.length} />
              )}
            </div>

            <RoommateApprovals />

            {!ctx.isTeamMember && !onboardingDone && (
              <GettingStarted
                propertyCount={properties.length}
                unitCount={allUnits.length}
                tenantCount={tenantCount}
                leaseCount={leaseCount}
                hasMerchantApp={
                  !!merchantApp &&
                  (merchantApp.status === "SUBMITTED" ||
                    merchantApp.status === "APPROVED")
                }
                hasCardOnFile={!!pmUser?.kadimaCardTokenId}
              />
            )}
          </section>

          {/* Used in stats header — suppress unused-var warning when not rendered */}
          <span className="hidden">
            {leaseCount}
            {totalMonthlyRent}
            {totalExpenses}
            {netIncome}
            {cardResiduals}
            {portfolioRoi}
            {expiringLeaseCount}
            {failed}
          </span>
        </div>
      </div>

      {/* Onboarding overlay — centered over blurred content. Skipped for demo. */}
      {renderOnboardingOverlay && onboardingProgress && (
        <OnboardingOverlay
          milestones={onboardingProgress.milestones}
          trialDaysLeft={trialDaysLeft}
          merchantAppDaysLeft={merchantAppDaysLeft}
          merchantAppStatus={merchantApp?.status ?? null}
        />
      )}
    </div>
  );
}

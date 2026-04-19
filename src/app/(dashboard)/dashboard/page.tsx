export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { getTeamContext, can } from "@/lib/team-context";
import { MetricCard } from "@/components/ui/metric-card";
import { formatCurrency } from "@/lib/utils";
import {
  Building2,
  DollarSign,
  Clock,
  AlertTriangle,
  Receipt,
  TrendingUp,
  Percent,
} from "lucide-react";
import { DashboardNoticeBanner } from "@/components/layout/dashboard-notice-banner";
import { RoommateApprovals } from "@/components/dashboard/roommate-approvals";
import { ExpiringLeases } from "@/components/dashboard/expiring-leases";
import { GettingStarted } from "@/components/dashboard/getting-started";
import { PortfolioGoal } from "@/components/dashboard/portfolio-goal";
import { PortfolioStatistics } from "@/components/dashboard/portfolio-statistics";
import { MonthlyVolumeDetail } from "@/components/dashboard/monthly-volume-detail";
import { PortfolioChangesChart } from "@/components/dashboard/portfolio-changes-chart";
import { PaymentRevenue } from "@/components/dashboard/payment-revenue";
import { UnpaidRentWidget } from "@/components/dashboard/unpaid-rent-widget";
import { ComplianceBanner } from "@/components/dashboard/compliance-banner";
import { SuspensionOverlay } from "@/components/dashboard/suspension-overlay";
import { OnboardingProgressTracker } from "@/components/dashboard/onboarding-progress-tracker";
import { OnboardingCompleteBanner } from "@/components/dashboard/onboarding-complete-banner";
import { OnboardingOverlay } from "@/components/onboarding/onboarding-overlay";
import {
  DashboardFilters,
  resolvePeriod,
  PERIOD_LABELS,
  type DashboardPeriod,
} from "@/components/dashboard/global-filters";
import { TopLatePayers } from "@/components/dashboard/top-late-payers";
import { SafeServerBoundary } from "@/components/dashboard/safe-server-boundary";
import { COMPLIANCE_WINDOW_DAYS } from "@/lib/constants";
import { getOnboardingProgress, isOnboardingComplete } from "@/lib/onboarding";

export const metadata = { title: "Dashboard" };

const VALID_PERIODS: DashboardPeriod[] = [
  "this-month",
  "last-month",
  "ytd",
  "all-time",
];

// Top-level wrapper: catches ANY throw from the dashboard server render
// (including paths we haven't individually wrapped) and renders the real
// error inline. Without this, Next.js scrubs server-component render errors
// in production and all we see is "Error" with a digest.
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; propertyId?: string }>;
}) {
  try {
    return await DashboardPageInner({ searchParams });
  } catch (e) {
    const err = e as Error;
    console.error("[dashboard] top-level server render failed:", err);
    return (
      <div className="mx-auto max-w-3xl mt-10 rounded-xl border border-red-500/30 bg-red-500/5 p-6 space-y-3">
        <h2 className="text-base font-semibold text-red-600">
          Dashboard server render failed (top-level)
        </h2>
        <p className="text-xs text-muted-foreground">
          This message bypasses Next.js&apos;s production scrubbing. Copy +
          paste back so we can fix it.
        </p>
        <dl className="space-y-2 text-xs">
          <div>
            <dt className="uppercase tracking-wider text-muted-foreground">Name</dt>
            <dd className="font-mono">{err?.name}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wider text-muted-foreground">Message</dt>
            <dd className="font-mono whitespace-pre-wrap break-words">{err?.message}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wider text-muted-foreground">Stack</dt>
            <dd>
              <pre className="whitespace-pre-wrap break-words font-mono text-[10px] max-h-96 overflow-auto leading-relaxed">
                {err?.stack}
              </pre>
            </dd>
          </div>
        </dl>
      </div>
    );
  }
}

async function DashboardPageInner({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; propertyId?: string }>;
}) {
  const user = await requireRole("PM");
  const ctx = await getTeamContext(user.id);

  // Demo accounts bypass billing + compliance gates and get a ribbon.
  // NOTE: guarded try/catch while we hunt a sandbox-specific crash. If
  // isDemo lookup fails (e.g. prisma client / schema mismatch) we render
  // a diagnostic card server-side rather than letting Next scrub the error.
  let isDemo = false;
  try {
    const pmShell = ctx.isTeamMember
      ? null
      : await db.user.findUnique({
          where: { id: ctx.landlordId },
          select: { isDemo: true },
        });
    isDemo = !!pmShell?.isDemo;
  } catch (e) {
    const err = e as Error;
    console.error("[dashboard] isDemo lookup failed:", err);
    return (
      <div className="mx-auto max-w-3xl mt-10 rounded-xl border border-red-500/30 bg-red-500/5 p-6 space-y-3">
        <h2 className="text-base font-semibold text-red-600">Dashboard prelude failed (isDemo lookup)</h2>
        <p className="text-xs font-mono whitespace-pre-wrap break-words">
          {err?.name}: {err?.message}
        </p>
        <pre className="whitespace-pre-wrap break-words font-mono text-[10px] max-h-96 overflow-auto leading-relaxed">
          {err?.stack}
        </pre>
      </div>
    );
  }

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
  //
  // Instrumented: on failure we return a diagnostic render (not a throw)
  // so the error message survives to the browser — Next.js scrubs thrown
  // server-component errors in production. This is TEMPORARY: it lets us
  // see the real stack on the sandbox crash. Once fixed, remove the
  // try/catch wrapper. Digest to correlate: check Vercel logs for the
  // error's digest. https://nextjs.org/docs/app/building-your-application/routing/error-handling
  let coreQueryError: { name: string; message: string; stack: string } | null = null;
  // We use `any` for the tuple return because Prisma's include/select
  // shapes can't be easily derived without replicating each query's type.
  // This is only a temporary diagnostic wrapper — callers below still get
  // their fields safely destructured from the real Promise.all result.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let coreResults: any = null;
  try {
    coreResults = await Promise.all([
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
  } catch (e) {
    const err = e as Error;
    coreQueryError = {
      name: err?.name || "Error",
      message: err?.message || String(e),
      stack: err?.stack || "",
    };
    // Also log for Vercel function logs.
    console.error("[dashboard] core query failed:", err);
  }

  // Early-return a diagnostic render if the core queries failed. This
  // renders server-side but doesn't throw, so Next.js won't scrub the
  // message.
  if (coreQueryError || !coreResults) {
    return (
      <div className="mx-auto max-w-3xl mt-10 rounded-xl border border-red-500/30 bg-red-500/5 p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-red-600">
            Dashboard data query failed
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            The real error (bypassing Next&apos;s production scrubbing) is
            below. Copy + paste this back so we can fix it.
          </p>
        </div>
        <dl className="space-y-2 text-xs">
          <div>
            <dt className="uppercase tracking-wider text-muted-foreground">
              Name
            </dt>
            <dd className="font-mono">{coreQueryError?.name}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wider text-muted-foreground">
              Message
            </dt>
            <dd className="font-mono whitespace-pre-wrap break-words">
              {coreQueryError?.message}
            </dd>
          </div>
          <div>
            <dt className="uppercase tracking-wider text-muted-foreground">
              Stack
            </dt>
            <dd>
              <pre className="whitespace-pre-wrap break-words font-mono text-[10px] max-h-96 overflow-auto leading-relaxed">
                {coreQueryError?.stack}
              </pre>
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
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
  ] = coreResults as [
    Array<{ id: string; name: string; units: Array<{ rentAmount: unknown; status: string }> }>,
    Array<{ status: string; amount: unknown }>,
    { _sum: { amount: unknown | null } | null },
    Array<{ purchasePrice: unknown | null }>,
    number,
    number,
    Array<{ amount: unknown }>,
    { kadimaCardTokenId: string | null } | null,
    number,
    number,
  ];
  /* eslint-enable @typescript-eslint/no-explicit-any */

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

          {/* ────────────────────────────────── */}
          {/* Tier 1 — "Today" at-a-glance      */}
          {/* ────────────────────────────────── */}
          {can(ctx, "payments:read") && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Today
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-stagger">
                <MetricCard
                  label={`Collected (${periodLabel.toLowerCase()})`}
                  value={formatCurrency(collected)}
                  icon={<DollarSign className="h-4 w-4 text-emerald-500" />}
                  href="/dashboard/payments?status=COMPLETED"
                />
                <MetricCard
                  label="Outstanding Rent"
                  value={formatCurrency(outstandingRent)}
                  icon={
                    <AlertTriangle
                      className={
                        outstandingRent > 0
                          ? "h-4 w-4 text-red-500"
                          : "h-4 w-4 text-muted-foreground"
                      }
                    />
                  }
                  href="/dashboard/unpaid"
                />
                <MetricCard
                  label="Expiring This Week"
                  value={expiringThisWeek}
                  icon={<Clock className="h-4 w-4" />}
                  href="/dashboard/leases?expiring=week"
                />
                <MetricCard
                  label="Failed Payments"
                  value={failed}
                  icon={<AlertTriangle className="h-4 w-4" />}
                  href="/dashboard/payments?status=FAILED"
                />
              </div>
            </section>
          )}

          {/* ────────────────────────────────── */}
          {/* Tier 2 — This period              */}
          {/* ────────────────────────────────── */}
          {can(ctx, "payments:read") && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                This period
              </h2>
              <div className="grid gap-4 lg:grid-cols-2 animate-stagger">
                <MonthlyVolumeDetail scope="pm" />
                <PaymentRevenue />
              </div>
              <UnpaidRentWidget />
            </section>
          )}

          {/* ────────────────────────────────── */}
          {/* Tier 3 — Portfolio                */}
          {/* ────────────────────────────────── */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Portfolio
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-stagger">
              <MetricCard
                label="Properties"
                value={scopedProperties.length}
                icon={<Building2 className="h-4 w-4" />}
                href="/dashboard/properties"
              />
              <MetricCard
                label="Units"
                value={allUnits.length}
                icon={<Building2 className="h-4 w-4" />}
                href="/dashboard/properties"
              />
              <MetricCard
                label="Occupancy"
                value={
                  allUnits.length > 0
                    ? `${Math.round(
                        (occupiedUnits.length / allUnits.length) * 100
                      )}%`
                    : "—"
                }
                icon={<Building2 className="h-4 w-4" />}
                href="/dashboard/properties"
              />
            </div>

            {can(ctx, "expenses:read") && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-stagger">
                <MetricCard
                  label="Total Monthly Rent"
                  value={formatCurrency(totalMonthlyRent)}
                  icon={<DollarSign className="h-4 w-4" />}
                  href="/dashboard/properties"
                />
                <MetricCard
                  label={`Expenses (${periodLabel.toLowerCase()})`}
                  value={formatCurrency(totalExpenses)}
                  icon={<Receipt className="h-4 w-4" />}
                  href="/dashboard/expenses"
                />
                <MetricCard
                  label={`Net Income (${periodLabel.toLowerCase()})`}
                  value={formatCurrency(netIncome)}
                  icon={<TrendingUp className="h-4 w-4" />}
                  href="/dashboard/reports"
                />
                <MetricCard
                  label={`Card Earnings (${periodLabel.toLowerCase()})`}
                  value={formatCurrency(cardResiduals)}
                  icon={<Percent className="h-4 w-4" />}
                  href="/dashboard/residuals"
                />
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <PortfolioStatistics scope="pm" />
              {!ctx.isTeamMember && (
                <PortfolioGoal currentUnits={allUnits.length} />
              )}
            </div>

            <PortfolioChangesChart scope="pm" />

            {portfolioRoi !== null && (
              <div className="grid gap-4 sm:grid-cols-2">
                <MetricCard
                  label="Portfolio ROI"
                  value={`${portfolioRoi.toFixed(1)}%`}
                  icon={<Percent className="h-4 w-4" />}
                  href="/dashboard/reports"
                />
                <MetricCard
                  label="Tenants"
                  value={tenantCount}
                  icon={<Building2 className="h-4 w-4" />}
                  href="/dashboard/tenants"
                />
              </div>
            )}
          </section>

          {/* ────────────────────────────────── */}
          {/* Tier 4 — Actions & attention      */}
          {/* ────────────────────────────────── */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Needs your attention
            </h2>

            <div className="grid gap-4 lg:grid-cols-2">
              {can(ctx, "payments:read") && (
                <SafeServerBoundary
                  label="TopLatePayers"
                  render={async () => (
                    <TopLatePayers
                      landlordId={ctx.landlordId}
                      propertyId={propertyId}
                    />
                  )}
                />
              )}
              <ExpiringLeases />
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
          <span className="hidden">{leaseCount}</span>
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

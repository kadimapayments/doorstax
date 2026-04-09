import Link from "next/link";
import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { getTeamContext, can } from "@/lib/team-context";
import { MetricCard } from "@/components/ui/metric-card";
import { formatCurrency } from "@/lib/utils";
import { Building2, DollarSign, Clock, AlertTriangle, ArrowRight, Receipt, TrendingUp, Percent } from "lucide-react";
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
import { COMPLIANCE_WINDOW_DAYS } from "@/lib/constants";
import { getOnboardingProgress } from "@/lib/onboarding";
import { isOnboardingComplete } from "@/lib/onboarding";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireRole("PM");
  const ctx = await getTeamContext(user.id);

  const merchantApp = ctx.isTeamMember ? null : await db.merchantApplication.findUnique({
    where: { userId: ctx.landlordId },
    select: { status: true, createdAt: true },
  });

  // Guided Launch Mode: fetch onboarding progress
  const onboardingProgress = ctx.isTeamMember
    ? null
    : await getOnboardingProgress(ctx.landlordId);

  const onboardingDone = ctx.isTeamMember
    ? true
    : await isOnboardingComplete(ctx.landlordId);

  // Subscription trial info for overlay
  const subscription = ctx.isTeamMember
    ? null
    : await db.subscription.findUnique({
        where: { userId: ctx.landlordId },
        select: { trialEndsAt: true },
      });
  const trialDaysLeft =
    subscription?.trialEndsAt
      ? Math.max(
          0,
          Math.ceil(
            (new Date(subscription.trialEndsAt).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : null;

  const showOnboardingBanner =
    !ctx.isTeamMember && (!merchantApp || merchantApp.status === "NOT_STARTED" || merchantApp.status === "IN_PROGRESS");

  // ─── 7-Day Compliance Timer (server-backed) ─────────────────
  // Set firstDashboardAccess + complianceDeadline on first visit
  let complianceDaysRemaining: number | null = null;
  let complianceHoursRemaining: number | null = null;
  let complianceExpired = false;

  if (!ctx.isTeamMember && showOnboardingBanner) {
    const pmUser2 = await db.user.findUnique({
      where: { id: ctx.landlordId },
      select: { firstDashboardAccess: true, complianceDeadline: true, suspendedAt: true },
    });

    if (pmUser2 && !pmUser2.firstDashboardAccess) {
      // First dashboard visit — stamp the timer
      const now2 = new Date();
      const deadline = new Date(now2.getTime() + COMPLIANCE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      await db.user.update({
        where: { id: ctx.landlordId },
        data: { firstDashboardAccess: now2, complianceDeadline: deadline },
      });
      complianceDaysRemaining = COMPLIANCE_WINDOW_DAYS;
      complianceHoursRemaining = COMPLIANCE_WINDOW_DAYS * 24;
    } else if (pmUser2?.complianceDeadline) {
      const msRemaining = new Date(pmUser2.complianceDeadline).getTime() - Date.now();
      complianceDaysRemaining = Math.max(0, Math.floor(msRemaining / (1000 * 60 * 60 * 24)));
      complianceHoursRemaining = Math.max(0, Math.floor(msRemaining / (1000 * 60 * 60)));
      complianceExpired = msRemaining <= 0;

      // Suspend if expired and not already suspended
      if (complianceExpired && !pmUser2.suspendedAt) {
        await db.user.update({
          where: { id: ctx.landlordId },
          data: { suspendedAt: new Date() },
        });
      }
    }
  }

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [properties, payments, expensesAgg, propertiesWithPurchase, tenantCount, leaseCount, cardPaymentsThisMonth, pmUser] = await Promise.all([
    db.property.findMany({
      where: { landlordId: ctx.landlordId },
      include: {
        units: { select: { rentAmount: true, status: true } },
      },
    }),
    db.payment.findMany({
      where: {
        landlordId: ctx.landlordId,
        dueDate: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
        },
      },
    }),
    db.expense.aggregate({
      where: { landlordId: ctx.landlordId },
      _sum: { amount: true },
    }),
    db.property.findMany({
      where: { landlordId: ctx.landlordId, purchasePrice: { not: null } },
      select: { purchasePrice: true },
    }),
    db.tenantProfile.count({
      where: { unit: { property: { landlordId: ctx.landlordId } } },
    }),
    db.lease.count({
      where: { landlordId: ctx.landlordId },
    }),
    db.payment.findMany({
      where: {
        landlordId: ctx.landlordId,
        status: "COMPLETED",
        paymentMethod: "card",
        paidAt: { gte: firstOfMonth, lt: firstOfNextMonth },
      },
      select: { amount: true },
    }),
    db.user.findUnique({
      where: { id: ctx.landlordId },
      select: { kadimaCardTokenId: true },
    }),
  ]);

  const allUnits = properties.flatMap((p) => p.units);
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

  const totalExpenses = Number(expensesAgg._sum.amount || 0);
  const netIncome = collected - totalExpenses;
  const totalPurchasePrice = propertiesWithPurchase.reduce(
    (sum, p) => sum + Number(p.purchasePrice || 0),
    0
  );
  const portfolioRoi =
    totalPurchasePrice > 0 ? (netIncome / totalPurchasePrice) * 100 : null;

  const monthlyResiduals = cardPaymentsThisMonth.reduce(
    (sum, p) => sum + Number(p.amount) * 0.0025,
    0
  );

  return (
    <div className="relative">
      {/* Dashboard content — blurred when onboarding is incomplete */}
      <div
        className={
          !onboardingDone
            ? "blur-sm pointer-events-none select-none"
            : ""
        }
      >
    <div className="space-y-8">
      <DashboardNoticeBanner />
      <RoommateApprovals />
      <ExpiringLeases />

      {can(ctx, "payments:read") && <UnpaidRentWidget />}

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

      {!ctx.isTeamMember && (
        <GettingStarted
          propertyCount={properties.length}
          unitCount={allUnits.length}
          tenantCount={tenantCount}
          leaseCount={leaseCount}
          hasMerchantApp={!!merchantApp && (merchantApp.status === "SUBMITTED" || merchantApp.status === "APPROVED")}
          hasCardOnFile={!!pmUser?.kadimaCardTokenId}
        />
      )}

      {!ctx.isTeamMember && (
        <PortfolioGoal currentUnits={allUnits.length} />
      )}

      {complianceExpired && showOnboardingBanner && (
        <SuspensionOverlay appStatus={merchantApp?.status || "NOT_STARTED"} />
      )}

      {showOnboardingBanner && !complianceExpired && (
        <ComplianceBanner
          daysRemaining={complianceDaysRemaining}
          hoursRemaining={complianceHoursRemaining}
          expired={complianceExpired}
          appStatus={merchantApp?.status || "NOT_STARTED"}
        />
      )}

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s your portfolio summary.
        </p>
      </div>

      {can(ctx, "payments:read") && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-stagger">
          <MetricCard
            label="Total Monthly Rent"
            value={formatCurrency(totalMonthlyRent)}
            icon={<DollarSign className="h-4 w-4" />}
            href="/dashboard/properties"
          />
          <MetricCard
            label="Collected This Month"
            value={formatCurrency(collected)}
            icon={<DollarSign className="h-4 w-4" />}
            href="/dashboard/payments?status=COMPLETED"
          />
          <MetricCard
            label="Pending"
            value={formatCurrency(pending)}
            icon={<Clock className="h-4 w-4" />}
            href="/dashboard/payments?status=PENDING"
          />
          <MetricCard
            label="Failed Payments"
            value={failed}
            icon={<AlertTriangle className="h-4 w-4" />}
            href="/dashboard/payments?status=FAILED"
          />
        </div>
      )}

      {can(ctx, "properties:read") && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-stagger">
          <MetricCard
            label="Properties"
            value={properties.length}
            icon={<Building2 className="h-4 w-4" />}
            href="/dashboard/properties"
          />
          <MetricCard
            label="Total Units"
            value={allUnits.length}
            icon={<Building2 className="h-4 w-4" />}
            href="/dashboard/properties"
          />
          <MetricCard
            label="Occupancy"
            value={
              allUnits.length > 0
                ? `${Math.round((occupiedUnits.length / allUnits.length) * 100)}%`
                : "—"
            }
            icon={<Building2 className="h-4 w-4" />}
            href="/dashboard/properties"
          />
        </div>
      )}

      {can(ctx, "expenses:read") && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-stagger">
          <MetricCard
            label="Total Expenses"
            value={formatCurrency(totalExpenses)}
            icon={<Receipt className="h-4 w-4" />}
            href="/dashboard/expenses"
          />
          <MetricCard
            label="Net Income"
            value={formatCurrency(netIncome)}
            icon={<TrendingUp className="h-4 w-4" />}
            href="/dashboard/reports"
          />
          <MetricCard
            label="Payment Earnings (This Month)"
            value={formatCurrency(monthlyResiduals)}
            icon={<Percent className="h-4 w-4" />}
            href="/dashboard/residuals"
          />
          {portfolioRoi !== null && (
            <MetricCard
              label="Portfolio ROI"
              value={`${portfolioRoi.toFixed(1)}%`}
              icon={<Percent className="h-4 w-4" />}
              href="/dashboard/reports"
            />
          )}
        </div>
      )}

      {can(ctx, "payments:read") && (
        <PaymentRevenue />
      )}

      <PortfolioStatistics scope="pm" />

      {can(ctx, "payments:read") && (
        <MonthlyVolumeDetail scope="pm" />
      )}

      <PortfolioChangesChart scope="pm" />
    </div>
      </div>

      {/* Onboarding overlay — centered over blurred content */}
      {!onboardingDone && onboardingProgress && (
        <OnboardingOverlay
          milestones={onboardingProgress.milestones}
          trialDaysLeft={trialDaysLeft}
        />
      )}
    </div>
  );
}

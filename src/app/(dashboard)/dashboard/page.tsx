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

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireRole("PM");
  const ctx = await getTeamContext(user.id);

  const merchantApp = ctx.isTeamMember ? null : await db.merchantApplication.findUnique({
    where: { userId: ctx.landlordId },
    select: { status: true, createdAt: true },
  });

  const showOnboardingBanner =
    !ctx.isTeamMember && (!merchantApp || merchantApp.status === "NOT_STARTED" || merchantApp.status === "IN_PROGRESS");

  // Calculate days remaining for merchant application (30-day window)
  let daysRemaining: number | null = null;
  let appExpired = false;
  if (showOnboardingBanner && merchantApp?.createdAt) {
    const daysSince = Math.floor(
      (Date.now() - new Date(merchantApp.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    daysRemaining = Math.max(0, 30 - daysSince);
    appExpired = daysRemaining <= 0;
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
    <div className="space-y-8">
      <DashboardNoticeBanner />
      <RoommateApprovals />
      <ExpiringLeases />

      {can(ctx, "payments:read") && <UnpaidRentWidget />}

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

      {showOnboardingBanner && (
        <Link
          href="/dashboard/onboarding"
          className={`flex items-center justify-between rounded-lg border p-4 transition-colors ${
            appExpired
              ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
              : daysRemaining !== null && daysRemaining <= 3
              ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
              : daysRemaining !== null && daysRemaining <= 7
              ? "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
              : "border-primary/30 bg-primary/5 hover:bg-primary/10"
          }`}
        >
          <div>
            <p className="font-semibold">
              {appExpired
                ? "Merchant Application Expired"
                : "Complete Your Merchant Application"}
            </p>
            <p className="text-sm text-muted-foreground">
              {appExpired
                ? "Your 30-day application window has expired. Please contact support."
                : daysRemaining !== null
                ? `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining to complete your application.`
                : "Finish your application to start accepting payments from tenants."}
            </p>
          </div>
          <ArrowRight className={`h-5 w-5 ${
            appExpired || (daysRemaining !== null && daysRemaining <= 3)
              ? "text-destructive"
              : daysRemaining !== null && daysRemaining <= 7
              ? "text-amber-500"
              : "text-primary"
          }`} />
        </Link>
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
  );
}

export const dynamic = "force-dynamic";

import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { calculatePlatformRevenue } from "@/lib/platform-revenue";
import { MetricCard } from "@/components/ui/metric-card";
import { RecentActivityFeed } from "@/components/admin/recent-activity-feed";
import { PortfolioStatistics } from "@/components/dashboard/portfolio-statistics";
import { MonthlyVolumeDetail } from "@/components/dashboard/monthly-volume-detail";
import { PortfolioChangesChart } from "@/components/dashboard/portfolio-changes-chart";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  CreditCard,
  CheckCircle2,
  UserPlus,
  ShieldAlert,
  Landmark,
  Receipt,
} from "lucide-react";

export const metadata = { title: "Admin Dashboard" };

export default async function AdminDashboardPage() {
  await requireAdminPermission("admin:overview");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    0,
    23,
    59,
    59,
    999
  );

  const [
    landlordCount,
    tenantCount,
    propertyCount,
    unitCount,
    occupiedUnits,
    totalVolume,
    mtdVolume,
    lastMonthVolume,
    totalPayments,
    completedPayments,
    failedPayments,
    recentPayments,
    recentUsers,
    platformRevenue,
  ] = await Promise.all([
    db.user.count({ where: { role: "PM" } }),
    db.user.count({ where: { role: "TENANT" } }),
    db.property.count(),
    db.unit.count(),
    db.unit.count({ where: { status: "OCCUPIED" } }),
    db.payment.aggregate({
      where: { status: "COMPLETED" },
      _sum: { amount: true },
    }),
    db.payment.aggregate({
      where: { status: "COMPLETED", paidAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    db.payment.aggregate({
      where: {
        status: "COMPLETED",
        paidAt: { gte: lastMonthStart, lte: lastMonthEnd },
      },
      _sum: { amount: true },
    }),
    db.payment.count(),
    db.payment.count({ where: { status: "COMPLETED" } }),
    db.payment.count({ where: { status: "FAILED" } }),
    db.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        tenant: { include: { user: { select: { name: true } } } },
        landlord: { select: { name: true } },
        unit: {
          select: {
            unitNumber: true,
            property: { select: { name: true } },
          },
        },
      },
    }),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, role: true, createdAt: true },
    }),
    // Tier-aware DoorStax platform revenue (card margin + ACH fees + software MRR).
    // See src/lib/platform-revenue.ts for the model.
    calculatePlatformRevenue(),
  ]);

  const totalVol = Number(totalVolume._sum.amount || 0);
  const mtdVol = Number(mtdVolume._sum.amount || 0);
  const lastMVol = Number(lastMonthVolume._sum.amount || 0);
  const momGrowth =
    lastMVol > 0 ? ((mtdVol - lastMVol) / lastMVol) * 100 : 0;
  const avgTxSize = completedPayments > 0 ? totalVol / completedPayments : 0;
  const successRate =
    totalPayments > 0 ? (completedPayments / totalPayments) * 100 : 0;
  const occupancyRate =
    unitCount > 0 ? (occupiedUnits / unitCount) * 100 : 0;

  // DoorStax platform revenue — tier-aware model (card margin + ACH fees + MRR).
  // Matches the detailed breakdown on /admin/residuals.
  const { cardRevenue, achRevenue, softwareMRR, totalRevenue: totalEarnings } =
    platformRevenue;

  const serializedPayments = recentPayments.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    status: p.status,
    type: p.type,
    tenantName: p.tenant.user.name,
    landlordName: p.landlord.name,
    property: p.unit.property.name,
    unit: p.unit.unitNumber,
    createdAt: p.createdAt.toISOString(),
  }));

  const serializedUsers = recentUsers.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-8 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Command Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Full platform overview — DoorStax operations.
        </p>
      </div>

      {/* Revenue Metrics */}
      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Revenue
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-stagger">
          <MetricCard
            label="Total Volume"
            value={formatCurrency(totalVol)}
            icon={<DollarSign className="h-4 w-4" />}
            href="/admin/volume"
          />
          <MetricCard
            label="MTD Volume"
            value={formatCurrency(mtdVol)}
            icon={<TrendingUp className="h-4 w-4" />}
            href="/admin/volume"
          />
          <MetricCard
            label="MoM Growth"
            value={`${momGrowth >= 0 ? "+" : ""}${momGrowth.toFixed(1)}%`}
            icon={<TrendingUp className="h-4 w-4" />}
            href="/admin/volume"
          />
          <MetricCard
            label="Avg Transaction"
            value={formatCurrency(avgTxSize)}
            icon={<CreditCard className="h-4 w-4" />}
            href="/admin/payments"
          />
        </div>
      </section>

      {/* DoorStax Earnings */}
      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          DoorStax Earnings
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-stagger">
          <MetricCard
            label="Card Processing Margin"
            value={formatCurrency(cardRevenue)}
            icon={<CreditCard className="h-4 w-4" />}
            href="/admin/residuals"
          />
          <MetricCard
            label="ACH Platform Fees"
            value={formatCurrency(achRevenue)}
            icon={<Landmark className="h-4 w-4" />}
            href="/admin/residuals"
          />
          <MetricCard
            label="Software Fees (MRR)"
            value={formatCurrency(softwareMRR)}
            icon={<Receipt className="h-4 w-4" />}
            href="/admin/residuals"
          />
          <MetricCard
            label="Total Earnings"
            value={formatCurrency(totalEarnings)}
            icon={<DollarSign className="h-4 w-4" />}
            href="/admin/residuals"
          />
        </div>
      </section>

      {/* Platform Metrics */}
      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Platform
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            label="Managers"
            value={landlordCount}
            icon={<Building2 className="h-4 w-4" />}
            href="/admin/landlords"
          />
          <MetricCard
            label="Tenants"
            value={tenantCount}
            icon={<Users className="h-4 w-4" />}
            href="/admin/tenants"
          />
          <MetricCard
            label="Properties"
            value={propertyCount}
            icon={<Building2 className="h-4 w-4" />}
            href="/admin/properties"
          />
          <MetricCard
            label="Occupancy"
            value={`${occupancyRate.toFixed(0)}%`}
            icon={<Building2 className="h-4 w-4" />}
            href="/admin/properties"
          />
          <MetricCard
            label="Success Rate"
            value={`${successRate.toFixed(1)}%`}
            icon={<CheckCircle2 className="h-4 w-4" />}
            href="/admin/payments"
          />
        </div>
      </section>

      {/* Portfolio Statistics */}
      <PortfolioStatistics scope="admin" />

      {/* Monthly Volume Detail */}
      <MonthlyVolumeDetail scope="admin" />

      {/* Portfolio Changes */}
      <PortfolioChangesChart scope="admin" />

      {/* Quick Actions */}
      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/landlords/new">
            <Button variant="outline" size="sm">
              <UserPlus className="mr-2 h-4 w-4" />
              Add Manager
            </Button>
          </Link>
          <Link href="/admin/payments">
            <Button variant="outline" size="sm">
              <CreditCard className="mr-2 h-4 w-4" />
              All Payments
            </Button>
          </Link>
          <Link href="/admin/risk">
            <Button variant="outline" size="sm">
              <ShieldAlert className="mr-2 h-4 w-4" />
              Risk Flags
            </Button>
          </Link>
          <Link href="/admin/volume">
            <Button variant="outline" size="sm">
              <TrendingUp className="mr-2 h-4 w-4" />
              Volume Analytics
            </Button>
          </Link>
        </div>
      </section>

      {/* Recent Activity Feed */}
      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Recent Activity
        </h2>
        <RecentActivityFeed
          payments={serializedPayments}
          users={serializedUsers}
        />
      </section>
    </div>
  );
}

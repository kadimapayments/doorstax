import Link from "next/link";
import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { MetricCard } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PaymentMethodBadge } from "@/components/ui/payment-method-badge";
import { CreditCard, DollarSign, RefreshCw, FileText, TrendingUp, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DashboardNoticeBanner } from "@/components/layout/dashboard-notice-banner";
import { NextRentPayment } from "@/components/tenant/next-rent-payment";

export const metadata = { title: "Tenant Dashboard" };

export default async function TenantDashboardPage() {
  const user = await requireRole("TENANT");

  const profile = await db.tenantProfile.findUnique({
    where: { userId: user.id },
    include: {
      unit: {
        include: { property: { select: { name: true, address: true } } },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      recurringBilling: true,
    },
  });

  if (!profile || !profile.unit) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          Your tenant profile is being set up. Please check back soon.
        </p>
      </div>
    );
  }

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const thisMonthPayments = profile.payments.filter((p) => {
    const d = new Date(p.dueDate);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const hasPaidThisMonth = thisMonthPayments.some(
    (p) => p.status === "COMPLETED"
  );
  const now = new Date();
  const isLate = !hasPaidThisMonth && thisMonthPayments.some(
    (p) => p.status === "PENDING" && new Date(p.dueDate) < now
  );
  const rentStatus = hasPaidThisMonth ? "Paid" : isLate ? "Late" : "Due";
  const rentAmount = Number(profile.unit.rentAmount);
  const splitPercent = profile.splitPercent;
  const myRent = rentAmount * splitPercent / 100;

  // Get active lease
  const lease = await db.lease.findFirst({
    where: { tenantId: profile.id, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });

  // Get roommates for this unit
  const roommates = splitPercent < 100
    ? await db.tenantProfile.findMany({
        where: { unitId: profile.unitId, id: { not: profile.id } },
        include: { user: { select: { name: true } } },
      })
    : [];

  return (
    <div className="space-y-8">
      <DashboardNoticeBanner />

      <NextRentPayment
        rentAmount={rentAmount}
        dueDay={profile.unit.dueDay ?? 1}
        hasPaidThisMonth={hasPaidThisMonth}
        isAutopayEnabled={profile.autopayEnabled}
        splitPercent={splitPercent}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.unit.property.name} &middot; Unit{" "}
            {profile.unit.unitNumber}
            {splitPercent < 100 && (
              <span> &middot; Your split: {splitPercent}%</span>
            )}
          </p>
        </div>
        {!hasPaidThisMonth && (
          <Link href="/tenant/pay">
            <Button size="lg">
              <CreditCard className="mr-2 h-4 w-4" />
              Pay Rent
            </Button>
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3 animate-stagger">
        <MetricCard
          label={splitPercent < 100 ? `Your Split (${splitPercent}%)` : "Monthly Rent"}
          value={formatCurrency(myRent)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          label="This Month"
          value={rentStatus}
          icon={<DollarSign className="h-4 w-4" />}
          className={
            rentStatus === "Paid"
              ? "border-emerald-500/30 bg-emerald-500/5"
              : rentStatus === "Late"
              ? "border-destructive/30 bg-destructive/5"
              : undefined
          }
        />
        <MetricCard
          label="Autopay"
          value={profile.autopayEnabled ? "Active" : "Off"}
          icon={<RefreshCw className="h-4 w-4" />}
        />
      </div>

      {/* Tenant Benefits */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          Instant payment confirmations
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          Secure online rent payments
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          Credit building through rent reporting
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          Autopay convenience
        </div>
      </div>

      {/* Credit Building */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Credit Building
            </CardTitle>
            <Badge
              variant="outline"
              className={
                profile.creditReportingEnrolled
                  ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              }
            >
              {profile.creditReportingEnrolled ? "Enrolled" : "Not Enrolled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Build credit with qualifying on-time rent payments. Enroll in rent
            reporting to help strengthen your credit profile over time.
          </p>
          {!profile.creditReportingEnrolled ? (
            <Link href="/tenant/credit">
              <Button className="gradient-bg w-full">
                Enroll in Credit Reporting
              </Button>
            </Link>
          ) : (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              ✓ Your qualifying payments are being reported.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Lease Agreement */}
      {lease && (
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Lease Agreement</CardTitle>
              <StatusBadge status={lease.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Lease Period</span>
              <span>
                {formatDate(lease.startDate)} — {formatDate(lease.endDate)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Monthly Rent</span>
              <span className="font-semibold">
                {formatCurrency(Number(lease.rentAmount))}
              </span>
            </div>
            {lease.documentUrl && (
              <a
                href={lease.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <FileText className="h-4 w-4" />
                View Lease Document
              </a>
            )}
            <div className="pt-1">
              <Link
                href="/tenant/leases"
                className="text-sm text-primary hover:underline"
              >
                View all lease details →
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Roommates */}
      {roommates.length > 0 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Roommates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">You</span>
                <span>{splitPercent}% — {formatCurrency(myRent)}/mo</span>
              </div>
              {roommates.map((rm) => (
                <div key={rm.id} className="flex justify-between text-sm">
                  <span>{rm.user.name}</span>
                  <span>{rm.splitPercent}% — {formatCurrency(rentAmount * rm.splitPercent / 100)}/mo</span>
                </div>
              ))}
              <div className="border-t border-border pt-2 flex justify-between text-sm font-medium">
                <span>Total Rent</span>
                <span>{formatCurrency(rentAmount)}/mo</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Payments */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Recent Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {profile.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <div className="space-y-3">
              {profile.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {formatCurrency(Number(payment.amount))}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>{formatDate(payment.dueDate)}</span>
                      <span>&middot;</span>
                      <PaymentMethodBadge
                        method={payment.paymentMethod}
                        cardBrand={payment.cardBrand}
                        cardLast4={payment.cardLast4}
                        achLast4={payment.achLast4}
                      />
                    </div>
                  </div>
                  <StatusBadge status={payment.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

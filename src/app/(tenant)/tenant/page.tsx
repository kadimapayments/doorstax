import Link from "next/link";
import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { MetricCard } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CreditCard, DollarSign, RefreshCw } from "lucide-react";

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
  const rentAmount = Number(profile.unit.rentAmount);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.unit.property.name} &middot; Unit{" "}
            {profile.unit.unitNumber}
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

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Monthly Rent"
          value={formatCurrency(rentAmount)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          label="This Month"
          value={hasPaidThisMonth ? "Paid" : "Due"}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          label="Autopay"
          value={profile.autopayEnabled ? "Active" : "Off"}
          icon={<RefreshCw className="h-4 w-4" />}
        />
      </div>

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
                    <p className="text-xs text-muted-foreground">
                      {formatDate(payment.dueDate)} &middot;{" "}
                      {payment.paymentMethod?.toUpperCase() || "—"}
                    </p>
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

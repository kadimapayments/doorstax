import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { MetricCard } from "@/components/ui/metric-card";
import { formatCurrency } from "@/lib/utils";
import { Building2, Users, DollarSign, AlertTriangle } from "lucide-react";

export const metadata = { title: "Admin Dashboard" };

export default async function AdminDashboardPage() {
  await requireRole("ADMIN");

  const [landlords, tenants, payments, failedPayments] = await Promise.all([
    db.user.count({ where: { role: "LANDLORD" } }),
    db.user.count({ where: { role: "TENANT" } }),
    db.payment.aggregate({
      where: { status: "COMPLETED" },
      _sum: { amount: true },
    }),
    db.payment.count({ where: { status: "FAILED" } }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kadima internal dashboard for DoorStax operations.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Landlords"
          value={landlords}
          icon={<Building2 className="h-4 w-4" />}
        />
        <MetricCard
          label="Tenants"
          value={tenants}
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          label="Total Volume"
          value={formatCurrency(Number(payments._sum.amount || 0))}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          label="Failed Payments"
          value={failedPayments}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>
    </div>
  );
}

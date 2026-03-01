import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { MetricCard } from "@/components/ui/metric-card";
import { formatCurrency } from "@/lib/utils";
import { Building2, DollarSign, Clock, AlertTriangle } from "lucide-react";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireRole("LANDLORD");

  const [properties, payments] = await Promise.all([
    db.property.findMany({
      where: { landlordId: user.id },
      include: {
        units: { select: { rentAmount: true, status: true } },
      },
    }),
    db.payment.findMany({
      where: {
        landlordId: user.id,
        dueDate: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
        },
      },
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back. Here&apos;s your portfolio summary.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Monthly Rent"
          value={formatCurrency(totalMonthlyRent)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          label="Collected This Month"
          value={formatCurrency(collected)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          label="Pending"
          value={formatCurrency(pending)}
          icon={<Clock className="h-4 w-4" />}
        />
        <MetricCard
          label="Failed Payments"
          value={failed}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Properties"
          value={properties.length}
          icon={<Building2 className="h-4 w-4" />}
        />
        <MetricCard
          label="Total Units"
          value={allUnits.length}
          icon={<Building2 className="h-4 w-4" />}
        />
        <MetricCard
          label="Occupancy"
          value={
            allUnits.length > 0
              ? `${Math.round((occupiedUnits.length / allUnits.length) * 100)}%`
              : "—"
          }
          icon={<Building2 className="h-4 w-4" />}
        />
      </div>
    </div>
  );
}

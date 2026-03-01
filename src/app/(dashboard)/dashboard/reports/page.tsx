import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, TrendingUp, AlertTriangle, BarChart3 } from "lucide-react";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const user = await requireRole("LANDLORD");

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const payments = await db.payment.findMany({
    where: {
      landlordId: user.id,
      dueDate: { gte: startOfMonth, lt: endOfMonth },
    },
  });

  const completed = payments.filter((p) => p.status === "COMPLETED");
  const pending = payments.filter((p) => p.status === "PENDING");
  const failed = payments.filter((p) => p.status === "FAILED");

  const totalCollected = completed.reduce((s, p) => s + Number(p.amount), 0);
  const totalPending = pending.reduce((s, p) => s + Number(p.amount), 0);
  const totalFailed = failed.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description={`Monthly summary — ${now.toLocaleString("default", { month: "long", year: "numeric" })}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Collected"
          value={formatCurrency(totalCollected)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          label="Pending"
          value={formatCurrency(totalPending)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <MetricCard
          label="Failed"
          value={formatCurrency(totalFailed)}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <MetricCard
          label="Total Transactions"
          value={payments.length}
          icon={<BarChart3 className="h-4 w-4" />}
        />
      </div>
    </div>
  );
}

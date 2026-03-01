import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { AlertTriangle, Ban, RotateCcw, ShieldAlert } from "lucide-react";
import { RiskTable } from "@/components/admin/risk-table";

export const metadata = { title: "Risk Flags — Admin" };

export default async function AdminRiskPage() {
  await requireRole("ADMIN");

  const [totalPayments, failedPayments, refundedPayments, flaggedPayments] =
    await Promise.all([
      db.payment.count(),
      db.payment.count({ where: { status: "FAILED" } }),
      db.payment.count({ where: { status: "REFUNDED" } }),
      db.payment.findMany({
        where: { status: { in: ["FAILED", "REFUNDED"] } },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          landlord: { select: { name: true } },
          tenant: { include: { user: { select: { name: true } } } },
          unit: { select: { unitNumber: true } },
        },
      }),
    ]);

  const failedRate = totalPayments > 0 ? ((failedPayments / totalPayments) * 100).toFixed(1) : "0.0";
  const refundRate = totalPayments > 0 ? ((refundedPayments / totalPayments) * 100).toFixed(1) : "0.0";

  const rows = flaggedPayments.map((p) => ({
    id: p.id,
    landlord: p.landlord.name,
    tenant: p.tenant.user.name,
    unit: p.unit.unitNumber,
    amount: Number(p.amount),
    status: p.status,
    date: p.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-8">
      <PageHeader title="Risk Flags" description="Failed ACH, chargebacks, and refunds." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Failed Payments"
          value={failedPayments}
          icon={<Ban className="h-4 w-4" />}
        />
        <MetricCard
          label="Refunded"
          value={refundedPayments}
          icon={<RotateCcw className="h-4 w-4" />}
        />
        <MetricCard
          label="Failure Rate"
          value={`${failedRate}%`}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <MetricCard
          label="Refund Rate"
          value={`${refundRate}%`}
          icon={<ShieldAlert className="h-4 w-4" />}
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Flagged Transactions</h2>
        <RiskTable rows={rows} />
      </div>
    </div>
  );
}

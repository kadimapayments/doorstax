import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { RiskFilterWrapper } from "@/components/admin/risk-filter-wrapper";
import { formatCurrency } from "@/lib/utils";
import type { RiskRow } from "@/components/admin/risk-table";

export const metadata = { title: "Risk Flags — Admin" };

export default async function AdminRiskPage() {
  await requireAdminPermission("admin:risk");

  const [totalPayments, failedPayments, refundedPayments] = await Promise.all([
    db.payment.count(),
    db.payment.count({ where: { status: "FAILED" } }),
    db.payment.count({ where: { status: "REFUNDED" } }),
  ]);

  const failedRate = totalPayments > 0 ? ((failedPayments / totalPayments) * 100).toFixed(1) : "0.0";

  const flaggedPayments = await db.payment.findMany({
    where: { status: { in: ["FAILED", "REFUNDED"] } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      landlord: { select: { name: true } },
      tenant: { include: { user: { select: { name: true, id: true } } } },
      unit: { select: { unitNumber: true } },
    },
  });

  const tenantFailureCounts = new Map<string, number>();
  for (const p of flaggedPayments) {
    if (p.status === "FAILED") {
      tenantFailureCounts.set(p.tenantId, (tenantFailureCounts.get(p.tenantId) ?? 0) + 1);
    }
  }

  function getSeverity(amount: number, failureCount: number): "HIGH" | "MEDIUM" | "LOW" {
    if (amount >= 2000 || failureCount >= 3) return "HIGH";
    if (amount >= 500 || failureCount >= 2) return "MEDIUM";
    return "LOW";
  }

  const flaggedRows: RiskRow[] = flaggedPayments.map((p) => {
    const failCount = tenantFailureCounts.get(p.tenantId) ?? 0;
    return {
      id: p.id,
      landlord: p.landlord.name,
      tenant: p.tenant.user.name,
      unit: p.unit.unitNumber,
      amount: Number(p.amount),
      status: p.status,
      severity: getSeverity(Number(p.amount), failCount),
      failureCount: failCount,
      date: p.createdAt.toISOString(),
    };
  });

  const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  flaggedRows.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const now = new Date();
  const latePayments = await db.payment.findMany({
    where: {
      status: "PENDING",
      dueDate: { lt: now },
    },
    orderBy: { dueDate: "asc" },
    take: 50,
    include: {
      landlord: { select: { name: true } },
      tenant: { include: { user: { select: { name: true } } } },
      unit: { select: { unitNumber: true } },
    },
  });

  const lateCount = latePayments.length;
  const totalLateAmount = latePayments.reduce((s, p) => s + Number(p.amount), 0);

  const lateRows: RiskRow[] = latePayments.map((p) => ({
    id: p.id,
    landlord: p.landlord.name,
    tenant: p.tenant.user.name,
    unit: p.unit.unitNumber,
    amount: Number(p.amount),
    status: "LATE",
    severity: Number(p.amount) >= 2000 ? "HIGH" : Number(p.amount) >= 500 ? "MEDIUM" : "LOW",
    failureCount: 0,
    date: p.dueDate.toISOString(),
  }));

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const recentFailures = await db.payment.groupBy({
    by: ["tenantId"],
    where: {
      status: "FAILED",
      createdAt: { gte: ninetyDaysAgo },
    },
    _count: { id: true },
    having: {
      id: { _count: { gte: 2 } },
    },
  });

  const delinquentCount = recentFailures.length;

  // Get landlord list for filter
  const landlords = await db.user.findMany({
    where: { role: "PM" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-8">
      <PageHeader title="Risk Flags" description="Failed payments, chargebacks, late payments, and delinquent tenants." />
      <RiskFilterWrapper
        flaggedRows={flaggedRows}
        lateRows={lateRows}
        metrics={{
          failedPayments,
          refundedPayments,
          failedRate,
          lateCount,
          totalLateAmount,
          delinquentCount,
        }}
        landlords={landlords}
      />
    </div>
  );
}

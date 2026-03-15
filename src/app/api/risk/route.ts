import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);

  // Get payment IDs for this landlord
  const payments = await db.payment.findMany({
    where: { landlordId },
    select: {
      id: true,
      amount: true,
      status: true,
      type: true,
      dueDate: true,
      paidAt: true,
      createdAt: true,
      paymentMethod: true,
      cardBrand: true,
      cardLast4: true,
      achLast4: true,
      tenantId: true,
      tenant: { include: { user: { select: { name: true, email: true } } } },
      unit: { select: { unitNumber: true, property: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalPayments = payments.length;
  const failedPayments = payments.filter((p) => p.status === "FAILED");
  const refundedPayments = payments.filter((p) => p.status === "REFUNDED");
  const failedCount = failedPayments.length;
  const refundedCount = refundedPayments.length;
  const failedRate = totalPayments > 0 ? ((failedCount / totalPayments) * 100).toFixed(1) : "0.0";

  // Late payments (PENDING past dueDate)
  const now = new Date();
  const latePayments = payments.filter((p) => p.status === "PENDING" && new Date(p.dueDate) < now);
  const lateCount = latePayments.length;
  const totalLateAmount = latePayments.reduce((s, p) => s + Number(p.amount), 0);

  // Count failures per tenant
  const tenantFailureCounts = new Map<string, number>();
  for (const p of failedPayments) {
    tenantFailureCounts.set(p.tenantId, (tenantFailureCounts.get(p.tenantId) ?? 0) + 1);
  }

  // At-risk tenants (2+ failures)
  const atRiskTenants = Array.from(tenantFailureCounts.entries())
    .filter(([, count]) => count >= 2)
    .map(([tenantId, count]) => {
      const tenantPayment = payments.find((p) => p.tenantId === tenantId);
      return {
        tenantId,
        name: tenantPayment?.tenant.user.name ?? "Unknown",
        email: tenantPayment?.tenant.user.email ?? "",
        failureCount: count,
      };
    });

  // Severity classification
  function getSeverity(amount: number, failureCount: number): "HIGH" | "MEDIUM" | "LOW" {
    if (amount >= 2000 || failureCount >= 3) return "HIGH";
    if (amount >= 500 || failureCount >= 2) return "MEDIUM";
    return "LOW";
  }

  // Flagged transactions
  const flagged = [...failedPayments, ...refundedPayments].map((p) => {
    const failCount = tenantFailureCounts.get(p.tenantId) ?? 0;
    return {
      id: p.id,
      tenant: p.tenant.user.name,
      property: p.unit.property.name,
      unit: p.unit.unitNumber,
      amount: Number(p.amount),
      status: p.status,
      severity: getSeverity(Number(p.amount), failCount),
      failureCount: failCount,
      paymentMethod: p.paymentMethod,
      cardBrand: p.cardBrand,
      cardLast4: p.cardLast4,
      achLast4: p.achLast4,
      date: p.createdAt.toISOString(),
    };
  });

  // Sort by severity
  const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  flagged.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Late payment rows
  const lateRows = latePayments.map((p) => ({
    id: p.id,
    tenant: p.tenant.user.name,
    property: p.unit.property.name,
    unit: p.unit.unitNumber,
    amount: Number(p.amount),
    status: "LATE",
    severity: Number(p.amount) >= 2000 ? "HIGH" as const : Number(p.amount) >= 500 ? "MEDIUM" as const : "LOW" as const,
    failureCount: 0,
    date: p.dueDate.toISOString(),
  }));

  return NextResponse.json({
    metrics: {
      totalPayments,
      failedCount,
      refundedCount,
      failedRate,
      lateCount,
      totalLateAmount,
      atRiskCount: atRiskTenants.length,
    },
    flagged,
    latePayments: lateRows,
    atRiskTenants,
  });
}

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveApiLandlord } from "@/lib/api-landlord";

/**
 * GET /api/tenants/[id]/active-recovery-plan
 *
 * Returns the tenant's active recovery plan (PLAN_OFFERED, PLAN_ACTIVE,
 * or PLAN_AT_RISK) if any exists, or `{ plan: null }` otherwise.
 *
 * Drives the recovery-plan card on the Charge Tenant form so PMs see
 * the plan progress and can opt to apply the charge directly to the
 * plan instead of waiting for the reconcile cron.
 *
 * Auth via resolveApiLandlord — admin "View as PM" is supported.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await resolveApiLandlord();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: tenantId } = await params;

  // Scope by landlord — same pattern as /api/tenants/[id]/payment-methods
  const tenant = await db.tenantProfile.findFirst({
    where: {
      id: tenantId,
      unit: { property: { landlordId: ctx.landlordId } },
    },
    select: { id: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const plan = await db.recoveryPlan.findFirst({
    where: {
      tenantId,
      status: { in: ["PLAN_OFFERED", "PLAN_ACTIVE", "PLAN_AT_RISK"] },
    },
    select: {
      id: true,
      status: true,
      originalBalance: true,
      forgivenessAmount: true,
      requiredPayments: true,
      completedPayments: true,
      requiredPeriodKeys: true,
      startDate: true,
      endDate: true,
      graceDays: true,
      failurePolicy: true,
    },
  });

  if (!plan) {
    return NextResponse.json({ plan: null });
  }

  return NextResponse.json({
    plan: {
      id: plan.id,
      status: plan.status,
      originalBalance: Number(plan.originalBalance),
      forgivenessAmount: Number(plan.forgivenessAmount),
      requiredPayments: plan.requiredPayments,
      completedPayments: plan.completedPayments,
      requiredPeriodKeys: plan.requiredPeriodKeys,
      startDate: plan.startDate.toISOString(),
      endDate: plan.endDate.toISOString(),
      graceDays: plan.graceDays,
      failurePolicy: plan.failurePolicy,
    },
  });
}

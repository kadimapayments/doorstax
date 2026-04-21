export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveApiLandlord } from "@/lib/api-landlord";
import { db } from "@/lib/db";
import { getActivePlanForTenant } from "@/lib/recovery/service";

/**
 * GET /api/tenants/[id]/recovery
 *
 * Returns the tenant's active recovery plan (OFFERED / ACTIVE / AT_RISK),
 * plus their most recent terminal plan for history display. Callable by:
 *   - The tenant themselves (session.user.id maps to the TenantProfile.userId)
 *   - The PM that owns the tenant's unit (via resolveApiLandlord)
 *
 * :id here is TenantProfile.id.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: tenantId } = await params;

  const tenant = await db.tenantProfile.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      userId: true,
      unit: {
        select: {
          property: { select: { landlordId: true, name: true } },
          unitNumber: true,
        },
      },
    },
  });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Tenant can view their own. Otherwise, must be the PM for the property
  // (supports admin impersonation via resolveApiLandlord).
  let authorized = tenant.userId === session.user.id;
  if (!authorized) {
    const ctx = await resolveApiLandlord();
    authorized =
      !!ctx && ctx.landlordId === tenant.unit?.property.landlordId;
  }
  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const active = await getActivePlanForTenant(tenantId);
  const latestTerminal = await db.recoveryPlan.findFirst({
    where: {
      tenantId,
      status: { in: ["PLAN_FAILED", "PLAN_COMPLETED", "PLAN_CANCELLED"] },
    },
    orderBy: { updatedAt: "desc" },
    include: { paymentLogs: { orderBy: { createdAt: "asc" } } },
  });

  return NextResponse.json({
    active,
    latestTerminal,
    unitLabel: tenant.unit
      ? `${tenant.unit.property.name} — Unit ${tenant.unit.unitNumber}`
      : null,
  });
}

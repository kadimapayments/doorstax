export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveApiLandlord } from "@/lib/api-landlord";

/**
 * GET /api/tenants/[id]/outstanding-charges
 *
 * Returns the tenant's open / unpaid charges (Payment rows in PENDING
 * or FAILED status that haven't been voided). Drives the
 * "Apply to outstanding charge" selector on the charge form so a PM
 * recording rent / fees / deposits doesn't silently create a duplicate
 * line item alongside an existing open balance.
 *
 * Each row includes the metadata the form needs to render an apply
 * affordance: amount, type, description, dueDate.
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

  // Same scope check as /api/tenants/[id]/payment-methods — ensures
  // the caller actually has rights to this tenant.
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

  const charges = await db.payment.findMany({
    where: {
      tenantId,
      status: { in: ["PENDING", "FAILED"] },
      voidedAt: null,
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    take: 100,
    select: {
      id: true,
      amount: true,
      type: true,
      status: true,
      description: true,
      dueDate: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    charges: charges.map((c) => ({
      id: c.id,
      amount: Number(c.amount),
      type: c.type,
      status: c.status,
      description: c.description,
      dueDate: c.dueDate.toISOString(),
      createdAt: c.createdAt.toISOString(),
    })),
    count: charges.length,
    totalDue: charges.reduce((sum, c) => sum + Number(c.amount), 0),
  });
}

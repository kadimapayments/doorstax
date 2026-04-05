import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";

/**
 * GET /api/expenses/tenants?propertyId=XXX
 *
 * Returns a lightweight list of active tenant profiles for a property,
 * scoped to tenants whose units belong to that property. Used by the
 * expense form to assign charges to specific tenants.
 *
 * Each returned `id` is a TenantProfile.id (required for Expense.tenantId).
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || !["PM", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");

  if (!propertyId) {
    return NextResponse.json({ error: "propertyId required" }, { status: 400 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);

  // Verify property belongs to this PM
  const property = await db.property.findFirst({
    where: { id: propertyId, landlordId },
    select: { id: true },
  });

  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  // Get all active tenant profiles for units in this property
  const profiles = await db.tenantProfile.findMany({
    where: {
      unit: { propertyId },
      status: "ACTIVE",
    },
    select: {
      id: true,
      user: { select: { name: true, email: true } },
      unit: { select: { unitNumber: true } },
    },
    orderBy: { unit: { unitNumber: "asc" } },
  });

  return NextResponse.json(
    profiles.map((p) => ({
      id: p.id,
      name: p.user?.name || "Unknown",
      unitNumber: p.unit?.unitNumber || "",
    }))
  );
}

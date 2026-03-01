import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "LANDLORD") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const tenant = await db.tenantProfile.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      unit: {
        select: {
          id: true,
          unitNumber: true,
          rentAmount: true,
          property: { select: { name: true } },
        },
      },
    },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // Verify landlord owns this tenant's unit
  if (tenant.unit) {
    const unit = await db.unit.findFirst({
      where: { id: tenant.unit.id, property: { landlordId: session.user.id } },
    });
    if (!unit) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  return NextResponse.json({
    id: tenant.id,
    name: tenant.user.name,
    email: tenant.user.email,
    phone: tenant.user.phone,
    unitId: tenant.unitId,
    unitNumber: tenant.unit?.unitNumber || "—",
    propertyName: tenant.unit?.property.name || "—",
    rentAmount: Number(tenant.unit?.rentAmount || 0),
    splitPercent: tenant.splitPercent,
    isPrimary: tenant.isPrimary,
    leaseStart: tenant.leaseStart,
    leaseEnd: tenant.leaseEnd,
  });
}

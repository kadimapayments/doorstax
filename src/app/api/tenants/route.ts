import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const unitId = searchParams.get("unitId");
    const status = searchParams.get("status"); // ACTIVE | PROSPECT | PREVIOUS

    // Get all tenants assigned to this landlord's properties
    const tenants = await db.tenantProfile.findMany({
      where: {
        unit: {
          property: { landlordId: session.user.id },
        },
        ...(unitId ? { unitId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        unit: {
          select: {
            unitNumber: true,
            rentAmount: true,
            property: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Map to a simpler format for the roommates page
    const mapped = tenants.map((t) => ({
      tenantId: t.id,
      userId: t.userId,
      name: t.user.name,
      email: t.user.email,
      phone: t.user.phone,
      status: t.status,
      unitId: t.unitId,
      unitNumber: t.unit?.unitNumber,
      propertyName: t.unit?.property.name,
      rentAmount: Number(t.unit?.rentAmount || 0),
      splitPercent: t.splitPercent,
      isPrimary: t.isPrimary,
      percent: t.splitPercent,
      amount: Number(t.unit?.rentAmount || 0) * t.splitPercent / 100,
    }));

    return NextResponse.json(mapped);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

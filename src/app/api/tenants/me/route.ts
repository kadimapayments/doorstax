import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveTenantUserId } from "@/lib/impersonation";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const effectiveUserId = await getEffectiveTenantUserId(session);
  if (!effectiveUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.tenantProfile.findUnique({
    where: { userId: effectiveUserId },
    include: {
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

  if (!profile || !profile.unit) {
    return NextResponse.json({ error: "No unit assigned" }, { status: 404 });
  }

  return NextResponse.json({
    id: profile.id,
    unitId: profile.unitId,
    unitNumber: profile.unit.unitNumber,
    propertyName: profile.unit.property.name,
    rentAmount: Number(profile.unit.rentAmount),
    splitPercent: profile.splitPercent,
    isPrimary: profile.isPrimary,
  });
}

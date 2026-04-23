import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/tenant/onboarding/lease-ack
 * Returns the active lease for the current tenant's unit.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.tenantProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      unitId: true,
      leaseAcknowledgedAt: true,
      unit: {
        select: {
          unitNumber: true,
          rentAmount: true,
          dueDay: true,
          property: { select: { name: true, address: true } },
        },
      },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Find active lease for this tenant
  const lease = await db.lease.findFirst({
    where: {
      tenantId: profile.id,
      status: { in: ["ACTIVE", "PENDING"] },
    },
    orderBy: { startDate: "desc" },
  });

  return NextResponse.json({
    lease: lease
      ? {
          id: lease.id,
          startDate: lease.startDate.toISOString(),
          endDate: lease.endDate?.toISOString() ?? null,
          rentAmount: Number(lease.rentAmount),
          status: lease.status,
          signedByTenant: lease.signedByTenant,
        }
      : null,
    unit: profile.unit
      ? {
          unitNumber: profile.unit.unitNumber,
          rentAmount: Number(profile.unit.rentAmount),
          dueDay: profile.unit.dueDay,
          propertyName: profile.unit.property?.name || "—",
          propertyAddress: profile.unit.property?.address || "—",
        }
      : null,
    acknowledged: !!profile.leaseAcknowledgedAt,
  });
}

/**
 * POST /api/tenant/onboarding/lease-ack
 * Records the tenant's lease acknowledgment.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.tenantProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Update profile
  await db.tenantProfile.update({
    where: { id: profile.id },
    data: { leaseAcknowledgedAt: new Date() },
  });

  // Also mark the active lease as signed by tenant
  const activeLease = await db.lease.findFirst({
    where: {
      tenantId: profile.id,
      status: { in: ["ACTIVE", "PENDING"] },
    },
    orderBy: { startDate: "desc" },
  });

  if (activeLease) {
    await db.lease.update({
      where: { id: activeLease.id },
      data: {
        signedByTenant: true,
        tenantSignedAt: new Date(),
      },
    });
  }

  return NextResponse.json({ success: true });
}

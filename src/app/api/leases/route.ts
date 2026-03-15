import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { createLeaseSchema } from "@/lib/validations/lease";
import { emit } from "@/lib/events/emitter";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  try {
    if (session.user.role === "PM") {
      const landlordId = await getEffectiveLandlordId(session.user.id);
      const where: Record<string, unknown> = { landlordId };
      if (status) where.status = status;

      const leases = await db.lease.findMany({
        where,
        include: {
          tenant: { include: { user: { select: { name: true, email: true } } } },
          unit: { select: { unitNumber: true, property: { select: { name: true } } } },
          addendums: { orderBy: { createdAt: "desc" } },
          _count: { select: { addendums: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(leases);
    }

    if (session.user.role === "TENANT") {
      const profile = await db.tenantProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (!profile) {
        return NextResponse.json([]);
      }

      const where: Record<string, unknown> = { tenantId: profile.id };
      if (status) where.status = status;

      const leases = await db.lease.findMany({
        where,
        include: {
          unit: { select: { unitNumber: true, property: { select: { name: true } } } },
          addendums: { orderBy: { createdAt: "desc" } },
          _count: { select: { addendums: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(leases);
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (error) {
    console.error("GET /api/leases error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createLeaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid data" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Verify landlord owns the property
    const property = await db.property.findFirst({
      where: { id: data.propertyId, landlordId: session.user.id },
    });
    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    // Verify the unit belongs to the property
    const unit = await db.unit.findFirst({
      where: { id: data.unitId, propertyId: data.propertyId },
    });
    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Create lease and sync tenant profile dates
    const lease = await db.$transaction(async (tx) => {
      const newLease = await tx.lease.create({
        data: {
          tenantId: data.tenantId,
          unitId: data.unitId,
          propertyId: data.propertyId,
          landlordId: session.user.id,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          rentAmount: data.rentAmount,
          documentUrl: data.documentUrl || null,
          notes: data.notes || null,
          status: "PENDING",
        },
      });

      // Sync TenantProfile lease dates
      await tx.tenantProfile.update({
        where: { id: data.tenantId },
        data: {
          leaseStart: new Date(data.startDate),
          leaseEnd: new Date(data.endDate),
        },
      });

      return newLease;
    });

    // Emit lease.created event
    emit({
      eventType: "lease.created",
      aggregateType: "Lease",
      aggregateId: lease.id,
      payload: { tenantId: data.tenantId, unitId: data.unitId, propertyId: data.propertyId, rentAmount: data.rentAmount },
      emittedBy: session.user.id,
    }).catch(console.error);

    return NextResponse.json(lease, { status: 201 });
  } catch (error) {
    console.error("POST /api/leases error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

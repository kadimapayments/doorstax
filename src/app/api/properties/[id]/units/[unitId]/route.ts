import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveApiLandlord } from "@/lib/api-landlord";
import { updateUnitSchema } from "@/lib/validations/property";
import { z } from "zod";

async function verifyUnitOwnership(
  propertyId: string,
  unitId: string,
  landlordId: string
) {
  const unit = await db.unit.findFirst({
    where: {
      id: unitId,
      propertyId,
      property: { landlordId },
    },
  });
  return unit;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; unitId: string }> }
) {
  const ctx = await resolveApiLandlord();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, unitId } = await params;
  const unit = await verifyUnitOwnership(id, unitId, ctx.landlordId);
  if (!unit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const full = await db.unit.findUnique({
    where: { id: unitId },
    include: {
      property: { select: { name: true, address: true } },
      tenantProfiles: {
        include: { user: { select: { name: true, email: true, phone: true } } },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  return NextResponse.json(full);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; unitId: string }> }
) {
  const ctx = await resolveApiLandlord();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, unitId } = await params;
  const unit = await verifyUnitOwnership(id, unitId, ctx.landlordId);
  if (!unit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const data = updateUnitSchema.parse(body);

    const updated = await db.unit.update({
      where: { id: unitId },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; unitId: string }> }
) {
  const ctx = await resolveApiLandlord();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, unitId } = await params;
  const unit = await verifyUnitOwnership(id, unitId, ctx.landlordId);
  if (!unit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.unit.delete({ where: { id: unitId } });
  return NextResponse.json({ success: true });
}

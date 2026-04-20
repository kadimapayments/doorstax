import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveApiLandlord } from "@/lib/api-landlord";
import { updatePropertySchema } from "@/lib/validations/property";
import { syncSubscriptionAmount } from "@/lib/subscription";
import { z } from "zod";

async function verifyOwnership(propertyId: string, landlordId: string) {
  const property = await db.property.findFirst({
    where: { id: propertyId, landlordId },
  });
  return property;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await resolveApiLandlord();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const property = await verifyOwnership(id, ctx.landlordId);
  if (!property) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const full = await db.property.findUnique({
    where: { id },
    include: {
      units: {
        include: {
          tenantProfiles: {
            include: { user: { select: { name: true, email: true } } },
          },
        },
        orderBy: { unitNumber: "asc" },
      },
    },
  });

  return NextResponse.json(full);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await resolveApiLandlord();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const property = await verifyOwnership(id, ctx.landlordId);
  if (!property) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const data = updatePropertySchema.parse(body);

    const updated = await db.property.update({
      where: { id },
      data: {
        ...data,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : data.purchaseDate,
      },
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
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await resolveApiLandlord();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const property = await verifyOwnership(id, ctx.landlordId);
  if (!property) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.property.delete({ where: { id } });

  // Sync subscription billing after property deletion (against the landlord,
  // not the impersonating admin — subscription lives on the PM).
  await syncSubscriptionAmount(ctx.landlordId).catch(() => {});

  return NextResponse.json({ success: true });
}

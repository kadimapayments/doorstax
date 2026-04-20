import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveApiLandlord } from "@/lib/api-landlord";
import { createUnitSchema } from "@/lib/validations/property";
import { z } from "zod";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await resolveApiLandlord();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const property = await db.property.findFirst({
    where: { id, landlordId: ctx.landlordId },
  });
  if (!property) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const units = await db.unit.findMany({
    where: { propertyId: id },
    include: {
      tenantProfiles: {
        include: { user: { select: { name: true, email: true } } },
      },
    },
    orderBy: { unitNumber: "asc" },
  });

  return NextResponse.json(units);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await resolveApiLandlord();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const property = await db.property.findFirst({
    where: { id, landlordId: ctx.landlordId },
  });
  if (!property) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const data = createUnitSchema.parse(body);

    const unit = await db.unit.create({
      data: {
        ...data,
        propertyId: id,
      },
    });

    // Check if creating this unit triggered a tier crossing for the landlord
    try {
      const { checkTierCrossing } = await import("@/lib/residual-tiers");
      const crossing = await checkTierCrossing(ctx.landlordId);
      if (crossing) {
        const { notifyTierCrossing } = await import(
          "@/lib/tier-notifications"
        );
        notifyTierCrossing(ctx.landlordId, crossing).catch((e) =>
          console.error("[units] Tier notification failed:", e)
        );
      }
    } catch {}

    return NextResponse.json(unit, { status: 201 });
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

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("propertyId") || undefined;

    const lots = await db.parkingLot.findMany({
      where: {
        property: { landlordId: session.user.id },
        ...(propertyId ? { propertyId } : {}),
      },
      include: {
        property: { select: { id: true, name: true } },
        spaces: {
          include: {
            assignments: {
              where: { status: "ACTIVE" },
              select: {
                id: true,
                isIncluded: true,
                monthlyCharge: true,
              },
            },
          },
        },
      },
      orderBy: [{ property: { name: "asc" } }, { name: "asc" }],
    });

    const enriched = lots.map((lot) => {
      const assignedSpaces = lot.spaces.filter(
        (s) => s.assignments.length > 0
      ).length;
      const revenue = lot.spaces.reduce(
        (sum, s) =>
          sum +
          s.assignments.reduce((ss, a) => ss + (a.isIncluded ? 0 : a.monthlyCharge), 0),
        0
      );
      return {
        id: lot.id,
        name: lot.name,
        type: lot.type,
        totalSpaces: lot.totalSpaces,
        description: lot.description,
        isActive: lot.isActive,
        property: lot.property,
        assignedSpaces,
        availableSpaces: lot.spaces.length - assignedSpaces,
        activeSpaceCount: lot.spaces.length,
        monthlyRevenue: revenue,
      };
    });

    return NextResponse.json(enriched);
  } catch (err) {
    console.error("[parking/lots] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch lots" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { propertyId, name, type, totalSpaces, description, defaultRate } = body;

    if (!propertyId || !name || !totalSpaces) {
      return NextResponse.json(
        { error: "propertyId, name, and totalSpaces are required" },
        { status: 400 }
      );
    }

    const property = await db.property.findFirst({
      where: { id: propertyId, landlordId: session.user.id },
      select: { id: true },
    });
    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const total = Number(totalSpaces);
    const rate = Number(defaultRate) || 0;

    const lot = await db.parkingLot.create({
      data: {
        propertyId,
        name,
        type: type || "SURFACE",
        totalSpaces: total,
        description: description || null,
        spaces: {
          create: Array.from({ length: total }, (_, i) => ({
            number: String(i + 1),
            type: "STANDARD",
            monthlyRate: rate,
          })),
        },
      },
      include: { spaces: true },
    });

    return NextResponse.json(lot, { status: 201 });
  } catch (err) {
    console.error("[parking/lots] POST error:", err);
    return NextResponse.json({ error: "Failed to create lot" }, { status: 500 });
  }
}

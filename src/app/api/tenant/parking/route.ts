import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "TENANT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await db.tenantProfile.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!profile) {
      return NextResponse.json({ assignments: [] });
    }

    const assignments = await db.parkingAssignment.findMany({
      where: {
        tenantId: profile.id,
        status: "ACTIVE",
      },
      include: {
        space: {
          include: {
            lot: {
              select: {
                id: true,
                name: true,
                type: true,
                address: true,
                property: { select: { name: true, address: true } },
              },
            },
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    });

    return NextResponse.json({
      assignments: assignments.map((a) => ({
        id: a.id,
        spaceNumber: a.space.number,
        spaceType: a.space.type,
        spaceLevel: a.space.level,
        spaceLocation: a.space.location,
        lotName: a.space.lot.name,
        lotType: a.space.lot.type,
        propertyName: a.space.lot.property.name,
        vehicleMake: a.vehicleMake,
        vehicleModel: a.vehicleModel,
        vehicleYear: a.vehicleYear,
        vehicleColor: a.vehicleColor,
        licensePlate: a.licensePlate,
        licensePlateState: a.licensePlateState,
        isIncluded: a.isIncluded,
        monthlyCharge: a.monthlyCharge,
        assignedAt: a.assignedAt,
        expiresAt: a.expiresAt,
      })),
    });
  } catch (err) {
    console.error("[tenant/parking] error:", err);
    return NextResponse.json({ error: "Failed to fetch parking" }, { status: 500 });
  }
}

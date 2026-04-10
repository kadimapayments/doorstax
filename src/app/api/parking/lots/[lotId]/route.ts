import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function verifyOwnership(lotId: string, userId: string) {
  return db.parkingLot.findFirst({
    where: { id: lotId, property: { landlordId: userId } },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lotId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { lotId } = await params;
    const lot = await verifyOwnership(lotId, session.user.id);
    if (!lot) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const full = await db.parkingLot.findUnique({
      where: { id: lotId },
      include: {
        property: { select: { name: true } },
        spaces: {
          orderBy: [{ level: "asc" }, { number: "asc" }],
          include: {
            assignments: {
              where: { status: "ACTIVE" },
              include: {
                tenant: { include: { user: { select: { name: true } } } },
                unit: { select: { unitNumber: true } },
              },
            },
          },
        },
      },
    });

    return NextResponse.json(full);
  } catch (err) {
    console.error("[parking/lots/:id] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch lot" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ lotId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { lotId } = await params;
    const lot = await verifyOwnership(lotId, session.user.id);
    if (!lot) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const updated = await db.parkingLot.update({
      where: { id: lotId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.description !== undefined && {
          description: body.description || null,
        }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[parking/lots/:id] PUT error:", err);
    return NextResponse.json({ error: "Failed to update lot" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ lotId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { lotId } = await params;
    const lot = await verifyOwnership(lotId, session.user.id);
    if (!lot) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const activeAssignments = await db.parkingAssignment.count({
      where: { space: { lotId }, status: "ACTIVE" },
    });
    if (activeAssignments > 0) {
      return NextResponse.json(
        { error: "Cannot delete lot with active assignments" },
        { status: 400 }
      );
    }

    await db.parkingLot.update({
      where: { id: lotId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[parking/lots/:id] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete lot" }, { status: 500 });
  }
}

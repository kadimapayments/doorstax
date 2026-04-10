import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function verifyOwnership(spaceId: string, userId: string) {
  return db.parkingSpace.findFirst({
    where: {
      id: spaceId,
      lot: { property: { landlordId: userId } },
    },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { spaceId } = await params;
    const space = await verifyOwnership(spaceId, session.user.id);
    if (!space) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const full = await db.parkingSpace.findUnique({
      where: { id: spaceId },
      include: {
        lot: { select: { id: true, name: true, type: true } },
        assignments: {
          where: { status: "ACTIVE" },
          include: {
            tenant: { include: { user: { select: { name: true, email: true } } } },
            unit: { select: { unitNumber: true } },
          },
        },
      },
    });

    return NextResponse.json(full);
  } catch (err) {
    console.error("[parking/spaces/:id] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch space" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { spaceId } = await params;
    const space = await verifyOwnership(spaceId, session.user.id);
    if (!space) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const updated = await db.parkingSpace.update({
      where: { id: spaceId },
      data: {
        ...(body.number !== undefined && { number: body.number }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.level !== undefined && { level: body.level || null }),
        ...(body.location !== undefined && { location: body.location || null }),
        ...(body.monthlyRate !== undefined && {
          monthlyRate: Number(body.monthlyRate),
        }),
        ...(body.isAssignable !== undefined && {
          isAssignable: body.isAssignable,
        }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.notes !== undefined && { notes: body.notes || null }),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[parking/spaces/:id] PUT error:", err);
    return NextResponse.json({ error: "Failed to update space" }, { status: 500 });
  }
}

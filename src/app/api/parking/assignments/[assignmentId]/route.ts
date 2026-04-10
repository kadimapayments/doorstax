import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function verifyOwnership(assignmentId: string, userId: string) {
  return db.parkingAssignment.findFirst({
    where: {
      id: assignmentId,
      space: { lot: { property: { landlordId: userId } } },
    },
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { assignmentId } = await params;
    const existing = await verifyOwnership(assignmentId, session.user.id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const updated = await db.parkingAssignment.update({
      where: { id: assignmentId },
      data: {
        ...(body.vehicleMake !== undefined && { vehicleMake: body.vehicleMake || null }),
        ...(body.vehicleModel !== undefined && { vehicleModel: body.vehicleModel || null }),
        ...(body.vehicleYear !== undefined && { vehicleYear: body.vehicleYear || null }),
        ...(body.vehicleColor !== undefined && { vehicleColor: body.vehicleColor || null }),
        ...(body.licensePlate !== undefined && { licensePlate: body.licensePlate || null }),
        ...(body.licensePlateState !== undefined && { licensePlateState: body.licensePlateState || null }),
        ...(body.monthlyCharge !== undefined && { monthlyCharge: Number(body.monthlyCharge) }),
        ...(body.isIncluded !== undefined && { isIncluded: body.isIncluded }),
        ...(body.expiresAt !== undefined && {
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.notes !== undefined && { notes: body.notes || null }),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[parking/assignments/:id] PUT error:", err);
    return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { assignmentId } = await params;
    const existing = await verifyOwnership(assignmentId, session.user.id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    if (body.action === "revoke") {
      await db.parkingAssignment.update({
        where: { id: assignmentId },
        data: { status: "REVOKED" },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[parking/assignments/:id] POST error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

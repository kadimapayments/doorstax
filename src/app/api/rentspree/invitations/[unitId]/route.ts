import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ unitId: string }> }
) {
  try {
    const session = await auth();
    if (
      !session?.user?.id ||
      (session.user.role !== "PM" && session.user.role !== "ADMIN")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { unitId } = await params;

    // Verify PM owns this unit
    const unit = await db.unit.findFirst({
      where: {
        id: unitId,
        property: { landlordId: session.user.id },
      },
      select: { id: true },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const invitations = await db.screeningInvitation.findMany({
      where: { unitId },
      orderBy: { sentAt: "desc" },
      select: {
        id: true,
        email: true,
        sentAt: true,
        status: true,
        applyLink: true,
      },
    });

    return NextResponse.json(invitations);
  } catch (err) {
    console.error("[rentspree/invitations] GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch invitations" },
      { status: 500 }
    );
  }
}

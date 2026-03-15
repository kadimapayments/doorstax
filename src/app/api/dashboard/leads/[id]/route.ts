import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Verify lead exists and is assigned to this PM
    const lead = await db.lead.findUnique({ where: { id } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (lead.assignedToId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { status, notes } = body;

    const data: Record<string, unknown> = {};
    if (status !== undefined) data.status = status;
    if (notes !== undefined) data.notes = notes;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const updated = await db.lead.update({
      where: { id },
      data,
      include: {
        _count: { select: { activities: true } },
      },
    });

    // Log status change activity
    if (status !== undefined && status !== lead.status) {
      await db.leadActivity.create({
        data: {
          leadId: id,
          userId: session.user.id,
          type: "status_change",
          content: `Status changed from ${lead.status} to ${status}`,
          metadata: { oldStatus: lead.status, newStatus: status },
        },
      });
    }

    // Log notes update
    if (notes !== undefined && notes !== lead.notes) {
      await db.leadActivity.create({
        data: {
          leadId: id,
          userId: session.user.id,
          type: "note",
          content: notes,
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/dashboard/leads/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";

/**
 * POST /api/dashboard/leads/[id]/activity — PM adds a note to a lead.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole("PM");
    const { id } = await params;

    const lead = await db.lead.findUnique({ where: { id } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const body = await req.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Note content is required" },
        { status: 400 }
      );
    }

    const activity = await db.leadActivity.create({
      data: {
        leadId: id,
        userId: user.id,
        type: "note",
        content: content.trim(),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error("POST /api/dashboard/leads/[id]/activity error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

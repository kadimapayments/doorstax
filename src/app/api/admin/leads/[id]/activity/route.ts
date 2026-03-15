import { NextRequest, NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAdminPermission("admin:leads");
    const { id } = await params;

    // Verify lead exists
    const lead = await db.lead.findUnique({ where: { id } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const body = await req.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "Content is required" },
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
    console.error("POST /api/admin/leads/[id]/activity error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

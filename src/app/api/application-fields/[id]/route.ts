import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const field = await db.applicationField.findFirst({
      where: { id, pmId: session.user.id },
    });
    if (!field) {
      return NextResponse.json({ error: "Field not found" }, { status: 404 });
    }

    const body = await req.json();
    const updated = await db.applicationField.update({
      where: { id },
      data: {
        ...(body.label !== undefined && { label: body.label }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.options !== undefined && { options: Array.isArray(body.options) ? body.options : [] }),
        ...(body.required !== undefined && { required: body.required === true }),
        ...(body.enabled !== undefined && { enabled: body.enabled === true }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
        ...(body.section !== undefined && { section: body.section }),
        ...(body.placeholder !== undefined && { placeholder: body.placeholder || null }),
        ...(body.helpText !== undefined && { helpText: body.helpText || null }),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[application-fields/:id] PUT error:", err);
    return NextResponse.json({ error: "Failed to update field" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const field = await db.applicationField.findFirst({
      where: { id, pmId: session.user.id },
    });
    if (!field) {
      return NextResponse.json({ error: "Field not found" }, { status: 404 });
    }

    // Delete associated answers first, then the field
    await db.applicationFieldAnswer.deleteMany({ where: { fieldId: id } });
    await db.applicationField.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[application-fields/:id] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete field" }, { status: 500 });
  }
}

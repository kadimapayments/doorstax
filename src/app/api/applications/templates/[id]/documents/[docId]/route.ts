import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function verifyOwnership(
  templateId: string,
  docId: string,
  userId: string
) {
  const doc = await db.applicationDocumentRequirement.findFirst({
    where: {
      id: docId,
      templateId,
      template: { landlordId: userId },
    },
  });
  return doc;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "PM") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, docId } = await params;
    const existing = await verifyOwnership(id, docId, session.user.id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const updated = await db.applicationDocumentRequirement.update({
      where: { id: docId },
      data: {
        ...(body.label !== undefined && { label: body.label }),
        ...(body.description !== undefined && {
          description: body.description || null,
        }),
        ...(body.required !== undefined && { required: body.required === true }),
        ...(body.enabled !== undefined && { enabled: body.enabled === true }),
        ...(body.acceptedTypes !== undefined && {
          acceptedTypes: Array.isArray(body.acceptedTypes)
            ? body.acceptedTypes
            : existing.acceptedTypes,
        }),
        ...(body.maxFileSizeMb !== undefined && {
          maxFileSizeMb: Number(body.maxFileSizeMb),
        }),
        ...(body.sortOrder !== undefined && {
          sortOrder: Number(body.sortOrder),
        }),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[templates/:id/documents/:docId] PUT error:", err);
    return NextResponse.json(
      { error: "Failed to update requirement" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "PM") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, docId } = await params;
    const existing = await verifyOwnership(id, docId, session.user.id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.applicationDocumentRequirement.delete({ where: { id: docId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[templates/:id/documents/:docId] DELETE error:", err);
    return NextResponse.json(
      { error: "Failed to delete requirement" },
      { status: 500 }
    );
  }
}

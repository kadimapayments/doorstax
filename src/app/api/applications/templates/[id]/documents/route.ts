import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { seedDefaultDocumentRequirements } from "@/lib/default-document-requirements";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "PM") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const template = await db.applicationTemplate.findFirst({
      where: { id, landlordId: session.user.id },
      select: { id: true },
    });
    if (!template) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Auto-seed defaults if none exist
    await seedDefaultDocumentRequirements(id);

    const requirements = await db.applicationDocumentRequirement.findMany({
      where: { templateId: id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(requirements);
  } catch (err) {
    console.error("[templates/:id/documents] GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch requirements" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "PM") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const template = await db.applicationTemplate.findFirst({
      where: { id, landlordId: session.user.id },
      select: { id: true },
    });
    if (!template) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      label,
      description,
      required,
      acceptedTypes,
      maxFileSizeMb,
    } = body;

    if (!label || !label.trim()) {
      return NextResponse.json(
        { error: "Label is required" },
        { status: 400 }
      );
    }

    const max = await db.applicationDocumentRequirement.aggregate({
      where: { templateId: id },
      _max: { sortOrder: true },
    });

    const created = await db.applicationDocumentRequirement.create({
      data: {
        templateId: id,
        label,
        description: description || null,
        required: required !== false,
        acceptedTypes: Array.isArray(acceptedTypes)
          ? acceptedTypes
          : ["image/jpeg", "image/png", "application/pdf"],
        maxFileSizeMb: Number(maxFileSizeMb) || 10,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("[templates/:id/documents] POST error:", err);
    return NextResponse.json(
      { error: "Failed to create requirement" },
      { status: 500 }
    );
  }
}

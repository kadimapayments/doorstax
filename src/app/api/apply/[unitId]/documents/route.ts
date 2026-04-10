import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedDefaultDocumentRequirements } from "@/lib/default-document-requirements";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ unitId: string }> }
) {
  try {
    const { unitId } = await params;

    const unit = await db.unit.findUnique({
      where: { id: unitId },
      select: {
        id: true,
        applicationTemplateId: true,
        property: {
          select: {
            landlordId: true,
            applicationTemplateId: true,
          },
        },
      },
    });

    if (!unit || !unit.property) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Resolve template: unit → property → PM's first template
    let templateId =
      unit.applicationTemplateId || unit.property.applicationTemplateId;

    if (!templateId) {
      const firstTemplate = await db.applicationTemplate.findFirst({
        where: { landlordId: unit.property.landlordId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      templateId = firstTemplate?.id || null;
    }

    if (!templateId) {
      return NextResponse.json({ requirements: [] });
    }

    // Auto-seed defaults if none exist
    await seedDefaultDocumentRequirements(templateId);

    const requirements = await db.applicationDocumentRequirement.findMany({
      where: { templateId, enabled: true },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ requirements });
  } catch (err) {
    console.error("[apply/:unitId/documents] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch document requirements" },
      { status: 500 }
    );
  }
}

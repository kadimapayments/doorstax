import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { put } from "@vercel/blob";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ unitId: string }> }
) {
  try {
    const { unitId } = await params;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const requirementId = formData.get("requirementId") as string | null;
    const email = formData.get("email") as string | null;

    if (!file || !requirementId) {
      return NextResponse.json(
        { error: "file and requirementId are required" },
        { status: 400 }
      );
    }

    // Validate unit exists
    const unit = await db.unit.findUnique({
      where: { id: unitId },
      select: { id: true },
    });
    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Validate requirement exists
    const requirement = await db.applicationDocumentRequirement.findUnique({
      where: { id: requirementId },
    });
    if (!requirement) {
      return NextResponse.json(
        { error: "Invalid document requirement" },
        { status: 400 }
      );
    }

    // Validate file type
    if (
      requirement.acceptedTypes.length > 0 &&
      !requirement.acceptedTypes.includes(file.type)
    ) {
      return NextResponse.json(
        {
          error: `Invalid file type. Accepted: ${requirement.acceptedTypes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate file size
    const fileSizeMb = file.size / (1024 * 1024);
    if (fileSizeMb > requirement.maxFileSizeMb) {
      return NextResponse.json(
        {
          error: `File too large. Max size: ${requirement.maxFileSizeMb} MB`,
        },
        { status: 400 }
      );
    }

    // Upload to Vercel Blob
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const blobPath = `applications/${unitId}/${Date.now()}-${safeFileName}`;

    const blob = await put(blobPath, file, {
      access: "public",
      contentType: file.type,
    });

    // Create upload record (not yet linked to application)
    const upload = await db.applicationDocumentUpload.create({
      data: {
        requirementId,
        email: email || null,
        unitId,
        fileName: file.name,
        fileUrl: blob.url,
        fileType: file.type,
        fileSizeMb,
      },
    });

    return NextResponse.json({
      id: upload.id,
      fileName: upload.fileName,
      fileUrl: upload.fileUrl,
      fileSizeMb: upload.fileSizeMb,
      uploadedAt: upload.uploadedAt,
    });
  } catch (err) {
    console.error("[apply/:unitId/upload] error:", err);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}

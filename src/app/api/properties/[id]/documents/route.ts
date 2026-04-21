import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { db } from "@/lib/db";
import { resolveApiLandlord } from "@/lib/api-landlord";

/**
 * Property documents — plans, permits, certificates of occupancy, insurance
 * declarations, appraisals, etc. Uploaded as part of the /dashboard/properties/new
 * wizard and surfaced in the admin underwriter review + the branded profile PDF.
 *
 * GET    /api/properties/[id]/documents            — list all docs on a property
 * POST   /api/properties/[id]/documents            — multipart file upload
 * DELETE /api/properties/[id]/documents?docId=...  — remove one doc (Blob + row)
 *
 * 25 MB cap per file — architectural plans run big. Accepts PDF and common
 * image types (HEIC included for iPhone photos of permits).
 */

const ACCEPTED_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const VALID_TYPES = [
  "PLAN",
  "PERMIT",
  "CERTIFICATE",
  "INSURANCE",
  "APPRAISAL",
  "TAX_BILL",
  "DEED",
  "MORTGAGE",
  "OTHER",
] as const;

type DocType = (typeof VALID_TYPES)[number];

async function getAuthedProperty(
  propertyId: string
): Promise<
  | { ok: true; ctx: NonNullable<Awaited<ReturnType<typeof resolveApiLandlord>>> }
  | { ok: false; status: number; error: string }
> {
  const ctx = await resolveApiLandlord();
  if (!ctx) return { ok: false, status: 401, error: "Unauthorized" };

  const property = await db.property.findFirst({
    where: { id: propertyId, landlordId: ctx.landlordId },
    select: { id: true },
  });
  if (!property) return { ok: false, status: 404, error: "Property not found" };

  return { ok: true, ctx };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await getAuthedProperty(id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const documents = await db.propertyDocument.findMany({
    where: { propertyId: id },
    orderBy: { uploadedAt: "desc" },
  });

  return NextResponse.json({ documents });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await getAuthedProperty(id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const rawType = (formData.get("type") as string | null) || "OTHER";
    const label = (formData.get("label") as string | null) || null;

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    if (!VALID_TYPES.includes(rawType as DocType)) {
      return NextResponse.json(
        { error: `Invalid type. Valid: ${VALID_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    const type: DocType = rawType as DocType;

    if (!ACCEPTED_MIMES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large (25 MB max)" },
        { status: 400 }
      );
    }

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const blobPath = `property-docs/${id}/${type}/${Date.now()}-${safeFileName}`;

    let blob;
    try {
      blob = await put(blobPath, file, {
        access: "public",
        contentType: file.type,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
    } catch (blobErr) {
      // Common sandbox / misconfig issue: the Vercel Blob store attached
      // to this deployment is set to *private* access, which `put()` in
      // @vercel/blob does not currently support. Surface it as a real
      // message so ops can fix it in the Vercel dashboard
      // (Storage → the Blob store → Settings → Access → Public).
      const msg = blobErr instanceof Error ? blobErr.message : String(blobErr);
      console.error("[properties/documents] blob put failed:", msg);
      if (/private\s+store|private\s+access/i.test(msg)) {
        return NextResponse.json(
          {
            error:
              "This environment's Blob store is set to private — DoorStax document uploads require a public Blob store. An admin needs to flip the store to Public in Vercel Storage settings.",
          },
          { status: 500 }
        );
      }
      if (/token/i.test(msg)) {
        return NextResponse.json(
          { error: "Blob storage is not configured (missing BLOB_READ_WRITE_TOKEN)." },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: `Upload rejected by storage: ${msg}` },
        { status: 502 }
      );
    }

    const document = await db.propertyDocument.create({
      data: {
        propertyId: id,
        uploadedById: auth.ctx.actorId,
        fileName: file.name,
        fileUrl: blob.url,
        fileSize: file.size,
        mimeType: file.type,
        type,
        label: label?.trim() || null,
      },
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {
    console.error("[properties/documents] upload error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Upload failed for an unknown reason",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await getAuthedProperty(id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const docId = req.nextUrl.searchParams.get("docId");
  if (!docId) {
    return NextResponse.json({ error: "docId is required" }, { status: 400 });
  }

  const document = await db.propertyDocument.findFirst({
    where: { id: docId, propertyId: id },
  });
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Best-effort blob delete — if it fails we still remove the DB row so
  // the UI isn't stuck showing a phantom file.
  try {
    await del(document.fileUrl, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
  } catch (err) {
    console.error("[properties/documents] blob delete failed:", err);
  }

  await db.propertyDocument.delete({ where: { id: docId } });

  return NextResponse.json({ ok: true });
}

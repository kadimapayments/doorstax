import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";

/**
 * Tenant documents — applications, IDs, income verification, renters
 * insurance, leases, etc. Used by the PM from the tenant profile page.
 *
 * GET    /api/tenants/[id]/documents             — list
 * POST   /api/tenants/[id]/documents             — create (two content types):
 *        (a) multipart/form-data with a `file` field → uploads to Vercel
 *            Blob + writes a TenantDocument row in one call.
 *        (b) application/json with `{ name, type, url, ... }` → writes a
 *            row that points to a pre-uploaded URL (legacy behavior,
 *            retained so /api/apply/... can still hand us a URL directly).
 * DELETE /api/tenants/[id]/documents?docId=...   — removes a row (and
 *        attempts to purge the Blob if the URL lives on ours).
 *
 * Mirrors the convention from /api/properties/[id]/documents/route.ts so
 * the two upload surfaces feel identical.
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
  "APPLICATION",
  "ID",
  "INCOME",
  "BANK_STATEMENT",
  "RENTERS_INSURANCE",
  "LEASE",
  "OTHER",
] as const;

type TenantDocType = (typeof VALID_TYPES)[number];

async function getAuthedTenant(
  tenantProfileId: string
): Promise<
  | { ok: true; landlordId: string }
  | { ok: false; status: number; error: string }
> {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const landlordId = await getEffectiveLandlordId(session.user.id);
  const tenant = await db.tenantProfile.findFirst({
    where: { id: tenantProfileId, unit: { property: { landlordId } } },
    select: { id: true },
  });
  if (!tenant) return { ok: false, status: 404, error: "Tenant not found" };
  return { ok: true, landlordId };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuthedTenant(id);
    if (!auth.ok)
      return NextResponse.json({ error: auth.error }, { status: auth.status });

    const documents = await db.tenantDocument.findMany({
      where: { tenantProfileId: id },
      orderBy: { uploadedAt: "desc" },
    });
    return NextResponse.json(documents);
  } catch (err) {
    console.error("[tenants/:id/documents] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuthedTenant(id);
    if (!auth.ok)
      return NextResponse.json({ error: auth.error }, { status: auth.status });

    const contentType = req.headers.get("content-type") || "";

    // ── Multipart: direct file upload ──
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const rawType = (formData.get("type") as string | null) || "OTHER";
      const explicitName = (formData.get("name") as string | null) || null;
      const notes = (formData.get("notes") as string | null) || null;

      if (!file) {
        return NextResponse.json({ error: "file is required" }, { status: 400 });
      }
      if (!VALID_TYPES.includes(rawType as TenantDocType)) {
        return NextResponse.json(
          { error: `Invalid type. Valid: ${VALID_TYPES.join(", ")}` },
          { status: 400 }
        );
      }
      const type: TenantDocType = rawType as TenantDocType;

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
      const blobPath = `tenant-docs/${id}/${type}/${Date.now()}-${safeFileName}`;

      let blob;
      try {
        blob = await put(blobPath, file, {
          access: "public",
          contentType: file.type,
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
      } catch (blobErr) {
        const msg = blobErr instanceof Error ? blobErr.message : String(blobErr);
        console.error("[tenants/:id/documents] blob put failed:", msg);
        if (/private\s+store|private\s+access/i.test(msg)) {
          return NextResponse.json(
            {
              error:
                "This environment's Blob store is set to private — DoorStax document uploads require a public Blob store.",
            },
            { status: 500 }
          );
        }
        return NextResponse.json(
          { error: `Upload rejected by storage: ${msg}` },
          { status: 502 }
        );
      }

      const document = await db.tenantDocument.create({
        data: {
          tenantProfileId: id,
          landlordId: auth.landlordId,
          name: explicitName?.trim() || file.name,
          type,
          url: blob.url,
          fileName: file.name,
          fileType: file.type,
          source: "PM_UPLOAD",
          notes: notes?.trim() || null,
        },
      });

      return NextResponse.json(document, { status: 201 });
    }

    // ── JSON: legacy pre-uploaded-URL flow (retained for
    // /api/apply/... and any other integrations that pass a URL) ──
    const body = await req.json();
    const { name, type, url, fileName, fileType } = body as {
      name?: string;
      type?: string;
      url?: string;
      fileName?: string;
      fileType?: string;
    };

    if (!name || !url) {
      return NextResponse.json(
        { error: "name and url are required" },
        { status: 400 }
      );
    }

    const doc = await db.tenantDocument.create({
      data: {
        tenantProfileId: id,
        landlordId: auth.landlordId,
        name,
        type: type || "OTHER",
        url,
        fileName: fileName || null,
        fileType: fileType || null,
        source: "PM_UPLOAD",
      },
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error("[tenants/:id/documents] POST error:", err);
    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuthedTenant(id);
    if (!auth.ok)
      return NextResponse.json({ error: auth.error }, { status: auth.status });

    const docId = req.nextUrl.searchParams.get("docId");
    if (!docId) {
      return NextResponse.json({ error: "docId is required" }, { status: 400 });
    }

    const document = await db.tenantDocument.findFirst({
      where: { id: docId, tenantProfileId: id },
    });
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Best-effort blob cleanup — if the URL isn't one of ours or Blob
    // rejects, we still drop the DB row so the UI isn't stuck.
    try {
      await del(document.url, {
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
    } catch (err) {
      console.error("[tenants/:id/documents] blob delete failed:", err);
    }

    await db.tenantDocument.delete({ where: { id: docId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[tenants/:id/documents] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}

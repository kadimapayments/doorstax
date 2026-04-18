export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { put } from "@vercel/blob";

const ALLOWED_TYPES = ["W9", "ID", "CONTRACT", "TAX_FORM", "OTHER"] as const;
const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
];
const MAX_SIZE_MB = 10;

/**
 * Partner (agent) self-serve document endpoint.
 *
 * GET  — list this agent's uploaded documents
 * POST — upload a new document (multipart: file, type, name?)
 *        When type === "W9", flips w9Status to RECEIVED.
 */

async function requirePartnerProfile() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PARTNER") {
    return { error: "Unauthorized", status: 401 as const };
  }
  const profile = await db.agentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) {
    return { error: "No agent profile for this user", status: 404 as const };
  }
  return { userId: session.user.id, profileId: profile.id };
}

export async function GET() {
  const gate = await requirePartnerProfile();
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const [profile, docs] = await Promise.all([
    db.agentProfile.findUnique({
      where: { id: gate.profileId },
      select: {
        agentId: true,
        w9Status: true,
        w9RequestedAt: true,
        w9ReceivedAt: true,
      },
    }),
    db.agentDocument.findMany({
      where: { agentProfileId: gate.profileId },
      orderBy: { uploadedAt: "desc" },
    }),
  ]);

  return NextResponse.json({ profile, documents: docs });
}

export async function POST(req: NextRequest) {
  const gate = await requirePartnerProfile();
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const docType = String(formData.get("type") || "OTHER").toUpperCase();
  const docName = String(formData.get("name") || file?.name || "Document");

  if (!file) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(docType as (typeof ALLOWED_TYPES)[number])) {
    return NextResponse.json(
      { error: "Invalid document type" },
      { status: 400 }
    );
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json(
      { error: "Only PDF, JPEG, PNG, and HEIC files are allowed" },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: `File must be under ${MAX_SIZE_MB}MB` },
      { status: 400 }
    );
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const blobPath = `agents/${gate.userId}/${Date.now()}-${safeName}`;

  const blob = await put(blobPath, file, {
    access: "public",
    contentType: file.type,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  const doc = await db.agentDocument.create({
    data: {
      agentProfileId: gate.profileId,
      name: docName,
      type: docType,
      url: blob.url,
      fileName: file.name,
      fileType: file.type,
      fileSizeMb: file.size / (1024 * 1024),
    },
  });

  // Auto-flip W9 status when the W9 is uploaded
  if (docType === "W9") {
    await db.agentProfile.update({
      where: { id: gate.profileId },
      data: { w9Status: "RECEIVED", w9ReceivedAt: new Date() },
    });
  }

  return NextResponse.json({ document: doc }, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";
import { put } from "@vercel/blob";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:staff")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const profile = await db.agentProfile.findUnique({
    where: { userId: id },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "No agent profile" }, { status: 404 });
  }

  const docs = await db.agentDocument.findMany({
    where: { agentProfileId: profile.id },
    orderBy: { uploadedAt: "desc" },
  });

  return NextResponse.json({ documents: docs });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:staff")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const profile = await db.agentProfile.findUnique({
    where: { userId: id },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "No agent profile" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const docType = (formData.get("type") as string) || "OTHER";
  const docName = (formData.get("name") as string) || file?.name || "Document";

  if (!file) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const blobPath = `agents/${id}/${Date.now()}-${safeName}`;

  const blob = await put(blobPath, file, {
    access: "public",
    contentType: file.type,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  const doc = await db.agentDocument.create({
    data: {
      agentProfileId: profile.id,
      name: docName,
      type: docType,
      url: blob.url,
      fileName: file.name,
      fileType: file.type,
      fileSizeMb: file.size / (1024 * 1024),
    },
  });

  // If W9 uploaded, update profile status
  if (docType === "W9") {
    await db.agentProfile.update({
      where: { id: profile.id },
      data: { w9Status: "RECEIVED", w9ReceivedAt: new Date() },
    });
  }

  return NextResponse.json({ document: doc });
}

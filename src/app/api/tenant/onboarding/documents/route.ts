import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const documentSchema = z.object({
  type: z.enum(["ID", "RENTERS_INSURANCE", "OTHER"]),
  name: z.string().min(1),
  url: z.string().url(),
});

/** GET /api/tenant/onboarding/documents — list tenant's uploaded documents */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.tenantProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const docs = await db.tenantDocument.findMany({
    where: { tenantProfileId: profile.id },
    orderBy: { uploadedAt: "desc" },
  });

  return NextResponse.json(
    docs.map((d) => ({
      id: d.id,
      type: d.type,
      name: d.name,
      url: d.url,
      uploadedAt: d.uploadedAt.toISOString(),
      verified: !!d.verifiedAt,
    }))
  );
}

/** POST /api/tenant/onboarding/documents — save document metadata */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.tenantProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      unit: { select: { property: { select: { landlordId: true } } } },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = documentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors.map((e) => e.message).join(", ") },
      { status: 400 }
    );
  }

  const landlordId = profile.unit?.property?.landlordId || "";

  const doc = await db.tenantDocument.create({
    data: {
      tenantProfileId: profile.id,
      landlordId,
      type: parsed.data.type,
      name: parsed.data.name,
      url: parsed.data.url,
    },
  });

  return NextResponse.json(
    {
      id: doc.id,
      type: doc.type,
      name: doc.name,
      url: doc.url,
      uploadedAt: doc.uploadedAt.toISOString(),
      verified: false,
    },
    { status: 201 }
  );
}

/** DELETE /api/tenant/onboarding/documents — remove a document */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.tenantProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "Missing document id" }, { status: 400 });
  }

  const doc = await db.tenantDocument.findFirst({
    where: { id, tenantProfileId: profile.id },
  });

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Don't allow deletion of verified documents
  if (doc.verifiedAt) {
    return NextResponse.json(
      { error: "Cannot delete verified documents" },
      { status: 400 }
    );
  }

  await db.tenantDocument.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

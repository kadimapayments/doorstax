import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "PM") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const landlordId = await getEffectiveLandlordId(session.user.id);
    const { id } = await params;

    const tenant = await db.tenantProfile.findFirst({
      where: { id, unit: { property: { landlordId } } },
      select: { id: true },
    });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

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
    const session = await auth();
    if (!session?.user || session.user.role !== "PM") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const landlordId = await getEffectiveLandlordId(session.user.id);
    const { id } = await params;

    const tenant = await db.tenantProfile.findFirst({
      where: { id, unit: { property: { landlordId } } },
      select: { id: true },
    });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, type, url, fileName, fileType } = body;

    if (!name || !url) {
      return NextResponse.json(
        { error: "name and url are required" },
        { status: 400 }
      );
    }

    const doc = await db.tenantDocument.create({
      data: {
        tenantProfileId: id,
        landlordId,
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
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 });
  }
}

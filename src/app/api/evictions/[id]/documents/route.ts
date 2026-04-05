import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["PM", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const landlordId = await getEffectiveLandlordId(session.user.id);
  const body = await req.json();

  const eviction = await db.eviction.findFirst({ where: { id, landlordId } });
  if (!eviction) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const doc = await db.evictionDocument.create({
    data: {
      evictionId: id,
      name: body.name,
      url: body.url,
      type: body.type || "OTHER",
      uploadedBy: session.user.id,
    },
  });

  await db.evictionEvent.create({
    data: {
      evictionId: id,
      type: "DOCUMENT_ADDED",
      title: `Document uploaded: ${body.name}`,
      description: `Type: ${body.type || "Other"}`,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json(doc, { status: 201 });
}

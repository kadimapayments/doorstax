import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";

export async function GET() {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const landlordId = await getEffectiveLandlordId(session.user.id);
  const inspections = await db.inspection.findMany({
    where: { property: { landlordId } },
    include: {
      property: { select: { name: true } },
      unit: { select: { unitNumber: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(inspections);
}

export async function POST(req: Request) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const inspection = await db.inspection.create({
    data: {
      propertyId: body.propertyId,
      unitId: body.unitId || null,
      type: body.type,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(inspection, { status: 201 });
}

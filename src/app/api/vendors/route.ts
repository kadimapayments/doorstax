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
  const vendors = await db.vendor.findMany({
    where: { landlordId },
    include: { tickets: { select: { id: true, status: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(vendors);
}

export async function POST(req: Request) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const landlordId = await getEffectiveLandlordId(session.user.id);
  const body = await req.json();
  const vendor = await db.vendor.create({
    data: {
      landlordId,
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      company: body.company || null,
      category: body.category || "GENERAL",
      notes: body.notes || null,
    },
  });
  return NextResponse.json(vendor, { status: 201 });
}

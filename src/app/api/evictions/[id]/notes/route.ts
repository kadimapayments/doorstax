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

  const event = await db.evictionEvent.create({
    data: {
      evictionId: id,
      type: "NOTE",
      title: body.title || "Note",
      description: body.description,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json(event, { status: 201 });
}

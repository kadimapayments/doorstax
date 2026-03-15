import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { z } from "zod";

const packetSchema = z.object({
  propertyId: z.string().optional().nullable(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
  attachmentUrls: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

/** GET /api/tenants/welcome-packet — list welcome packets */
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);

  const packets = await db.welcomePacket.findMany({
    where: { landlordId },
    include: {
      property: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(packets);
}

/** POST /api/tenants/welcome-packet — create welcome packet */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const body = await req.json();
  const parsed = packetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors.map((e) => e.message).join(", ") },
      { status: 400 }
    );
  }

  const packet = await db.welcomePacket.create({
    data: {
      landlordId,
      propertyId: parsed.data.propertyId || null,
      subject: parsed.data.subject,
      body: parsed.data.body,
      attachmentUrls: parsed.data.attachmentUrls || [],
      isActive: parsed.data.isActive ?? true,
    },
  });

  return NextResponse.json(packet, { status: 201 });
}

/** PUT /api/tenants/welcome-packet — update welcome packet */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const body = await req.json();
  const { id, ...rest } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing packet id" }, { status: 400 });
  }

  const parsed = packetSchema.partial().safeParse(rest);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors.map((e) => e.message).join(", ") },
      { status: 400 }
    );
  }

  const existing = await db.welcomePacket.findFirst({
    where: { id, landlordId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Packet not found" }, { status: 404 });
  }

  const updated = await db.welcomePacket.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

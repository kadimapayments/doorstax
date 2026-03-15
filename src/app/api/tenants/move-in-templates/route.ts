import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { z } from "zod";

const templateSchema = z.object({
  name: z.string().min(1).max(100),
  items: z.array(
    z.object({
      area: z.string().min(1),
      item: z.string().min(1),
      condition: z.string().default("GOOD"),
      notes: z.string().optional(),
    })
  ),
  isDefault: z.boolean().optional(),
});

/** GET /api/tenants/move-in-templates — list templates */
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);

  const templates = await db.moveInTemplate.findMany({
    where: { landlordId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(templates);
}

/** POST /api/tenants/move-in-templates — create template */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const body = await req.json();
  const parsed = templateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors.map((e) => e.message).join(", ") },
      { status: 400 }
    );
  }

  const { name, items, isDefault } = parsed.data;

  // If setting as default, clear other defaults
  if (isDefault) {
    await db.moveInTemplate.updateMany({
      where: { landlordId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const template = await db.moveInTemplate.create({
    data: {
      landlordId,
      name,
      items,
      isDefault: isDefault ?? false,
    },
  });

  return NextResponse.json(template, { status: 201 });
}

/** PUT /api/tenants/move-in-templates — update template */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const body = await req.json();
  const { id, ...rest } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing template id" }, { status: 400 });
  }

  const parsed = templateSchema.partial().safeParse(rest);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors.map((e) => e.message).join(", ") },
      { status: 400 }
    );
  }

  // Verify ownership
  const existing = await db.moveInTemplate.findFirst({
    where: { id, landlordId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  if (parsed.data.isDefault) {
    await db.moveInTemplate.updateMany({
      where: { landlordId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const updated = await db.moveInTemplate.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

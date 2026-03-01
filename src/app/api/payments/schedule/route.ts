import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const scheduleSchema = z.object({
  tenantId: z.string().min(1),
  unitId: z.string().min(1),
  amount: z.coerce.number().positive(),
  type: z.enum(["RENT", "DEPOSIT", "FEE", "APPLICATION"]).default("RENT"),
  description: z.string().optional(),
  scheduledDate: z.string().min(1),
});

// GET: list scheduled payments
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "LANDLORD") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scheduled = await db.scheduledPayment.findMany({
    where: { landlordId: session.user.id },
    include: {
      tenant: { include: { user: { select: { name: true } } } },
      unit: { select: { unitNumber: true, property: { select: { name: true } } } },
    },
    orderBy: { scheduledDate: "asc" },
  });

  return NextResponse.json(scheduled);
}

// POST: create scheduled payment
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "LANDLORD") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = scheduleSchema.parse(body);

    // Verify landlord owns the unit
    const unit = await db.unit.findFirst({
      where: { id: data.unitId, property: { landlordId: session.user.id } },
    });
    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const scheduled = await db.scheduledPayment.create({
      data: {
        landlordId: session.user.id,
        tenantId: data.tenantId,
        unitId: data.unitId,
        amount: data.amount,
        type: data.type,
        description: data.description,
        scheduledDate: new Date(data.scheduledDate),
      },
    });

    return NextResponse.json(scheduled, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: cancel scheduled payment
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "LANDLORD") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const scheduled = await db.scheduledPayment.findFirst({
    where: { id, landlordId: session.user.id, executed: false },
  });

  if (!scheduled) {
    return NextResponse.json({ error: "Not found or already executed" }, { status: 404 });
  }

  await db.scheduledPayment.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

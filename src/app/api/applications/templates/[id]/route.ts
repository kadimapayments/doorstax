import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const template = await db.applicationTemplate.findFirst({
    where: { id, landlordId: session.user.id },
    include: { _count: { select: { units: true } } },
  });

  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(template);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const template = await db.applicationTemplate.findFirst({
    where: { id, landlordId: session.user.id },
  });
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await req.json();

    // When explicitly setting this template as default, unset others first
    if (body.isDefault === true) {
      await db.applicationTemplate.updateMany({
        where: {
          landlordId: session.user.id,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    const updated = await db.applicationTemplate.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && {
          description: body.description || null,
        }),
        ...(body.fields !== undefined && { fields: body.fields }),
        ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
        ...(body.reminderEnabled !== undefined && {
          reminderEnabled: body.reminderEnabled === true,
        }),
        ...(body.reminderDelayHours !== undefined && {
          reminderDelayHours: Number(body.reminderDelayHours),
        }),
        ...(body.reminderMaxCount !== undefined && {
          reminderMaxCount: Number(body.reminderMaxCount),
        }),
        ...(body.reminderIntervalHours !== undefined && {
          reminderIntervalHours: Number(body.reminderIntervalHours),
        }),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[templates/:id] PUT error:", err);
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const template = await db.applicationTemplate.findFirst({
    where: { id, landlordId: session.user.id },
  });
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Unassign units first
  await db.unit.updateMany({
    where: { applicationTemplateId: id },
    data: { applicationTemplateId: null },
  });

  await db.applicationTemplate.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

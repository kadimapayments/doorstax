import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createTemplateSchema } from "@/lib/validations/template";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await db.applicationTemplate.findMany({
    where: { landlordId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { units: true } } },
  });

  return NextResponse.json(templates);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = createTemplateSchema.parse(body);

    // Auto-set as default if this is the PM's first template
    const existingCount = await db.applicationTemplate.count({
      where: { landlordId: session.user.id },
    });
    const shouldBeDefault = data.isDefault || existingCount === 0;

    // If setting as default, unset any existing defaults
    if (shouldBeDefault) {
      await db.applicationTemplate.updateMany({
        where: { landlordId: session.user.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await db.applicationTemplate.create({
      data: {
        landlordId: session.user.id,
        name: data.name,
        description: data.description,
        fields: data.fields,
        isDefault: shouldBeDefault,
      },
    });

    return NextResponse.json(template, { status: 201 });
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

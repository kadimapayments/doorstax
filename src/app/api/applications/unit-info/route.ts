import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const unitId = searchParams.get("unitId");

  if (!unitId) {
    return NextResponse.json({ error: "unitId is required" }, { status: 400 });
  }

  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: {
      id: true,
      unitNumber: true,
      applicationsEnabled: true,
      property: { select: { name: true } },
      applicationTemplate: {
        select: {
          id: true,
          name: true,
          description: true,
          fields: true,
        },
      },
    },
  });

  if (!unit || !unit.applicationsEnabled) {
    return NextResponse.json(
      { error: "This unit is not accepting applications" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: unit.id,
    unitNumber: unit.unitNumber,
    propertyName: unit.property.name,
    template: unit.applicationTemplate,
  });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureApplicationFields } from "@/lib/application-fields";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ unitId: string }> }
) {
  try {
    const { unitId } = await params;

    const unit = await db.unit.findUnique({
      where: { id: unitId },
      select: {
        id: true,
        unitNumber: true,
        rentAmount: true,
        bedrooms: true,
        bathrooms: true,
        property: {
          select: {
            name: true,
            address: true,
            city: true,
            state: true,
            zip: true,
            landlordId: true,
          },
        },
      },
    });

    if (!unit || !unit.property) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const fields = await ensureApplicationFields(unit.property.landlordId);
    const enabledFields = fields.filter((f) => f.enabled);

    return NextResponse.json({
      unit: {
        id: unit.id,
        unitNumber: unit.unitNumber,
        rent: Number(unit.rentAmount),
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
      },
      property: {
        name: unit.property.name,
        address: unit.property.address,
        city: unit.property.city,
        state: unit.property.state,
        zip: unit.property.zip,
      },
      fields: enabledFields.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        options: f.options,
        required: f.required,
        section: f.section,
        placeholder: f.placeholder,
        helpText: f.helpText,
      })),
    });
  } catch (err) {
    console.error("[apply/:unitId/fields] error:", err);
    return NextResponse.json({ error: "Failed to load application form" }, { status: 500 });
  }
}

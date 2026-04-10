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
        applicationTemplateId: true,
        applicationTemplate: {
          select: { id: true, name: true, fields: true },
        },
        property: {
          select: {
            name: true,
            address: true,
            city: true,
            state: true,
            zip: true,
            landlordId: true,
            applicationTemplateId: true,
            applicationTemplate: {
              select: { id: true, name: true, fields: true },
            },
          },
        },
      },
    });

    if (!unit || !unit.property) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Cascade: Unit template → PM's default template → PM's ApplicationField records
    let resolvedFields: Array<{
      id: string;
      label: string;
      type: string;
      options: string[];
      required: boolean;
      section: string;
      placeholder: string | null;
      helpText: string | null;
    }>;

    if (unit.applicationTemplate && Array.isArray(unit.applicationTemplate.fields)) {
      // Use the assigned template's JSON fields
      const templateFields = unit.applicationTemplate.fields as Array<{
        name: string;
        label: string;
        type: string;
        required?: boolean;
        options?: string[];
        section?: string;
        placeholder?: string;
        helpText?: string;
      }>;
      resolvedFields = templateFields.map((f, i) => ({
        id: `tpl-${i}-${f.name}`,
        label: f.label,
        type: f.type.toUpperCase(),
        options: f.options || [],
        required: f.required ?? false,
        section: (f.section || "CUSTOM").toUpperCase(),
        placeholder: f.placeholder || null,
        helpText: f.helpText || null,
      }));
    } else if (unit.property.applicationTemplate && Array.isArray(unit.property.applicationTemplate.fields)) {
      // Use the property-level template
      const templateFields = unit.property.applicationTemplate.fields as Array<{
        name: string; label: string; type: string; required?: boolean;
        options?: string[]; section?: string; placeholder?: string; helpText?: string;
      }>;
      resolvedFields = templateFields.map((f, i) => ({
        id: `tpl-${i}-${f.name}`,
        label: f.label,
        type: f.type.toUpperCase(),
        options: f.options || [],
        required: f.required ?? false,
        section: (f.section || "CUSTOM").toUpperCase(),
        placeholder: f.placeholder || null,
        helpText: f.helpText || null,
      }));
    } else {
      // Check for PM's default template
      const defaultTemplate = await db.applicationTemplate.findFirst({
        where: { landlordId: unit.property.landlordId, isDefault: true },
        select: { fields: true },
      });

      if (defaultTemplate && Array.isArray(defaultTemplate.fields)) {
        const templateFields = defaultTemplate.fields as Array<{
          name: string;
          label: string;
          type: string;
          required?: boolean;
          options?: string[];
          section?: string;
          placeholder?: string;
          helpText?: string;
        }>;
        resolvedFields = templateFields.map((f, i) => ({
          id: `tpl-${i}-${f.name}`,
          label: f.label,
          type: f.type.toUpperCase(),
          options: f.options || [],
          required: f.required ?? false,
          section: (f.section || "CUSTOM").toUpperCase(),
          placeholder: f.placeholder || null,
          helpText: f.helpText || null,
        }));
      } else {
        // Fall back to PM's ApplicationField records
        const fields = await ensureApplicationFields(unit.property.landlordId);
        resolvedFields = fields
          .filter((f) => f.enabled)
          .map((f) => ({
            id: f.id,
            label: f.label,
            type: f.type,
            options: f.options,
            required: f.required,
            section: f.section,
            placeholder: f.placeholder,
            helpText: f.helpText,
          }));
      }
    }

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
      fields: resolvedFields,
      templateName: unit.applicationTemplate?.name || null,
    });
  } catch (err) {
    console.error("[apply/:unitId/fields] error:", err);
    return NextResponse.json({ error: "Failed to load application form" }, { status: 500 });
  }
}

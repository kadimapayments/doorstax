import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureApplicationFields } from "@/lib/application-fields";

export const dynamic = "force-dynamic";

interface ResolvedField {
  id: string;
  label: string;
  type: string;
  options: string[];
  required: boolean;
  section: string;
  placeholder: string | null;
  helpText: string | null;
}

/**
 * Map a template's JSON fields blob into the shape the apply form expects.
 * Returns null when the blob is not a valid non-empty array of fields,
 * so the cascade can fall through to the next source.
 */
function mapTemplateFields(templateFields: unknown): ResolvedField[] | null {
  if (!Array.isArray(templateFields) || templateFields.length === 0) {
    return null;
  }

  const mapped: ResolvedField[] = [];
  for (let i = 0; i < templateFields.length; i++) {
    const f = templateFields[i] as {
      name?: string;
      label?: string;
      type?: string;
      required?: boolean;
      options?: string[];
      section?: string;
      placeholder?: string;
      helpText?: string;
    };
    if (!f || typeof f !== "object" || !f.label || !f.type) continue;
    mapped.push({
      id: `tpl-${i}-${f.name || f.label.replace(/\s+/g, "_").toLowerCase()}`,
      label: f.label,
      type: String(f.type).toUpperCase(),
      options: Array.isArray(f.options) ? f.options : [],
      required: f.required ?? false,
      section: (f.section || "CUSTOM").toUpperCase(),
      placeholder: f.placeholder || null,
      helpText: f.helpText || null,
    });
  }

  return mapped.length > 0 ? mapped : null;
}

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

    const landlordId = unit.property.landlordId;
    let resolvedFields: ResolvedField[] = [];
    let source = "none";
    let templateName: string | null = null;

    // (a) Unit's assigned template
    if (unit.applicationTemplate) {
      const mapped = mapTemplateFields(unit.applicationTemplate.fields);
      if (mapped) {
        resolvedFields = mapped;
        source = "unit-template";
        templateName = unit.applicationTemplate.name;
      }
    }

    // (b) Property's assigned template
    if (resolvedFields.length === 0 && unit.property.applicationTemplate) {
      const mapped = mapTemplateFields(unit.property.applicationTemplate.fields);
      if (mapped) {
        resolvedFields = mapped;
        source = "property-template";
        templateName = unit.property.applicationTemplate.name;
      }
    }

    // (c) PM's default template
    if (resolvedFields.length === 0) {
      const defaultTemplate = await db.applicationTemplate.findFirst({
        where: { landlordId, isDefault: true },
        select: { id: true, name: true, fields: true },
      });
      if (defaultTemplate) {
        const mapped = mapTemplateFields(defaultTemplate.fields);
        if (mapped) {
          resolvedFields = mapped;
          source = "pm-default-template";
          templateName = defaultTemplate.name;
        }
      }
    }

    // (d) PM's first template (any)
    if (resolvedFields.length === 0) {
      const anyTemplate = await db.applicationTemplate.findFirst({
        where: { landlordId },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, fields: true },
      });
      if (anyTemplate) {
        const mapped = mapTemplateFields(anyTemplate.fields);
        if (mapped) {
          resolvedFields = mapped;
          source = "pm-first-template";
          templateName = anyTemplate.name;
        }
      }
    }

    // (e) PM's ApplicationField records (authoritative fallback —
    // ensureApplicationFields creates defaults if none exist).
    if (resolvedFields.length === 0) {
      const fields = await ensureApplicationFields(landlordId);
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
      source = "pm-application-fields";
    }

    console.log(
      `[apply/fields] unit=${unitId} source=${source} count=${resolvedFields.length}`
    );

    return NextResponse.json(
      {
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
        templateName,
      },
      {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      }
    );
  } catch (err) {
    console.error("[apply/:unitId/fields] error:", err);
    return NextResponse.json(
      { error: "Failed to load application form" },
      { status: 500 }
    );
  }
}

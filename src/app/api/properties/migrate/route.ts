import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { auditLog } from "@/lib/audit";
import { z } from "zod";
import type { PropertyType } from "@prisma/client";

const propertyMigrationRowSchema = z.object({
  propertyName: z.string().min(1, "Property name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  propertyType: z.string().optional(),
  unitNumber: z.string().min(1, "Unit number is required"),
  bedrooms: z.coerce.number().int().min(0).optional(),
  bathrooms: z.coerce.number().min(0).optional(),
  sqft: z.coerce.number().int().min(0).optional(),
  rentAmount: z.coerce.number().positive("Rent amount is required"),
  dueDay: z.coerce.number().int().min(1).max(31).optional(),
  description: z.string().optional(),
});

type MigrationRow = z.infer<typeof propertyMigrationRowSchema>;

function parsePropertyType(raw?: string): PropertyType {
  if (!raw) return "MULTIFAMILY";
  const upper = raw.toUpperCase().replace(/[\s-]/g, "_");
  const aliases: Record<string, PropertyType> = {
    SINGLE_FAMILY: "SINGLE_FAMILY",
    SFR: "SINGLE_FAMILY",
    HOUSE: "SINGLE_FAMILY",
    CONDO: "SINGLE_FAMILY",
    TOWNHOUSE: "SINGLE_FAMILY",
    TOWNHOME: "SINGLE_FAMILY",
    MULTIFAMILY: "MULTIFAMILY",
    MULTI_FAMILY: "MULTIFAMILY",
    APARTMENT: "MULTIFAMILY",
    APARTMENTS: "MULTIFAMILY",
    RESIDENTIAL: "MULTIFAMILY",
    DUPLEX: "MULTIFAMILY",
    TRIPLEX: "MULTIFAMILY",
    FOURPLEX: "MULTIFAMILY",
    OFFICE: "OFFICE",
    COMMERCIAL: "COMMERCIAL",
    RETAIL: "COMMERCIAL",
    INDUSTRIAL: "COMMERCIAL",
    WAREHOUSE: "COMMERCIAL",
  };
  return aliases[upper] || "MULTIFAMILY";
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const landlordId = await getEffectiveLandlordId(session.user.id);
    const body = await req.json();
    const { rows, platform, fileName } = body as {
      rows: unknown[];
      platform: string;
      fileName: string;
    };

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    }
    if (rows.length > 500) {
      return NextResponse.json(
        { error: "Maximum 500 rows per import" },
        { status: 400 }
      );
    }

    // ── Validate ──
    const validated: MigrationRow[] = [];
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const result = propertyMigrationRowSchema.safeParse(rows[i]);
      if (result.success) {
        validated.push(result.data);
      } else {
        errors.push({
          row: i + 1,
          message: result.error.errors.map((e) => e.message).join(", "),
        });
      }
    }

    if (validated.length === 0) {
      return NextResponse.json(
        { error: "No valid rows found", errors },
        { status: 400 }
      );
    }

    // ── Group by property name (case-insensitive) ──
    const propertyMap = new Map<
      string,
      {
        info: {
          name: string;
          address: string;
          city: string;
          state: string;
          zip: string;
          propertyType: string | undefined;
        };
        units: MigrationRow[];
      }
    >();

    for (const row of validated) {
      const key = row.propertyName.toLowerCase().trim();
      if (!propertyMap.has(key)) {
        propertyMap.set(key, {
          info: {
            name: row.propertyName,
            address: row.address,
            city: row.city || "TBD",
            state: row.state || "TBD",
            zip: row.zip || "00000",
            propertyType: row.propertyType,
          },
          units: [],
        });
      }
      propertyMap.get(key)!.units.push(row);
    }

    // ── Check for duplicate unit numbers within each property ──
    for (const [, prop] of propertyMap) {
      const unitNumbers = prop.units.map((u) => u.unitNumber.toLowerCase());
      const seen = new Set<string>();
      for (const un of unitNumbers) {
        if (seen.has(un)) {
          return NextResponse.json(
            {
              error: `Duplicate unit number "${un}" in property "${prop.info.name}"`,
            },
            { status: 400 }
          );
        }
        seen.add(un);
      }
    }

    // ── Pre-fetch existing properties for this landlord ──
    const existingProperties = await db.property.findMany({
      where: { landlordId },
      include: {
        units: { select: { id: true, unitNumber: true } },
      },
    });

    // Build lookup cache: lowercase name → property
    const propertyCache = new Map<
      string,
      { id: string; units: Map<string, string> }
    >();
    for (const p of existingProperties) {
      const unitMap = new Map<string, string>();
      for (const u of p.units) {
        unitMap.set(u.unitNumber.toLowerCase(), u.id);
      }
      propertyCache.set(p.name.toLowerCase().trim(), { id: p.id, units: unitMap });
    }

    // ── Create in transaction ──
    let propertiesCreated = 0;
    let unitsCreated = 0;
    let skippedUnits = 0;

    await db.$transaction(async (tx) => {
      for (const [key, prop] of propertyMap) {
        let cached = propertyCache.get(key);

        // Find-or-create property
        if (!cached) {
          const newProp = await tx.property.create({
            data: {
              landlordId,
              name: prop.info.name,
              address: prop.info.address,
              city: prop.info.city,
              state: prop.info.state,
              zip: prop.info.zip,
              propertyType: parsePropertyType(prop.info.propertyType),
            },
          });
          cached = { id: newProp.id, units: new Map() };
          propertyCache.set(key, cached);
          propertiesCreated++;
        }

        // Create units
        for (const row of prop.units) {
          const unitKey = row.unitNumber.toLowerCase();
          if (cached.units.has(unitKey)) {
            skippedUnits++;
            errors.push({
              row: validated.indexOf(row) + 1,
              message: `Unit "${row.unitNumber}" already exists in "${prop.info.name}" — skipped`,
            });
            continue;
          }

          const newUnit = await tx.unit.create({
            data: {
              propertyId: cached.id,
              unitNumber: row.unitNumber,
              bedrooms: row.bedrooms ?? null,
              bathrooms: row.bathrooms ?? null,
              sqft: row.sqft ?? null,
              rentAmount: row.rentAmount,
              dueDay: row.dueDay || 1,
              description: row.description || null,
              status: "AVAILABLE",
            },
          });
          cached.units.set(unitKey, newUnit.id);
          unitsCreated++;
        }
      }
    });

    // ── Audit trail ──
    await db.migrationImport.create({
      data: {
        landlordId,
        platform: platform.toUpperCase(),
        fileName: fileName || "unknown",
        totalRows: rows.length,
        propertiesCreated,
        unitsCreated,
        tenantsCreated: 0,
        leasesCreated: 0,
        errors: errors.length > 0 ? errors : undefined,
        status:
          unitsCreated === 0 && validated.length > 0 ? "FAILED" : "COMPLETED",
      },
    });

    auditLog({
      userId: session.user.id,
      action: "MIGRATION_IMPORT",
      objectType: "PROPERTY",
      description: `Property migration from ${platform}: ${propertiesCreated} properties, ${unitsCreated} units created (${skippedUnits} skipped, ${errors.length} notes)`,
      newValue: {
        platform,
        fileName,
        propertiesCreated,
        unitsCreated,
        skippedUnits,
        errorCount: errors.length,
      },
    });

    return NextResponse.json({
      success: true,
      propertiesCreated,
      unitsCreated,
      skippedUnits,
      errors,
    });
  } catch (error) {
    console.error("Property migration error:", error);
    return NextResponse.json(
      { error: "Migration failed. Please check your data and try again." },
      { status: 500 }
    );
  }
}

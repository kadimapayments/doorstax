import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const rowSchema = z.object({
  propertyName: z.string().min(1, "Property name required"),
  address: z.string().min(1, "Address required"),
  city: z.string().min(1, "City required"),
  state: z.string().min(1, "State required"),
  zip: z.string().min(1, "ZIP required"),
  unitNumber: z.string().min(1, "Unit number required"),
  bedrooms: z.coerce.number().int().nonnegative().optional(),
  bathrooms: z.coerce.number().nonnegative().optional(),
  sqft: z.coerce.number().int().nonnegative().optional(),
  rentAmount: z.coerce.number().positive("Rent amount required"),
  dueDay: z.coerce.number().int().min(1).max(31).optional(),
  description: z.string().optional(),
});

type ImportRow = z.infer<typeof rowSchema>;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "LANDLORD") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { rows } = body as { rows: unknown[] };

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    }

    if (rows.length > 500) {
      return NextResponse.json(
        { error: "Maximum 500 rows per import" },
        { status: 400 }
      );
    }

    // Validate all rows
    const validated: ImportRow[] = [];
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const result = rowSchema.safeParse(rows[i]);
      if (result.success) {
        validated.push(result.data);
      } else {
        errors.push({
          row: i + 1,
          message: result.error.errors.map((e) => e.message).join(", "),
        });
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Validation errors", errors },
        { status: 400 }
      );
    }

    // Group by property (name + address)
    const propertyMap = new Map<
      string,
      { info: { name: string; address: string; city: string; state: string; zip: string }; units: ImportRow[] }
    >();

    for (const row of validated) {
      const key = `${row.propertyName}|||${row.address}`;
      if (!propertyMap.has(key)) {
        propertyMap.set(key, {
          info: {
            name: row.propertyName,
            address: row.address,
            city: row.city,
            state: row.state,
            zip: row.zip,
          },
          units: [],
        });
      }
      propertyMap.get(key)!.units.push(row);
    }

    // Check for duplicate unit numbers within each property
    for (const [, prop] of propertyMap) {
      const unitNumbers = prop.units.map((u) => u.unitNumber);
      const dupes = unitNumbers.filter(
        (n, i) => unitNumbers.indexOf(n) !== i
      );
      if (dupes.length > 0) {
        return NextResponse.json(
          {
            error: `Duplicate unit numbers in "${prop.info.name}": ${[...new Set(dupes)].join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Create properties and units in a transaction
    let propertiesCreated = 0;
    let unitsCreated = 0;

    await db.$transaction(async (tx) => {
      for (const [, prop] of propertyMap) {
        // Check if property already exists for this landlord
        let property = await tx.property.findFirst({
          where: {
            landlordId: session.user.id,
            name: prop.info.name,
            address: prop.info.address,
          },
        });

        if (!property) {
          property = await tx.property.create({
            data: {
              landlordId: session.user.id,
              name: prop.info.name,
              address: prop.info.address,
              city: prop.info.city,
              state: prop.info.state,
              zip: prop.info.zip,
            },
          });
          propertiesCreated++;
        }

        // Check for existing units to avoid duplicates
        const existingUnits = await tx.unit.findMany({
          where: { propertyId: property.id },
          select: { unitNumber: true },
        });
        const existingNumbers = new Set(existingUnits.map((u) => u.unitNumber));

        for (const unit of prop.units) {
          if (existingNumbers.has(unit.unitNumber)) {
            continue; // Skip existing units
          }

          await tx.unit.create({
            data: {
              propertyId: property.id,
              unitNumber: unit.unitNumber,
              bedrooms: unit.bedrooms || null,
              bathrooms: unit.bathrooms || null,
              sqft: unit.sqft || null,
              rentAmount: unit.rentAmount,
              dueDay: unit.dueDay || 1,
              description: unit.description || null,
            },
          });
          unitsCreated++;
        }
      }
    });

    return NextResponse.json({
      success: true,
      propertiesCreated,
      unitsCreated,
      totalProperties: propertyMap.size,
      skippedUnits: validated.length - unitsCreated,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Import failed. Please check your data and try again." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { generateInviteToken, hashToken } from "@/lib/invite-tokens";
import { auditLog } from "@/lib/audit";
import { z } from "zod";
import { randomBytes } from "crypto";
import { hash } from "bcryptjs";

const migrationRowSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  propertyName: z.string().min(1, "Property name is required"),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  unitNumber: z.string().min(1, "Unit number is required"),
  bedrooms: z.coerce.number().int().min(0).optional(),
  bathrooms: z.coerce.number().min(0).optional(),
  sqft: z.coerce.number().int().min(0).optional(),
  rentAmount: z.coerce.number().positive("Rent amount is required"),
  leaseStart: z.string().optional(),
  leaseEnd: z.string().optional(),
});

type MigrationRow = z.infer<typeof migrationRowSchema>;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const landlordId = await getEffectiveLandlordId(session.user.id);
    const body = await req.json();
    const { rows, platform = "GENERIC", fileName = "import.csv" } = body as {
      rows: unknown[];
      platform?: string;
      fileName?: string;
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

    // ── Validate all rows ──
    const validated: MigrationRow[] = [];
    const validationErrors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const result = migrationRowSchema.safeParse(rows[i]);
      if (result.success) {
        validated.push(result.data);
      } else {
        validationErrors.push({
          row: i + 1,
          message: result.error.errors.map((e) => e.message).join(", "),
        });
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: "Validation errors", errors: validationErrors },
        { status: 400 }
      );
    }

    // ── Check for duplicate emails ──
    const emailCounts = new Map<string, number[]>();
    for (let i = 0; i < validated.length; i++) {
      const email = validated[i].email.toLowerCase();
      if (!emailCounts.has(email)) emailCounts.set(email, []);
      emailCounts.get(email)!.push(i + 1);
    }

    const dupes = [...emailCounts.entries()].filter(
      ([, idx]) => idx.length > 1
    );
    if (dupes.length > 0) {
      return NextResponse.json(
        {
          error: "Duplicate emails in import",
          errors: dupes.map(([email, idx]) => ({
            row: idx[0],
            message: `Email "${email}" appears in rows ${idx.join(", ")}`,
          })),
        },
        { status: 400 }
      );
    }

    // ── Pre-fetch existing data ──
    const [existingProperties, existingUsers] = await Promise.all([
      db.property.findMany({
        where: { landlordId },
        include: {
          units: {
            select: { id: true, unitNumber: true, status: true },
          },
        },
      }),
      db.user.findMany({
        where: {
          email: {
            in: validated.map((r) => r.email.toLowerCase()),
          },
        },
        select: { email: true },
      }),
    ]);

    const existingEmailSet = new Set(
      existingUsers.map((u) => u.email.toLowerCase())
    );

    // ── Group rows by property ──
    const propGroups = new Map<
      string,
      { row: MigrationRow; rowIndex: number }[]
    >();

    for (let i = 0; i < validated.length; i++) {
      const key = validated[i].propertyName.toLowerCase().trim();
      if (!propGroups.has(key)) propGroups.set(key, []);
      propGroups.get(key)!.push({ row: validated[i], rowIndex: i + 1 });
    }

    // ── Process in transaction ──
    const errors: { row: number; message: string }[] = [];
    let propertiesCreated = 0;
    let unitsCreated = 0;
    let tenantsCreated = 0;
    let tenantsSkipped = 0;
    let leasesCreated = 0;

    // Build a mutable property cache
    const propertyCache = new Map<
      string,
      {
        id: string;
        units: Map<string, string>;
      }
    >();

    for (const prop of existingProperties) {
      const unitMap = new Map<string, string>();
      for (const u of prop.units) {
        unitMap.set(u.unitNumber.toLowerCase(), u.id);
      }
      propertyCache.set(prop.name.toLowerCase().trim(), {
        id: prop.id,
        units: unitMap,
      });
    }

    await db.$transaction(async (tx) => {
      for (const [propKey, group] of propGroups) {
        // ── Find or create property ──
        let propEntry = propertyCache.get(propKey);
        if (!propEntry) {
          const sample = group[0].row;
          const newProp = await tx.property.create({
            data: {
              landlordId,
              name: sample.propertyName,
              address: sample.address || "TBD",
              city: sample.city || "TBD",
              state: sample.state || "TBD",
              zip: sample.zip || "00000",
            },
          });
          propEntry = { id: newProp.id, units: new Map() };
          propertyCache.set(propKey, propEntry);
          propertiesCreated++;
        }

        // ── Process each tenant in this property group ──
        for (const { row, rowIndex } of group) {
          try {
            // Skip existing emails
            if (existingEmailSet.has(row.email.toLowerCase())) {
              tenantsSkipped++;
              errors.push({
                row: rowIndex,
                message: `User "${row.email}" already exists — skipped`,
              });
              continue;
            }

            // ── Find or create unit ──
            const unitKey = row.unitNumber.toLowerCase();
            let unitId = propEntry.units.get(unitKey);

            if (!unitId) {
              const newUnit = await tx.unit.create({
                data: {
                  propertyId: propEntry.id,
                  unitNumber: row.unitNumber,
                  bedrooms: row.bedrooms ?? null,
                  bathrooms: row.bathrooms ?? null,
                  sqft: row.sqft ?? null,
                  rentAmount: row.rentAmount,
                  status: "OCCUPIED",
                },
              });
              unitId = newUnit.id;
              propEntry.units.set(unitKey, unitId);
              unitsCreated++;
            } else {
              // Mark existing unit as occupied
              await tx.unit.update({
                where: { id: unitId },
                data: { status: "OCCUPIED" },
              });
            }

            // ── Create user ──
            const placeholderPassword = randomBytes(16).toString("hex");
            const passwordHash = await hash(placeholderPassword, 10);

            const user = await tx.user.create({
              data: {
                email: row.email.toLowerCase(),
                name: row.name,
                passwordHash,
                role: "TENANT",
                phone: row.phone || null,
              },
            });

            // ── Create tenant profile ──
            const profile = await tx.tenantProfile.create({
              data: {
                userId: user.id,
                unitId,
                leaseStart: row.leaseStart
                  ? new Date(row.leaseStart)
                  : undefined,
                leaseEnd: row.leaseEnd ? new Date(row.leaseEnd) : undefined,
                splitPercent: 100,
                isPrimary: true,
              },
            });

            // ── Create lease ──
            if (row.leaseStart || row.leaseEnd) {
              await tx.lease.create({
                data: {
                  tenantId: profile.id,
                  unitId,
                  propertyId: propEntry.id,
                  landlordId,
                  startDate: row.leaseStart
                    ? new Date(row.leaseStart)
                    : new Date(),
                  endDate: row.leaseEnd
                    ? new Date(row.leaseEnd)
                    : new Date(
                        new Date().setFullYear(new Date().getFullYear() + 1)
                      ),
                  rentAmount: row.rentAmount,
                  status: "ACTIVE",
                },
              });
              leasesCreated++;
            }

            // ── Create invite for password setup ──
            const rawToken = generateInviteToken();
            const tokenHashed = await hashToken(rawToken);

            await tx.tenantInvite.create({
              data: {
                landlordId,
                unitId,
                email: row.email.toLowerCase(),
                name: row.name,
                tokenHash: tokenHashed,
                expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
              },
            });

            tenantsCreated++;
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Unknown error";
            errors.push({
              row: rowIndex,
              message: `Failed to create tenant: ${message}`,
            });
          }
        }
      }
    });

    // ── Create migration audit record ──
    await db.migrationImport.create({
      data: {
        landlordId,
        platform: platform.toUpperCase(),
        fileName,
        totalRows: validated.length,
        propertiesCreated,
        unitsCreated,
        tenantsCreated,
        leasesCreated,
        errors: errors.length > 0 ? errors : undefined,
        status:
          tenantsCreated === 0 && validated.length > 0 ? "FAILED" : "COMPLETED",
      },
    });

    // ── Audit log ──
    auditLog({
      userId: session.user.id,
      action: "MIGRATION_IMPORT",
      objectType: "TENANT",
      description: `Migration from ${platform}: ${tenantsCreated} tenants, ${propertiesCreated} properties, ${unitsCreated} units, ${leasesCreated} leases created (${errors.length} errors)`,
      newValue: {
        platform,
        fileName,
        propertiesCreated,
        unitsCreated,
        tenantsCreated,
        leasesCreated,
        tenantsSkipped,
        errorCount: errors.length,
      },
    });

    return NextResponse.json({
      success: true,
      propertiesCreated,
      unitsCreated,
      tenantsCreated,
      tenantsSkipped,
      leasesCreated,
      errors,
    });
  } catch (error) {
    console.error("Migration import error:", error);
    return NextResponse.json(
      { error: "Migration failed. Please check your data and try again." },
      { status: 500 }
    );
  }
}

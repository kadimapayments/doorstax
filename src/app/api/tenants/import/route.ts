import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateInviteToken, hashToken } from "@/lib/invite-tokens";
import { z } from "zod";
import { randomBytes } from "crypto";
import { hash } from "bcryptjs";

const tenantImportRowSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  propertyName: z.string().min(1, "Property name is required"),
  unitNumber: z.string().min(1, "Unit number is required"),
  leaseStart: z.string().optional(),
  leaseEnd: z.string().optional(),
  splitPercent: z.coerce.number().int().min(1).max(100).optional(),
});

type TenantImportRow = z.infer<typeof tenantImportRowSchema>;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
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
    const validated: TenantImportRow[] = [];
    const validationErrors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const result = tenantImportRowSchema.safeParse(rows[i]);
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

    // Check for duplicate emails within the import
    const emailCounts = new Map<string, number[]>();
    for (let i = 0; i < validated.length; i++) {
      const email = validated[i].email.toLowerCase();
      if (!emailCounts.has(email)) {
        emailCounts.set(email, []);
      }
      emailCounts.get(email)!.push(i + 1);
    }

    const duplicateEmails = [...emailCounts.entries()].filter(
      ([, indices]) => indices.length > 1
    );
    if (duplicateEmails.length > 0) {
      return NextResponse.json(
        {
          error: "Duplicate emails in import",
          errors: duplicateEmails.map(([email, indices]) => ({
            row: indices[0],
            message: `Email "${email}" appears in rows ${indices.join(", ")}`,
          })),
        },
        { status: 400 }
      );
    }

    // Pre-fetch landlord's properties for resolution
    const landlordProperties = await db.property.findMany({
      where: { landlordId: session.user.id },
      include: {
        units: { select: { id: true, unitNumber: true, status: true } },
      },
    });

    // Check which emails already exist in the system
    const allEmails = validated.map((r) => r.email.toLowerCase());
    const existingUsers = await db.user.findMany({
      where: { email: { in: allEmails } },
      select: { email: true },
    });
    const existingEmailSet = new Set(
      existingUsers.map((u) => u.email.toLowerCase())
    );

    // Resolve properties and units, collect errors and rows to process
    const rowsToProcess: {
      row: TenantImportRow;
      propertyId: string;
      unitId: string;
      rowIndex: number;
    }[] = [];
    const errors: { row: number; message: string }[] = [];
    let tenantsSkipped = 0;

    for (let i = 0; i < validated.length; i++) {
      const row = validated[i];
      const rowNum = i + 1;

      // Skip if email already exists
      if (existingEmailSet.has(row.email.toLowerCase())) {
        tenantsSkipped++;
        errors.push({
          row: rowNum,
          message: `User with email "${row.email}" already exists — skipped`,
        });
        continue;
      }

      // Resolve property by name (case-insensitive)
      const property = landlordProperties.find(
        (p) => p.name.toLowerCase() === row.propertyName.toLowerCase()
      );

      if (!property) {
        errors.push({
          row: rowNum,
          message: `Property "${row.propertyName}" not found`,
        });
        continue;
      }

      // Resolve unit by unitNumber within that property
      const unit = property.units.find(
        (u) => u.unitNumber.toLowerCase() === row.unitNumber.toLowerCase()
      );

      if (!unit) {
        errors.push({
          row: rowNum,
          message: `Unit "${row.unitNumber}" not found in property "${row.propertyName}"`,
        });
        continue;
      }

      rowsToProcess.push({
        row,
        propertyId: property.id,
        unitId: unit.id,
        rowIndex: rowNum,
      });
    }

    // Process valid rows in a transaction
    let tenantsCreated = 0;

    if (rowsToProcess.length > 0) {
      await db.$transaction(async (tx) => {
        for (const { row, unitId, rowIndex } of rowsToProcess) {
          try {
            // Create user with random placeholder password
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

            // Create tenant profile
            await tx.tenantProfile.create({
              data: {
                userId: user.id,
                unitId,
                leaseStart: row.leaseStart
                  ? new Date(row.leaseStart)
                  : undefined,
                leaseEnd: row.leaseEnd ? new Date(row.leaseEnd) : undefined,
                splitPercent: row.splitPercent ?? 100,
                isPrimary: true,
              },
            });

            // Create invite for password setup
            const rawToken = generateInviteToken();
            const tokenHash = await hashToken(rawToken);

            await tx.tenantInvite.create({
              data: {
                landlordId: session.user.id,
                unitId,
                email: row.email.toLowerCase(),
                tokenHash,
                expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
              },
            });

            // Update unit status to OCCUPIED
            await tx.unit.update({
              where: { id: unitId },
              data: { status: "OCCUPIED" },
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
      });
    }

    return NextResponse.json({
      success: true,
      tenantsCreated,
      tenantsSkipped,
      errors,
    });
  } catch (error) {
    console.error("Tenant import error:", error);
    return NextResponse.json(
      { error: "Import failed. Please check your data and try again." },
      { status: 500 }
    );
  }
}

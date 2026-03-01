import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// GET: get rent split for a unit
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const unitId = searchParams.get("unitId");

  if (!unitId) {
    return NextResponse.json({ error: "unitId is required" }, { status: 400 });
  }

  const split = await db.rentSplit.findUnique({
    where: { unitId },
    include: {
      splits: {
        include: {
          tenant: {
            include: { user: { select: { name: true, email: true } } },
          },
        },
      },
    },
  });

  return NextResponse.json(split);
}

const splitItemSchema = z.object({
  tenantId: z.string(),
  percent: z.number().min(1).max(100),
});

const updateSplitSchema = z.object({
  unitId: z.string().min(1),
  splits: z.array(splitItemSchema).min(1),
});

// PUT: create or update rent splits for a unit
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "LANDLORD") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = updateSplitSchema.parse(body);

    // Verify total = 100%
    const total = data.splits.reduce((sum, s) => sum + s.percent, 0);
    if (total !== 100) {
      return NextResponse.json(
        { error: `Splits must total 100%. Currently: ${total}%` },
        { status: 400 }
      );
    }

    // Verify landlord owns unit
    const unit = await db.unit.findFirst({
      where: {
        id: data.unitId,
        property: { landlordId: session.user.id },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const totalRent = Number(unit.rentAmount);

    // Upsert RentSplit + items in transaction
    const result = await db.$transaction(async (tx) => {
      // Delete existing split items if any
      const existing = await tx.rentSplit.findUnique({
        where: { unitId: data.unitId },
      });

      if (existing) {
        await tx.rentSplitItem.deleteMany({
          where: { rentSplitId: existing.id },
        });
        await tx.rentSplit.delete({ where: { id: existing.id } });
      }

      // Create new split
      const rentSplit = await tx.rentSplit.create({
        data: {
          unitId: data.unitId,
          totalRent: unit.rentAmount,
          splits: {
            create: data.splits.map((s) => ({
              tenantId: s.tenantId,
              percent: s.percent,
              amount: (totalRent * s.percent) / 100,
            })),
          },
        },
        include: {
          splits: {
            include: {
              tenant: {
                include: { user: { select: { name: true, email: true } } },
              },
            },
          },
        },
      });

      // Update tenant profiles with split percentages
      for (const s of data.splits) {
        await tx.tenantProfile.update({
          where: { id: s.tenantId },
          data: { splitPercent: s.percent },
        });
      }

      return rentSplit;
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Rent split error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

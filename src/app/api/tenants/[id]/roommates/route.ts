import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: tenantId } = await params;
  const { searchParams } = new URL(req.url);
  const unitId = searchParams.get("unitId");

  if (!unitId) {
    return NextResponse.json({ error: "unitId is required" }, { status: 400 });
  }

  // Validate landlord ownership of the unit
  const unit = await db.unit.findFirst({
    where: {
      id: unitId,
      property: { landlordId: session.user.id },
    },
  });

  if (!unit) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  }

  // Verify the tenant belongs to this unit
  const tenantProfile = await db.tenantProfile.findUnique({
    where: { id: tenantId },
  });

  if (!tenantProfile || tenantProfile.unitId !== unitId) {
    return NextResponse.json(
      { error: "Tenant not found in this unit" },
      { status: 404 }
    );
  }

  if (tenantProfile.isPrimary) {
    return NextResponse.json(
      { error: "Cannot remove the primary tenant" },
      { status: 400 }
    );
  }

  await db.$transaction(async (tx) => {
    // Remove the tenant's RentSplitItem if it exists
    const existingSplit = await tx.rentSplit.findUnique({
      where: { unitId },
    });

    if (existingSplit) {
      await tx.rentSplitItem.deleteMany({
        where: {
          rentSplitId: existingSplit.id,
          tenantId,
        },
      });
    }

    // Detach the tenant from the unit (set unitId = null)
    await tx.tenantProfile.update({
      where: { id: tenantId },
      data: { unitId: null, splitPercent: 0 },
    });

    // Get remaining tenants in this unit
    const remaining = await tx.tenantProfile.findMany({
      where: { unitId },
    });

    const count = remaining.length;

    if (count === 0) {
      // No tenants left - clean up rent split
      if (existingSplit) {
        await tx.rentSplitItem.deleteMany({
          where: { rentSplitId: existingSplit.id },
        });
        await tx.rentSplit.delete({ where: { id: existingSplit.id } });
      }
      return;
    }

    // Auto-redistribute remaining splits evenly
    const evenSplit = Math.floor(100 / count);
    const remainder = 100 - evenSplit * count;

    for (const profile of remaining) {
      const pct = profile.isPrimary ? evenSplit + remainder : evenSplit;
      await tx.tenantProfile.update({
        where: { id: profile.id },
        data: { splitPercent: pct },
      });
    }

    // If only 1 tenant left, set their split to 100%
    if (count === 1) {
      await tx.tenantProfile.update({
        where: { id: remaining[0].id },
        data: { splitPercent: 100 },
      });
    }

    // Rebuild the RentSplit + RentSplitItems
    if (existingSplit) {
      await tx.rentSplitItem.deleteMany({
        where: { rentSplitId: existingSplit.id },
      });
      await tx.rentSplit.delete({ where: { id: existingSplit.id } });
    }

    const totalRent = Number(unit.rentAmount);
    await tx.rentSplit.create({
      data: {
        unitId,
        totalRent: unit.rentAmount,
        splits: {
          create: remaining.map((profile) => {
            const pct =
              count === 1
                ? 100
                : profile.isPrimary
                  ? evenSplit + remainder
                  : evenSplit;
            return {
              tenantId: profile.id,
              percent: pct,
              amount: (totalRent * pct) / 100,
            };
          }),
        },
      },
    });
  });

  return NextResponse.json({ success: true });
}

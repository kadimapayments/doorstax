import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveApiLandlord } from "@/lib/api-landlord";

export async function GET() {
  const ctx = await resolveApiLandlord();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = ctx.landlordId;

  try {
    const owners = await db.owner.findMany({
      where: { landlordId },
      include: {
        properties: { select: { id: true, name: true } },
        _count: { select: { payouts: true } },
      },
      orderBy: { name: "asc" },
    });

    // Get total paid for each owner
    const ownersWithTotals = await Promise.all(
      owners.map(async (owner) => {
        const paidPayouts = await db.ownerPayout.aggregate({
          where: { ownerId: owner.id, status: "PAID" },
          _sum: { netPayout: true },
        });
        return {
          ...owner,
          managementFeePercent: Number(owner.managementFeePercent),
          totalPaid: Number(paidPayouts._sum.netPayout ?? 0),
        };
      })
    );

    return NextResponse.json(ownersWithTotals);
  } catch {
    return NextResponse.json({ error: "Failed to fetch owners" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const ctx = await resolveApiLandlord();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = ctx.landlordId;

  try {
    const body = await req.json();
    const { name, email, phone, managementFeePercent, deductExpenses, achRate, feeScheduleId, propertyIds, payoutFeeRate, unitFeeRate, billMe, billMeIncludeManagement, payoutFrequency, achFeeResponsibility, customFees } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Owner name is required" }, { status: 400 });
    }

    // Auto-assign terminal IDs: find max existing TID for this PM, start at 7000
    const existingOwners = await db.owner.findMany({
      where: { landlordId, terminalId: { not: null } },
      select: { terminalId: true, achTerminalId: true },
    });
    let nextTid = 7000;
    if (existingOwners.length > 0) {
      const maxTid = Math.max(
        ...existingOwners.map((o) => parseInt(o.terminalId || "0", 10))
      );
      nextTid = maxTid + 1;
    }
    const tidStr = String(nextTid);

    const owner = await db.owner.create({
      data: {
        landlordId,
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        managementFeePercent: managementFeePercent ?? 0,
        deductProcessingFees: (achRate ?? 6) > 0,
        deductExpenses: deductExpenses ?? true,
        deductPlatformFee: (unitFeeRate ?? 0) > 0,
        achRate: achRate ?? 6,
        feeScheduleId: feeScheduleId || null,
        payoutFeeRate: payoutFeeRate ?? 0.0015,
        unitFeeRate: unitFeeRate ?? 0,
        billMe: billMe ?? false,
        billMeIncludeManagement: billMeIncludeManagement ?? true,
        payoutFrequency: payoutFrequency ?? "MONTHLY",
        achFeeResponsibility: achFeeResponsibility ?? "OWNER",
        customFees: customFees ?? [],
        terminalId: tidStr,
        achTerminalId: tidStr,
      },
    });

    // Assign properties if provided
    if (propertyIds?.length) {
      await db.property.updateMany({
        where: { id: { in: propertyIds }, landlordId },
        data: { ownerId: owner.id },
      });
    }

    return NextResponse.json(owner, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create owner" }, { status: 500 });
  }
}

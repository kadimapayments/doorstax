import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const { id } = await params;

  try {
    const owner = await db.owner.findFirst({
      where: { id, landlordId },
      include: {
        properties: {
          select: { id: true, name: true, address: true, city: true, state: true },
        },
        payouts: {
          orderBy: { periodStart: "desc" },
          take: 12,
        },
      },
    });

    if (!owner) {
      return NextResponse.json({ error: "Owner not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...owner,
      managementFeePercent: Number(owner.managementFeePercent),
      achRate: Number(owner.achRate ?? 6),
      payoutFeeRate: Number((owner as any).payoutFeeRate ?? 0.0015),
      unitFeeRate: Number((owner as any).unitFeeRate ?? 0),
      billMe: (owner as any).billMe ?? false,
      billMeIncludeManagement: (owner as any).billMeIncludeManagement ?? true,
      payoutFrequency: (owner as any).payoutFrequency ?? "MONTHLY",
      achFeeResponsibility: (owner as any).achFeeResponsibility ?? "OWNER",
      customFees: (owner as any).customFees ?? [],
      feeScheduleId: owner.feeScheduleId ?? null,
      payouts: owner.payouts.map((p) => ({
        ...p,
        grossRent: Number(p.grossRent),
        processingFees: Number(p.processingFees),
        managementFee: Number(p.managementFee),
        expenses: Number(p.expenses),
        platformFee: Number(p.platformFee),
        netPayout: Number(p.netPayout),
      })),
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch owner" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const { id } = await params;

  try {
    const existing = await db.owner.findFirst({ where: { id, landlordId } });
    if (!existing) {
      return NextResponse.json({ error: "Owner not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, email, phone, managementFeePercent, deductExpenses, achRate, feeScheduleId, propertyIds, payoutFeeRate, unitFeeRate, billMe, billMeIncludeManagement, payoutFrequency, achFeeResponsibility, customFees } = body;

    const owner = await db.owner.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(managementFeePercent !== undefined && { managementFeePercent }),
        ...(deductExpenses !== undefined && { deductExpenses }),
        ...(achRate !== undefined && { achRate, deductProcessingFees: achRate > 0 }),
        ...(feeScheduleId !== undefined && { feeScheduleId: feeScheduleId || null }),
        ...(payoutFeeRate !== undefined && { payoutFeeRate }),
        ...(unitFeeRate !== undefined && { unitFeeRate, deductPlatformFee: unitFeeRate > 0 }),
        ...(billMe !== undefined && { billMe }),
        ...(billMeIncludeManagement !== undefined && { billMeIncludeManagement }),
        ...(payoutFrequency !== undefined && { payoutFrequency }),
        ...(achFeeResponsibility !== undefined && { achFeeResponsibility }),
        ...(customFees !== undefined && { customFees }),
      },
    });

    // Re-assign properties if provided
    if (propertyIds !== undefined) {
      // Unassign all current properties from this owner
      await db.property.updateMany({
        where: { ownerId: id, landlordId },
        data: { ownerId: null },
      });
      // Assign new set
      if (propertyIds.length) {
        await db.property.updateMany({
          where: { id: { in: propertyIds }, landlordId },
          data: { ownerId: id },
        });
      }
    }

    return NextResponse.json(owner);
  } catch {
    return NextResponse.json({ error: "Failed to update owner" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const { id } = await params;

  try {
    const existing = await db.owner.findFirst({
      where: { id, landlordId },
      include: { _count: { select: { payouts: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Owner not found" }, { status: 404 });
    }

    if (existing._count.payouts > 0) {
      return NextResponse.json(
        { error: "Cannot delete owner with existing payouts. Remove payouts first." },
        { status: 400 }
      );
    }

    // Unassign properties
    await db.property.updateMany({
      where: { ownerId: id, landlordId },
      data: { ownerId: null },
    });

    await db.owner.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete owner" }, { status: 500 });
  }
}

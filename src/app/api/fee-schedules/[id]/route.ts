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
    const schedule = await db.feeSchedule.findFirst({
      where: { id, landlordId },
      include: {
        owners: { select: { id: true, name: true, email: true } },
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: "Fee schedule not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...schedule,
      managementFeePercent: Number(schedule.managementFeePercent),
      achRate: Number(schedule.achRate),
      payoutFeeRate: Number(schedule.payoutFeeRate),
      unitFeeRate: Number(schedule.unitFeeRate),
      billMe: schedule.billMe,
      billMeIncludeManagement: schedule.billMeIncludeManagement,
      payoutFrequency: schedule.payoutFrequency,
      achFeeResponsibility: schedule.achFeeResponsibility,
      customFees: schedule.customFees,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch fee schedule" }, { status: 500 });
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
    const existing = await db.feeSchedule.findFirst({ where: { id, landlordId } });
    if (!existing) {
      return NextResponse.json({ error: "Fee schedule not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      name,
      managementFeePercent,
      achRate,
      deductExpenses,
      payoutFeeRate,
      unitFeeRate,
      billMe,
      billMeIncludeManagement,
      payoutFrequency,
      achFeeResponsibility,
      customFees,
    } = body;

    if (achRate !== undefined && achRate < 0) {
      return NextResponse.json({ error: "ACH rate must be $0 or greater" }, { status: 400 });
    }
    if (payoutFeeRate !== undefined && (payoutFeeRate < 0.0015 || payoutFeeRate > 0.005)) {
      return NextResponse.json({ error: "Payout fee rate must be between 0.15% and 0.5%" }, { status: 400 });
    }
    if (unitFeeRate !== undefined && (unitFeeRate < 0 || unitFeeRate > 3)) {
      return NextResponse.json({ error: "Unit fee rate must be between $0 and $3" }, { status: 400 });
    }
    const resolvedAchResp = achFeeResponsibility ?? existing.achFeeResponsibility;
    if (resolvedAchResp === "TENANT" && (achRate ?? Number(existing.achRate)) > 6) {
      return NextResponse.json({ error: "ACH rate cannot exceed $6 when tenant pays" }, { status: 400 });
    }

    const effectiveAchRate = achRate ?? Number(existing.achRate);
    const effectiveUnitFeeRate = unitFeeRate ?? Number(existing.unitFeeRate);

    const updated = await db.feeSchedule.update({
      where: { id },
      data: {
        name: name?.trim() || existing.name,
        managementFeePercent: managementFeePercent ?? Number(existing.managementFeePercent),
        achRate: effectiveAchRate,
        deductProcessingFees: effectiveAchRate > 0,
        deductExpenses: deductExpenses ?? existing.deductExpenses,
        deductPlatformFee: effectiveUnitFeeRate > 0,
        payoutFeeRate: payoutFeeRate ?? Number(existing.payoutFeeRate),
        unitFeeRate: effectiveUnitFeeRate,
        billMe: billMe ?? existing.billMe,
        billMeIncludeManagement: billMeIncludeManagement ?? existing.billMeIncludeManagement,
        payoutFrequency: payoutFrequency ?? existing.payoutFrequency,
        ...(achFeeResponsibility !== undefined && { achFeeResponsibility }),
        ...(customFees !== undefined && { customFees }),
      },
    });

    return NextResponse.json({
      ...updated,
      managementFeePercent: Number(updated.managementFeePercent),
      achRate: Number(updated.achRate),
      payoutFeeRate: Number(updated.payoutFeeRate),
      unitFeeRate: Number(updated.unitFeeRate),
    });
  } catch (e) {
    console.error("Fee schedule update error:", e);
    return NextResponse.json({ error: "Failed to update fee schedule" }, { status: 500 });
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
    const schedule = await db.feeSchedule.findFirst({
      where: { id, landlordId },
      include: { _count: { select: { owners: true } } },
    });

    if (!schedule) {
      return NextResponse.json({ error: "Fee schedule not found" }, { status: 404 });
    }

    // Unassign owners before deleting
    if (schedule._count.owners > 0) {
      await db.owner.updateMany({
        where: { feeScheduleId: id },
        data: { feeScheduleId: null },
      });
    }

    await db.feeSchedule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Fee schedule deletion error:", e);
    return NextResponse.json({ error: "Failed to delete fee schedule" }, { status: 500 });
  }
}

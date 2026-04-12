import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";

export async function GET() {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);

  try {
    const [schedules, unitCount] = await Promise.all([
      db.feeSchedule.findMany({
        where: { landlordId },
        include: { _count: { select: { owners: true } } },
        orderBy: { createdAt: "desc" },
      }),
      db.unit.count({ where: { property: { landlordId } } }),
    ]);

    return NextResponse.json({
      schedules: schedules.map((s) => ({
        id: s.id,
        name: s.name,
        managementFeePercent: Number(s.managementFeePercent),
        achRate: Number(s.achRate),
        deductProcessingFees: s.deductProcessingFees,
        deductExpenses: s.deductExpenses,
        deductPlatformFee: s.deductPlatformFee,
        payoutFeeRate: Number(s.payoutFeeRate),
        unitFeeRate: Number(s.unitFeeRate),
        billMe: s.billMe,
        billMeIncludeManagement: s.billMeIncludeManagement,
        payoutFrequency: s.payoutFrequency,
        achFeeResponsibility: s.achFeeResponsibility,
        customFees: s.customFees,
        ownerCount: s._count.owners,
        createdAt: s.createdAt,
      })),
      unitCount,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch fee schedules" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);

  try {
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

    if (!name?.trim()) {
      return NextResponse.json({ error: "Schedule name is required" }, { status: 400 });
    }
    if (achRate !== undefined && achRate < 0) {
      return NextResponse.json({ error: "ACH rate must be $0 or greater" }, { status: 400 });
    }
    if (payoutFeeRate !== undefined && (payoutFeeRate < 0.0015 || payoutFeeRate > 0.005)) {
      return NextResponse.json({ error: "Payout fee rate must be between 0.15% and 0.5%" }, { status: 400 });
    }
    if (unitFeeRate !== undefined && (unitFeeRate < 0 || unitFeeRate > 3)) {
      return NextResponse.json({ error: "Unit fee rate must be between $0 and $3" }, { status: 400 });
    }
    if (achFeeResponsibility === "TENANT" && (achRate ?? 6) > 6) {
      return NextResponse.json({ error: "ACH rate cannot exceed $6 when tenant pays" }, { status: 400 });
    }

    // Enforce Starter tier lock: force fixed values for payment processing
    const { getTier } = await import("@/lib/residual-tiers");
    const pmUnitCount = await db.unit.count({
      where: { property: { landlordId } },
    });
    const pmTier = getTier(pmUnitCount);

    let effectiveAchRate = achRate ?? 6;
    let effectiveAchResp = achFeeResponsibility ?? "OWNER";
    if (pmTier.feeScheduleLocked) {
      effectiveAchRate = pmTier.tenantAchRate ?? 6;
      effectiveAchResp = "TENANT";
    }
    const effectiveUnitFeeRate = unitFeeRate ?? 0;

    const schedule = await db.feeSchedule.create({
      data: {
        landlordId,
        name: name.trim(),
        managementFeePercent: managementFeePercent ?? 0,
        achRate: effectiveAchRate,
        deductProcessingFees: effectiveAchRate > 0,
        deductExpenses: deductExpenses ?? true,
        deductPlatformFee: effectiveUnitFeeRate > 0,
        payoutFeeRate: payoutFeeRate ?? 0,
        unitFeeRate: effectiveUnitFeeRate,
        billMe: billMe ?? false,
        billMeIncludeManagement: billMeIncludeManagement ?? false,
        payoutFrequency: payoutFrequency ?? "MONTHLY",
        achFeeResponsibility: effectiveAchResp,
        customFees: customFees ?? [],
      },
    });

    return NextResponse.json({
      ...schedule,
      managementFeePercent: Number(schedule.managementFeePercent),
      achRate: Number(schedule.achRate),
      payoutFeeRate: Number(schedule.payoutFeeRate),
      unitFeeRate: Number(schedule.unitFeeRate),
    }, { status: 201 });
  } catch (e) {
    console.error("Fee schedule creation error:", e);
    return NextResponse.json({ error: "Failed to create fee schedule" }, { status: 500 });
  }
}

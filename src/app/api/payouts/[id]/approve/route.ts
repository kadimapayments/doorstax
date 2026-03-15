import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId, getTeamContext, can } from "@/lib/team-context";
import { auditLog } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teamCtx = await getTeamContext(session.user.id);
  if (!can(teamCtx, "payouts:approve")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const { id } = await params;

  try {
    const payout = await db.ownerPayout.findFirst({ where: { id, landlordId } });
    if (!payout) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404 });
    }
    if (payout.status !== "DRAFT") {
      return NextResponse.json({ error: "Only DRAFT payouts can be approved" }, { status: 400 });
    }

    const updated = await db.ownerPayout.update({
      where: { id },
      data: { status: "APPROVED" },
    });

    auditLog({
      userId: session.user.id,
      userName: session.user.name,
      userRole: session.user.role,
      action: "APPROVE",
      objectType: "Payout",
      objectId: id,
      description: `Approved payout (net: $${Number(updated.netPayout).toFixed(2)})`,
      req,
    });

    return NextResponse.json({
      ...updated,
      grossRent: Number(updated.grossRent),
      processingFees: Number(updated.processingFees),
      managementFee: Number(updated.managementFee),
      expenses: Number(updated.expenses),
      platformFee: Number(updated.platformFee),
      netPayout: Number(updated.netPayout),
    });
  } catch {
    return NextResponse.json({ error: "Failed to approve payout" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { auditLog } from "@/lib/audit";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const { id } = await params;

  try {
    const payout = await db.ownerPayout.findFirst({
      where: { id, landlordId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            managementFeePercent: true,
            kadimaCustomerId: true,
            bankAccountLast4: true,
            properties: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!payout) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404 });
    }

    const propertyIds = payout.owner.properties.map((p) => p.id);

    // Get detailed payment breakdown
    const payments = await db.payment.findMany({
      where: {
        landlordId,
        status: "COMPLETED",
        unit: { propertyId: { in: propertyIds } },
        paidAt: { gte: payout.periodStart, lte: payout.periodEnd },
      },
      include: {
        unit: { select: { unitNumber: true, property: { select: { name: true } } } },
        tenant: { select: { user: { select: { name: true } } } },
      },
      orderBy: { paidAt: "asc" },
    });

    // Get detailed expense breakdown
    const expensesList = await db.expense.findMany({
      where: {
        landlordId,
        propertyId: { in: propertyIds },
        date: { gte: payout.periodStart, lte: payout.periodEnd },
      },
      include: { property: { select: { name: true } } },
      orderBy: { date: "asc" },
    });

    // Count ACH payments for the breakdown display
    const achCount = await db.payment.count({
      where: {
        landlordId,
        status: "COMPLETED",
        paymentMethod: "ach",
        unit: { propertyId: { in: propertyIds } },
        paidAt: { gte: payout.periodStart, lte: payout.periodEnd },
      },
    });

    return NextResponse.json({
      ...payout,
      grossRent: Number(payout.grossRent),
      processingFees: Number(payout.processingFees),
      managementFee: Number(payout.managementFee),
      expenses: Number(payout.expenses),
      platformFee: Number(payout.platformFee),
      netPayout: Number(payout.netPayout),
      achRate: Number(payout.achRate ?? 6),
      payoutFee: Number(payout.payoutFee),
      payoutFeeRate: Number(payout.payoutFeeRate ?? 0),
      unitFee: Number(payout.unitFee ?? 0),
      achCount,
      ownerHasBank: !!(payout.owner.kadimaCustomerId && payout.owner.bankAccountLast4),
      owner: {
        ...payout.owner,
        managementFeePercent: Number(payout.owner.managementFeePercent),
      },
      paymentDetails: payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paymentMethod: p.paymentMethod,
        paidAt: p.paidAt,
        tenant: p.tenant.user.name,
        unit: p.unit.unitNumber,
        property: p.unit.property.name,
      })),
      expenseDetails: expensesList.map((e) => ({
        id: e.id,
        amount: Number(e.amount),
        category: e.category,
        description: e.description,
        vendor: e.vendor,
        date: e.date,
        property: e.property.name,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch payout" }, { status: 500 });
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
    const payout = await db.ownerPayout.findFirst({ where: { id, landlordId } });
    if (!payout) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404 });
    }
    if (payout.status !== "DRAFT") {
      return NextResponse.json({ error: "Can only edit DRAFT payouts" }, { status: 400 });
    }

    const body = await req.json();
    const {
      managementFeePercent,
      achRate,
      processingFees,
      managementFee,
      expenses,
      platformFee,
      payoutFeeRate,
      notes,
    } = body;

    // Validate ACH rate
    if (achRate !== undefined && achRate < 0) {
      return NextResponse.json({ error: "ACH rate must be $0 or greater" }, { status: 400 });
    }

    // Validate payout fee rate
    if (payoutFeeRate !== undefined && (payoutFeeRate < 0.0015 || payoutFeeRate > 0.005)) {
      return NextResponse.json({ error: "Payout fee rate must be between 0.0015 and 0.005" }, { status: 400 });
    }

    const grossRent = Number(payout.grossRent);
    const updatedProcessingFees = processingFees ?? Number(payout.processingFees);
    const updatedManagementFee = managementFee ?? Number(payout.managementFee);
    const updatedExpenses = expenses ?? Number(payout.expenses);
    const updatedPlatformFee = platformFee ?? Number(payout.platformFee);
    const updatedUnitFee = Number(payout.unitFee ?? 0);

    // Recalculate payout fee based on rate
    const updatedPayoutFeeRate = payoutFeeRate ?? Number(payout.payoutFeeRate ?? 0);
    const payoutFee = Math.round(grossRent * updatedPayoutFeeRate * 100) / 100;

    // Recalculate net payout — payoutFee and unitFee are NOW deducted
    const netPayout = Math.max(0, grossRent - updatedProcessingFees - updatedManagementFee - updatedExpenses - payoutFee - updatedUnitFee);

    const updated = await db.ownerPayout.update({
      where: { id },
      data: {
        processingFees: updatedProcessingFees,
        managementFee: updatedManagementFee,
        expenses: updatedExpenses,
        platformFee: updatedPlatformFee,
        netPayout,
        achRate: achRate ?? (payout.achRate ? Number(payout.achRate) : 6),
        payoutFee,
        payoutFeeRate: updatedPayoutFeeRate,
        unitFee: updatedUnitFee,
        notes: notes ?? payout.notes,
      },
    });

    auditLog({
      userId: session.user.id,
      userName: session.user.name,
      userRole: session.user.role,
      action: "UPDATE",
      objectType: "Payout",
      objectId: id,
      description: "Edited draft payout fees",
      oldValue: {
        processingFees: Number(payout.processingFees),
        managementFee: Number(payout.managementFee),
        expenses: Number(payout.expenses),
        platformFee: Number(payout.platformFee),
        payoutFeeRate: Number(payout.payoutFeeRate ?? 0),
        netPayout: Number(payout.netPayout),
      },
      newValue: {
        processingFees: updatedProcessingFees,
        managementFee: updatedManagementFee,
        expenses: updatedExpenses,
        platformFee: updatedPlatformFee,
        payoutFeeRate: updatedPayoutFeeRate,
        netPayout,
      },
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
      achRate: Number(updated.achRate ?? 6),
      payoutFee: Number(updated.payoutFee),
      payoutFeeRate: Number(updated.payoutFeeRate ?? 0),
      unitFee: Number(updated.unitFee ?? 0),
    });
  } catch (e) {
    console.error("Payout update error:", e);
    return NextResponse.json({ error: "Failed to update payout" }, { status: 500 });
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
    const payout = await db.ownerPayout.findFirst({ where: { id, landlordId } });
    if (!payout) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404 });
    }
    if (payout.status !== "DRAFT") {
      return NextResponse.json({ error: "Can only delete DRAFT payouts" }, { status: 400 });
    }

    await db.ownerPayout.delete({ where: { id } });

    auditLog({
      userId: session.user.id,
      userName: session.user.name,
      userRole: session.user.role,
      action: "DELETE",
      objectType: "Payout",
      objectId: id,
      description: `Deleted draft payout (net: $${Number(payout.netPayout).toFixed(2)})`,
      req: _req,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete payout" }, { status: 500 });
  }
}

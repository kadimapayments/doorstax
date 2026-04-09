import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { auditLog } from "@/lib/audit";
import { notify } from "@/lib/notifications";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
    if (payout.status !== "APPROVED") {
      return NextResponse.json({ error: "Only APPROVED payouts can be marked as paid" }, { status: 400 });
    }

    const body = await req.json();
    const paymentMethod = body.paymentMethod || "manual";
    const notes = body.notes || null;

    const updated = await db.ownerPayout.update({
      where: { id },
      data: {
        status: "PAID",
        paymentMethod,
        paidAt: new Date(),
        notes,
      },
    });

    auditLog({
      userId: session.user.id,
      userName: session.user.name,
      userRole: session.user.role,
      action: "UPDATE",
      objectType: "Payout",
      objectId: id,
      description: `Marked payout as paid (${paymentMethod})`,
      newValue: { status: "PAID", paymentMethod, notes },
      req,
    });

    // Notify owner if they have a portal account
    const owner = await db.owner.findUnique({
      where: { id: payout.ownerId },
      select: { userId: true, name: true },
    });
    if (owner?.userId) {
      notify({
        userId: owner.userId,
        createdById: session.user.id,
        type: "PAYOUT_PAID",
        title: "Your Payout Has Been Processed",
        message: `Your payout of $${Number(updated.netPayout).toFixed(2)} has been marked as paid.`,
        severity: "info",
        amount: Number(updated.netPayout),
      }).catch(() => {});
    }

    // ── Accounting: auto-create payout journal entry ──
    try {
      const { seedDefaultAccounts } = await import("@/lib/accounting/chart-of-accounts");
      await seedDefaultAccounts(landlordId);
      const { journalOwnerPayout } = await import("@/lib/accounting/auto-entries");
      journalOwnerPayout({
        pmId: landlordId,
        payoutId: id,
        amount: Number(updated.netPayout),
        managementFee: Number(updated.managementFee),
        date: new Date(),
        propertyId: undefined,
        ownerId: updated.ownerId,
      }).catch((e) => console.error("[accounting] Payout journal failed:", e));
    } catch (e) {
      console.error("[accounting] Trigger error:", e);
    }

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
    return NextResponse.json({ error: "Failed to mark payout as paid" }, { status: 500 });
  }
}

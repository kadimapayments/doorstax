import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { auditLog } from "@/lib/audit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["PM", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const landlordId = await getEffectiveLandlordId(session.user.id);
  const body = await req.json().catch(() => ({}));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reason = (body as any).reason;
  if (!reason || !String(reason).trim()) {
    return NextResponse.json({ error: "A reason is required when voiding a payment" }, { status: 400 });
  }

  const payment = await db.payment.findFirst({
    where: { id, landlordId, status: { in: ["PENDING", "FAILED"] } },
    select: { id: true, amount: true, tenantId: true, unitId: true, description: true, type: true },
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment not found or already processed" }, { status: 404 });
  }

  await db.payment.update({
    where: { id },
    data: {
      status: "REFUNDED",
      kadimaStatus: "voided",
      declineReasonCode: String(reason).trim(),
    },
  });

  // Also update linked expense if one exists
  await db.expense.updateMany({
    where: { paymentId: id },
    data: { status: "WRITTEN_OFF" },
  });

  // Record in the immutable ledger
  try {
    const { periodKeyFromDate } = await import("@/lib/ledger");

    // Get current balance
    const lastEntry = await db.ledgerEntry.findFirst({
      where: { tenantId: payment.tenantId },
      orderBy: { createdAt: "desc" },
      select: { balanceAfter: true },
    });
    const currentBalance = lastEntry ? Number(lastEntry.balanceAfter) : 0;
    const creditAmount = -Math.abs(Number(payment.amount));

    await db.ledgerEntry.create({
      data: {
        tenantId: payment.tenantId,
        unitId: payment.unitId,
        type: "REVERSAL",
        amount: creditAmount,
        balanceAfter: currentBalance + creditAmount,
        periodKey: periodKeyFromDate(new Date()),
        description: `Voided: ${payment.description || payment.type} — Reason: ${String(reason).trim()}`,
        paymentId: payment.id,
        createdById: session.user.id,
      },
    });
  } catch (ledgerErr) {
    console.error("[void] Ledger entry failed:", ledgerErr);
    // Non-blocking — the void still succeeds
  }

  auditLog({
    userId: session.user.id,
    userName: session.user.name,
    userRole: session.user.role,
    action: "VOID",
    objectType: "Payment",
    objectId: id,
    description: `Voided payment: ${String(reason).trim()} ($${Number(payment.amount).toFixed(2)})`,
    req,
  });

  return NextResponse.json({ success: true });
}

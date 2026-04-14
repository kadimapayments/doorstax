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
    select: {
      id: true,
      amount: true,
      tenantId: true,
      unitId: true,
      description: true,
      type: true,
      kadimaTransactionId: true,
      paymentMethod: true,
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment not found or already processed" }, { status: 404 });
  }

  // ─── Call Kadima to void the transaction if one exists ─────
  let kadimaVoided = false;
  if (payment.kadimaTransactionId) {
    try {
      if (payment.paymentMethod === "card") {
        // Card transaction — use merchant-scoped void
        const { getMerchantCredentialsForTenant } = await import("@/lib/kadima/merchant-context");
        const { merchantVoidTransaction } = await import("@/lib/kadima/merchant-gateway");
        const creds = await getMerchantCredentialsForTenant(payment.tenantId);
        await merchantVoidTransaction(creds, payment.kadimaTransactionId);
        kadimaVoided = true;
        console.log("[void] Kadima card void success:", payment.kadimaTransactionId);
      } else if (payment.paymentMethod === "ach") {
        // ACH — void via ACH service if still pending
        // Note: ACH voids may not be supported after settlement; log and continue
        console.log("[void] ACH void — gateway void not available for ACH, local-only:", payment.kadimaTransactionId);
      }
    } catch (err) {
      console.error("[void] Kadima void failed (continuing with local void):", err);
      // Continue — PM can reconcile manually. The local void still records the intent.
    }
  }

  await db.payment.update({
    where: { id },
    data: {
      status: "REFUNDED",
      kadimaStatus: kadimaVoided ? "voided" : "voided_local",
      declineReasonCode: String(reason).trim(),
      failedReason: `Voided: ${String(reason).trim()}`,
      processedAt: new Date(),
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
        description: `Voided: ${payment.description || payment.type} — Reason: ${String(reason).trim()}${kadimaVoided ? " (gateway voided)" : ""}`,
        paymentId: payment.id,
        createdById: session.user.id,
      },
    });
  } catch (ledgerErr) {
    console.error("[void] Ledger entry failed:", ledgerErr);
    // Non-blocking — the void still succeeds
  }

  // ── Accounting: auto-create void journal entry ──
  try {
    const { seedDefaultAccounts } = await import("@/lib/accounting/chart-of-accounts");
    await seedDefaultAccounts(landlordId);
    const { journalRefund } = await import("@/lib/accounting/auto-entries");
    journalRefund({
      pmId: landlordId,
      paymentId: id,
      amount: Number(payment.amount),
      date: new Date(),
      tenantId: payment.tenantId,
      isPartial: false,
    }).catch((e) => console.error("[accounting] Void journal failed:", e));
  } catch (e) {
    console.error("[accounting] Trigger error:", e);
  }

  auditLog({
    userId: session.user.id,
    userName: session.user.name,
    userRole: session.user.role,
    action: "VOID",
    objectType: "Payment",
    objectId: id,
    description: `Voided payment: ${String(reason).trim()} ($${Number(payment.amount).toFixed(2)})${kadimaVoided ? " — gateway voided" : ""}`,
    req,
  });

  return NextResponse.json({ success: true, kadimaVoided });
}

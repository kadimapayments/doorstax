import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { auditLog } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { paymentRefundedHtml } from "@/lib/emails/payment-refunded";

/**
 * POST /api/payments/:id/refund
 * Refund a COMPLETED payment back to the tenant's card/bank via Kadima.
 * Supports partial refunds — tracks cumulative refundedAmount to prevent over-refunds.
 * Creates a REVERSAL ledger entry and notifies the tenant.
 */
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const partialAmount = (body as any).amount;

  if (!reason || !String(reason).trim()) {
    return NextResponse.json({ error: "A reason is required for refunds" }, { status: 400 });
  }

  const payment = await db.payment.findFirst({
    where: { id, landlordId, status: "COMPLETED" },
    include: {
      tenant: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          unit: { select: { id: true, unitNumber: true, property: { select: { name: true } } } },
        },
      },
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment not found or not eligible for refund" }, { status: 404 });
  }

  // ─── Calculate refund amount & prevent over-refund ─────────
  const paymentTotal = Number(payment.amount);
  const alreadyRefunded = Number(payment.refundedAmount || 0);
  const remainingRefundable = paymentTotal - alreadyRefunded;

  const refundAmount = partialAmount ? Number(partialAmount) : remainingRefundable;

  if (refundAmount <= 0) {
    return NextResponse.json({ error: "Invalid refund amount" }, { status: 400 });
  }
  if (refundAmount > remainingRefundable) {
    return NextResponse.json(
      {
        error: `Refund amount ($${refundAmount.toFixed(2)}) exceeds remaining refundable balance ($${remainingRefundable.toFixed(2)})`,
        alreadyRefunded,
        remainingRefundable,
      },
      { status: 400 }
    );
  }

  const isFullRefund = (alreadyRefunded + refundAmount) >= paymentTotal;

  // ─── Attempt Kadima refund if there's a transaction ID ─────
  let kadimaRefundId: string | null = null;
  if (payment.kadimaTransactionId) {
    try {
      if (payment.paymentMethod === "card") {
        const { getMerchantCredentialsForTenant } = await import("@/lib/kadima/merchant-context");
        const { merchantRefundTransaction } = await import("@/lib/kadima/merchant-gateway");
        const creds = await getMerchantCredentialsForTenant(payment.tenantId);
        const result = await merchantRefundTransaction(creds, payment.kadimaTransactionId, refundAmount);
        kadimaRefundId = result?.id ? String(result.id) : null;
        console.log("[refund] Kadima card refund:", kadimaRefundId);
      } else if (payment.paymentMethod === "ach") {
        // ACH refunds go through the ACH return process
        console.log("[refund] ACH refund — manual Kadima process required for:", payment.kadimaTransactionId);
      }
    } catch (err) {
      console.error("[refund] Kadima refund failed:", err);
      // Continue with local refund — PM can process Kadima manually
    }
  }

  // ─── Update payment status + cumulative refundedAmount ─────
  const newRefundedTotal = alreadyRefunded + refundAmount;
  await db.payment.update({
    where: { id },
    data: {
      // Only mark as REFUNDED if fully refunded
      status: isFullRefund ? "REFUNDED" : "COMPLETED",
      kadimaStatus: kadimaRefundId
        ? (isFullRefund ? "refunded" : "partially_refunded")
        : (isFullRefund ? "refunded_local" : "partially_refunded_local"),
      refundedAmount: newRefundedTotal,
      processedAt: new Date(),
      ...(isFullRefund
        ? { declineReasonCode: `Refund: ${String(reason).trim()}` }
        : {}),
    },
  });

  // ─── Create ledger REVERSAL entry (exact refund amount) ────
  try {
    const { periodKeyFromDate } = await import("@/lib/ledger");
    const lastEntry = await db.ledgerEntry.findFirst({
      where: { tenantId: payment.tenantId },
      orderBy: { createdAt: "desc" },
      select: { balanceAfter: true },
    });
    const previousBalance = lastEntry ? Number(lastEntry.balanceAfter) : 0;

    await db.ledgerEntry.create({
      data: {
        tenantId: payment.tenantId,
        unitId: payment.unitId,
        type: "REVERSAL",
        amount: -refundAmount,
        balanceAfter: previousBalance - refundAmount,
        periodKey: periodKeyFromDate(new Date()),
        description: `${isFullRefund ? "Full refund" : `Partial refund ($${refundAmount.toFixed(2)} of $${paymentTotal.toFixed(2)})`}: ${payment.description || payment.type} — ${String(reason).trim()}`,
        paymentId: payment.id,
        createdById: session.user.id,
      },
    });
  } catch (err) {
    console.error("[refund] Ledger entry failed:", err);
  }

  // Update linked expense if full refund
  if (isFullRefund) {
    await db.expense.updateMany({
      where: { paymentId: id },
      data: { status: "WRITTEN_OFF" },
    });
  }

  // Notify tenant
  if (payment.tenant?.user?.email) {
    const methodDisplay = payment.paymentMethod === "card" && payment.cardLast4
      ? `${payment.cardBrand ? payment.cardBrand.charAt(0).toUpperCase() + payment.cardBrand.slice(1) + " " : "Card "}•••• ${payment.cardLast4}`
      : payment.paymentMethod === "ach" && payment.achLast4
        ? `Bank account •••• ${payment.achLast4}`
        : payment.paymentMethod?.toUpperCase() || "N/A";

    notify({
      userId: payment.tenant.user.id,
      createdById: session.user.id,
      type: "PAYMENT_REFUNDED",
      title: "Payment Refunded",
      message: `A refund of $${refundAmount.toFixed(2)} has been issued for ${payment.description || "your payment"}.`,
      severity: "info",
      amount: refundAmount,
      email: {
        to: payment.tenant.user.email,
        subject: `Payment Refunded — $${refundAmount.toFixed(2)}`,
        html: paymentRefundedHtml({
          tenantName: payment.tenant.user.name || "Tenant",
          amount: `$${refundAmount.toFixed(2)}`,
          originalDate: payment.paidAt ? payment.paidAt.toLocaleDateString() : "N/A",
          refundDate: new Date().toLocaleDateString(),
          paymentMethod: methodDisplay,
          propertyName: payment.tenant.unit?.property?.name || "Your Property",
          reason: String(reason).trim(),
        }),
      },
    }).catch(console.error);
  }

  // ── Accounting: auto-create refund journal entry ──
  try {
    const { seedDefaultAccounts } = await import("@/lib/accounting/chart-of-accounts");
    await seedDefaultAccounts(landlordId);
    const { journalRefund } = await import("@/lib/accounting/auto-entries");
    journalRefund({
      pmId: landlordId,
      paymentId: id,
      amount: refundAmount,
      date: new Date(),
      propertyId: payment.unitId ? (await db.unit.findUnique({ where: { id: payment.unitId }, select: { propertyId: true } }))?.propertyId : undefined,
      tenantId: payment.tenantId,
      isPartial: !isFullRefund,
    }).catch((e) => console.error("[accounting] Refund journal failed:", e));
  } catch (e) {
    console.error("[accounting] Trigger error:", e);
  }

  auditLog({
    userId: session.user.id,
    userName: session.user.name,
    userRole: session.user.role,
    action: "REFUND",
    objectType: "Payment",
    objectId: id,
    description: `${isFullRefund ? "Full" : "Partial"} refund $${refundAmount.toFixed(2)} (total refunded: $${newRefundedTotal.toFixed(2)}/${paymentTotal.toFixed(2)}): ${String(reason).trim()}${kadimaRefundId ? ` (Kadima: ${kadimaRefundId})` : ""}`,
    req,
  });

  return NextResponse.json({
    success: true,
    kadimaRefundId,
    refundAmount,
    totalRefunded: newRefundedTotal,
    remainingRefundable: paymentTotal - newRefundedTotal,
    isFullRefund,
  });
}

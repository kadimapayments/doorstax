import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";

/**
 * POST /api/admin/billing/[invoiceId]
 * Actions: apply-credit, adjust-amount, waive-invoice, mark-paid
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:payments")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { invoiceId } = await params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  const invoice = await db.billingInvoice.findUnique({
    where: { id: invoiceId },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  switch (action) {
    case "apply-credit": {
      const amount = Number(body.amount);
      const reason = String(body.reason || "Admin credit");
      if (!amount || amount <= 0) {
        return NextResponse.json(
          { error: "Amount must be positive" },
          { status: 400 }
        );
      }
      const newCredit = invoice.creditAmount + amount;
      const newNet = invoice.amount - newCredit - invoice.adjustmentAmount;
      await db.billingInvoice.update({
        where: { id: invoiceId },
        data: {
          creditAmount: newCredit,
          creditReason: invoice.creditReason
            ? `${invoice.creditReason}; $${amount.toFixed(2)}: ${reason}`
            : `$${amount.toFixed(2)}: ${reason}`,
          creditApprovedBy: session.user.id,
          netAmount: Math.max(0, newNet),
        },
      });
      await logAudit(session.user.id, invoice.userId, "apply-credit", {
        invoiceId,
        amount,
        reason,
      });
      return NextResponse.json({ ok: true });
    }

    case "adjust-amount": {
      const amount = Number(body.amount) || 0;
      const reason = String(body.reason || "Admin adjustment");
      const newNet = invoice.amount - invoice.creditAmount - amount;
      await db.billingInvoice.update({
        where: { id: invoiceId },
        data: {
          adjustmentAmount: amount,
          adjustmentReason: reason,
          adjustmentApprovedBy: session.user.id,
          netAmount: Math.max(0, newNet),
        },
      });
      await logAudit(session.user.id, invoice.userId, "adjust-amount", {
        invoiceId,
        amount,
        reason,
      });
      return NextResponse.json({ ok: true });
    }

    case "waive-invoice": {
      const reason = String(body.reason || "Admin waiver");
      await db.billingInvoice.update({
        where: { id: invoiceId },
        data: {
          status: "WAIVED",
          creditAmount: invoice.amount,
          creditReason: `Invoice waived: ${reason}`,
          creditApprovedBy: session.user.id,
          netAmount: 0,
        },
      });
      try {
        const { notify } = await import("@/lib/notifications");
        await notify({
          userId: invoice.userId,
          createdById: session.user.id,
          type: "INVOICE_WAIVED",
          title: "Invoice Waived",
          message: `Your invoice ${invoice.invoiceNumber} for ${invoice.period} has been waived.`,
          severity: "info",
          actionUrl: "/dashboard/billing",
        }).catch(console.error);
      } catch {}
      await logAudit(session.user.id, invoice.userId, "waive-invoice", {
        invoiceId,
        reason,
      });
      return NextResponse.json({ ok: true });
    }

    case "mark-paid": {
      const method = String(body.paymentMethod || "Manual (admin)");
      await db.billingInvoice.update({
        where: { id: invoiceId },
        data: {
          status: "PAID",
          paidAt: new Date(),
          paymentMethod: method,
        },
      });
      await logAudit(session.user.id, invoice.userId, "mark-paid", {
        invoiceId,
        method,
      });
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logAudit(
  adminId: string,
  targetUserId: string,
  action: string,
  details: Record<string, unknown>
) {
  try {
    await db.auditLog.create({
      data: {
        userId: adminId,
        action: `BILLING:${action.toUpperCase()}`,
        objectType: "BillingInvoice",
        objectId: details.invoiceId as string,
        description: `Admin billing action: ${action}`,
        newValue: JSON.parse(JSON.stringify(details)),
      },
    });
  } catch {}
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";
import { createSaleFromVault } from "@/lib/kadima/gateway";

/**
 * POST /api/admin/billing/[invoiceId]
 * Actions: apply-credit, adjust-amount, waive-invoice, mark-paid, charge-now
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

    case "charge-now": {
      // Admin-initiated platform billing charge: runs the invoice's netAmount
      // against the PM's DoorStax-vault card using the platform Kadima creds.
      //
      // Guards:
      //   - only PENDING or FAILED invoices (PAID/WAIVED must not retry)
      //   - PM must have both kadimaCustomerId and kadimaCardTokenId set
      //     (provisioned during onboarding via createDoorstaxCustomer)
      //   - netAmount must be > 0 (zero-dollar invoices are a no-op here;
      //     they should be marked paid via mark-paid or waived)
      if (invoice.status === "PAID" || invoice.status === "WAIVED") {
        return NextResponse.json(
          { error: `Invoice is already ${invoice.status.toLowerCase()}` },
          { status: 409 }
        );
      }
      if (invoice.netAmount <= 0) {
        return NextResponse.json(
          {
            error:
              "Invoice net amount is zero. Mark it paid or waive it — no charge needed.",
          },
          { status: 400 }
        );
      }

      const pm = await db.user.findUnique({
        where: { id: invoice.userId },
        select: {
          name: true,
          email: true,
          kadimaCustomerId: true,
          kadimaCardTokenId: true,
        },
      });
      if (!pm?.kadimaCardTokenId) {
        return NextResponse.json(
          {
            error:
              "PM has no saved DoorStax billing card. Ask them to add one from Settings → Billing before you can charge.",
          },
          { status: 400 }
        );
      }

      // Call the gateway. Uses DoorStax platform MID / KADIMA_TERMINAL_ID.
      let gatewayResult;
      try {
        gatewayResult = await createSaleFromVault({
          cardToken: pm.kadimaCardTokenId,
          amount: invoice.netAmount,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Gateway error";
        await db.billingInvoice.update({
          where: { id: invoiceId },
          data: {
            status: "FAILED",
            failedReason: errMsg,
          },
        });
        await logAudit(session.user.id, invoice.userId, "charge-now", {
          invoiceId,
          amount: invoice.netAmount,
          success: false,
          error: errMsg,
        });
        return NextResponse.json(
          {
            ok: false,
            error: `Gateway error: ${errMsg}`,
          },
          { status: 502 }
        );
      }

      const approved = gatewayResult.status?.status === "Approved";

      if (approved) {
        await db.billingInvoice.update({
          where: { id: invoiceId },
          data: {
            status: "PAID",
            paidAt: new Date(),
            paymentMethod: "Card (admin Charge Now)",
            kadimaTransactionId: String(gatewayResult.id),
            failedReason: null,
          },
        });
        try {
          const { notify } = await import("@/lib/notifications");
          await notify({
            userId: invoice.userId,
            createdById: session.user.id,
            type: "SYSTEM",
            title: "Invoice Paid",
            message: `Your DoorStax invoice ${invoice.invoiceNumber} for ${invoice.period} ($${invoice.netAmount.toFixed(2)}) has been charged successfully.`,
            severity: "info",
            actionUrl: "/dashboard/billing",
          }).catch(console.error);
        } catch {}
        await logAudit(session.user.id, invoice.userId, "charge-now", {
          invoiceId,
          amount: invoice.netAmount,
          success: true,
          transactionId: gatewayResult.id,
        });
        return NextResponse.json({
          ok: true,
          charged: true,
          transactionId: String(gatewayResult.id),
        });
      }

      // Declined or error
      const declineReason =
        gatewayResult.status?.reason ||
        gatewayResult.status?.status ||
        "Declined";
      await db.billingInvoice.update({
        where: { id: invoiceId },
        data: {
          status: "FAILED",
          failedReason: `Gateway declined: ${declineReason}`,
          kadimaTransactionId: String(gatewayResult.id),
        },
      });
      await logAudit(session.user.id, invoice.userId, "charge-now", {
        invoiceId,
        amount: invoice.netAmount,
        success: false,
        declineReason,
        transactionId: gatewayResult.id,
      });
      return NextResponse.json(
        {
          ok: false,
          charged: false,
          error: `Card declined: ${declineReason}`,
        },
        { status: 402 }
      );
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

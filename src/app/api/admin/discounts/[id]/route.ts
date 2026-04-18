export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext } from "@/lib/admin-context";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit";

/**
 * POST /api/admin/discounts/[id]
 *
 * Actions: approve | reject | revoke
 *
 * Admin-only (owner or SUPER_ADMIN). On approve, a ONE_TIME_INVOICE
 * discount is applied to the target BillingInvoice by incrementing
 * creditAmount — the same plumbing used by /api/admin/billing's
 * `apply-credit` action. A RECURRING_SUBSCRIPTION discount sets
 * Subscription.activeDiscountId and is picked up by the billing cron.
 *
 * Revoke unlinks a recurring discount from any subscriptions.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ctx = await getAdminContext(session.user.id);
  // Approval gate: owner (no staff record) or SUPER_ADMIN
  const canApprove = !ctx.isStaff || ctx.adminRole === "SUPER_ADMIN";
  if (!canApprove) {
    return NextResponse.json(
      { error: "Only SUPER_ADMIN / owner can act on discount requests" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    action?: "approve" | "reject" | "revoke";
    rejectionNote?: string;
  };

  const discount = await db.discountRequest.findUnique({
    where: { id },
    include: { invoice: true },
  });
  if (!discount) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.action === "reject") {
    if (discount.status !== "PENDING_APPROVAL") {
      return NextResponse.json(
        { error: `Can't reject a ${discount.status} request` },
        { status: 400 }
      );
    }
    const note = String(body.rejectionNote || "").trim();
    if (!note) {
      return NextResponse.json(
        { error: "rejectionNote is required" },
        { status: 400 }
      );
    }
    const updated = await db.discountRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectionNote: note,
        approvedById: session.user.id,
        approvedAt: new Date(),
      },
    });
    auditLog({
      userId: session.user.id,
      userRole: "ADMIN",
      action: "REJECT",
      objectType: "DiscountRequest",
      objectId: id,
      description: `Rejected: ${note}`,
      req,
    });
    return NextResponse.json({ discount: updated });
  }

  if (body.action === "approve") {
    if (discount.status !== "PENDING_APPROVAL") {
      return NextResponse.json(
        { error: `Can't approve a ${discount.status} request` },
        { status: 400 }
      );
    }

    const amount = Number(discount.amount);

    if (discount.type === "ONE_TIME_INVOICE") {
      if (!discount.invoiceId || !discount.invoice) {
        return NextResponse.json(
          { error: "Invoice no longer available" },
          { status: 400 }
        );
      }
      const invoice = discount.invoice;
      // Apply credit using the same math as /api/admin/billing apply-credit
      const newCredit = invoice.creditAmount + amount;
      const newNet = invoice.amount - newCredit - invoice.adjustmentAmount;
      const creditReason = `Discount approved: ${discount.reason}`;

      const updated = await db.$transaction(async (tx) => {
        await tx.billingInvoice.update({
          where: { id: invoice.id },
          data: {
            creditAmount: newCredit,
            creditReason: invoice.creditReason
              ? `${invoice.creditReason}; $${amount.toFixed(2)}: ${creditReason}`
              : `$${amount.toFixed(2)}: ${creditReason}`,
            creditApprovedBy: session.user.id,
            netAmount: Math.max(0, newNet),
          },
        });
        return tx.discountRequest.update({
          where: { id },
          data: {
            status: "APPLIED",
            approvedById: session.user.id,
            approvedAt: new Date(),
          },
        });
      });

      auditLog({
        userId: session.user.id,
        userRole: "ADMIN",
        action: "APPROVE",
        objectType: "DiscountRequest",
        objectId: id,
        description: `Approved $${amount.toFixed(2)} one-time credit on invoice ${invoice.invoiceNumber}`,
        req,
      });

      return NextResponse.json({ discount: updated });
    }

    // RECURRING_SUBSCRIPTION — activate on the target PM's subscription
    const subscription = await db.subscription.findUnique({
      where: { userId: discount.targetUserId },
      select: { id: true },
    });
    if (!subscription) {
      return NextResponse.json(
        { error: "Target PM has no subscription" },
        { status: 400 }
      );
    }

    const updated = await db.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { activeDiscountId: id },
      });
      return tx.discountRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedById: session.user.id,
          approvedAt: new Date(),
          // If no startsAt provided, start today
          startsAt: discount.startsAt ?? new Date(),
        },
      });
    });

    auditLog({
      userId: session.user.id,
      userRole: "ADMIN",
      action: "APPROVE",
      objectType: "DiscountRequest",
      objectId: id,
      description: `Approved recurring ${amount}% discount on PM subscription`,
      req,
    });

    return NextResponse.json({ discount: updated });
  }

  if (body.action === "revoke") {
    if (discount.status !== "APPROVED" && discount.status !== "APPLIED") {
      return NextResponse.json(
        { error: `Can't revoke a ${discount.status} request` },
        { status: 400 }
      );
    }
    const updated = await db.$transaction(async (tx) => {
      // Unlink from any subscriptions currently using this discount
      await tx.subscription.updateMany({
        where: { activeDiscountId: id },
        data: { activeDiscountId: null },
      });
      return tx.discountRequest.update({
        where: { id },
        data: {
          status: "REVOKED",
          endsAt: new Date(),
        },
      });
    });

    auditLog({
      userId: session.user.id,
      userRole: "ADMIN",
      action: "REVOKE",
      objectType: "DiscountRequest",
      objectId: id,
      description: `Revoked discount (${discount.type})`,
      req,
    });

    return NextResponse.json({ discount: updated });
  }

  return NextResponse.json(
    { error: "Unknown action — expected approve | reject | revoke" },
    { status: 400 }
  );
}

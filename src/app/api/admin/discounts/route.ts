export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit";

/**
 * GET  /api/admin/discounts — list + filter (status, PM)
 * POST /api/admin/discounts — draft a PENDING_APPROVAL request
 *
 * Any billing-scoped staff can draft. Approval is gated in [id]/route.ts
 * to owner / SUPER_ADMIN.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ctx = await getAdminContext(session.user.id);
  if (!canAdmin(ctx, "admin:payments") && !canAdmin(ctx, "admin:expenses")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status") || undefined;
  const targetUserId = req.nextUrl.searchParams.get("pm") || undefined;

  const discounts = await db.discountRequest.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(targetUserId ? { targetUserId } : {}),
    },
    include: {
      targetUser: {
        select: { id: true, name: true, email: true, companyName: true },
      },
      requestedBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true } },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          period: true,
          amount: true,
          netAmount: true,
        },
      },
    },
    orderBy: [{ requestedAt: "desc" }],
    take: 200,
  });

  const counts = await db.discountRequest.groupBy({
    by: ["status"],
    _count: true,
  });
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count]));

  return NextResponse.json({ discounts, counts: byStatus });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ctx = await getAdminContext(session.user.id);
  if (!canAdmin(ctx, "admin:payments") && !canAdmin(ctx, "admin:expenses")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    targetUserId?: string;
    type?: "ONE_TIME_INVOICE" | "RECURRING_SUBSCRIPTION";
    invoiceId?: string;
    amount?: number | string;
    reason?: string;
    startsAt?: string;
    endsAt?: string;
  };

  if (!body.targetUserId) {
    return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
  }
  if (body.type !== "ONE_TIME_INVOICE" && body.type !== "RECURRING_SUBSCRIPTION") {
    return NextResponse.json(
      { error: "type must be ONE_TIME_INVOICE or RECURRING_SUBSCRIPTION" },
      { status: 400 }
    );
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount must be > 0" }, { status: 400 });
  }
  if (body.type === "RECURRING_SUBSCRIPTION" && amount > 100) {
    return NextResponse.json(
      { error: "Recurring percent must be 0-100" },
      { status: 400 }
    );
  }
  const reason = String(body.reason || "").trim();
  if (!reason) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  // ONE_TIME requires a target invoice
  if (body.type === "ONE_TIME_INVOICE") {
    if (!body.invoiceId) {
      return NextResponse.json(
        { error: "invoiceId is required for ONE_TIME_INVOICE" },
        { status: 400 }
      );
    }
    const invoice = await db.billingInvoice.findUnique({
      where: { id: body.invoiceId },
      select: { id: true, userId: true, amount: true, creditAmount: true },
    });
    if (!invoice || invoice.userId !== body.targetUserId) {
      return NextResponse.json(
        { error: "Invoice not found for target PM" },
        { status: 400 }
      );
    }
    if (amount > invoice.amount) {
      return NextResponse.json(
        { error: "Discount exceeds invoice amount" },
        { status: 400 }
      );
    }
  }

  const target = await db.user.findUnique({
    where: { id: body.targetUserId },
    select: { id: true, role: true },
  });
  if (!target || target.role !== "PM") {
    return NextResponse.json(
      { error: "Target must be a PM user" },
      { status: 400 }
    );
  }

  const discount = await db.discountRequest.create({
    data: {
      targetUserId: body.targetUserId,
      type: body.type,
      invoiceId: body.type === "ONE_TIME_INVOICE" ? body.invoiceId! : null,
      amount,
      reason,
      status: "PENDING_APPROVAL",
      requestedById: session.user.id,
      startsAt:
        body.type === "RECURRING_SUBSCRIPTION" && body.startsAt
          ? new Date(body.startsAt)
          : null,
      endsAt:
        body.type === "RECURRING_SUBSCRIPTION" && body.endsAt
          ? new Date(body.endsAt)
          : null,
    },
  });

  auditLog({
    userId: session.user.id,
    userRole: "ADMIN",
    action: "CREATE",
    objectType: "DiscountRequest",
    objectId: discount.id,
    description: `Drafted ${body.type} discount: ${
      body.type === "ONE_TIME_INVOICE"
        ? `$${amount.toFixed(2)}`
        : `${amount}%`
    } — ${reason}`,
    req,
  });

  return NextResponse.json({ discount }, { status: 201 });
}

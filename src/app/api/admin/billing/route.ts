export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";

/**
 * GET /api/admin/billing
 *
 * Cross-PM billing dashboard data.
 *
 * Query params:
 *   period=YYYY-MM        — scope invoices to this billing period (default: current month)
 *   status=PENDING|PAID|WAIVED|FAILED  — optional filter on invoices
 *   tier=Starter|Growth|Scale|Enterprise  — optional filter
 *
 * Returns:
 *   upcoming[]       — PENDING invoices with dueDate >= now
 *   period[]         — every invoice in the selected period (all statuses)
 *   subscriptions[]  — all subscriptions with user info
 *   totals           — { upcomingAmount, periodCollected, periodOutstanding,
 *                         activeSubscriptions, trialingSubscriptions, cancelledSubscriptions }
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:expenses")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const now = new Date();
  const defaultPeriod =
    now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  const period = url.searchParams.get("period") || defaultPeriod;
  const statusFilter = url.searchParams.get("status") || "";
  const tierFilter = url.searchParams.get("tier") || "";

  const [upcoming, periodInvoices, subs] = await Promise.all([
    db.billingInvoice.findMany({
      where: {
        status: "PENDING",
        dueDate: { gte: now },
        ...(tierFilter ? { tierName: tierFilter } : {}),
      },
      orderBy: { dueDate: "asc" },
      take: 100,
      include: {
        user: { select: { id: true, name: true, email: true, companyName: true } },
      },
    }),
    db.billingInvoice.findMany({
      where: {
        period,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(tierFilter ? { tierName: tierFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        user: { select: { id: true, name: true, email: true, companyName: true } },
      },
    }),
    db.subscription.findMany({
      orderBy: { nextBillingDate: "asc" },
      take: 500,
      include: {
        user: { select: { id: true, name: true, email: true, companyName: true, currentTier: true } },
      },
    }),
  ]);

  const totals = {
    upcomingAmount: upcoming.reduce((s, i) => s + i.netAmount, 0),
    periodCollected: periodInvoices
      .filter((i) => i.status === "PAID")
      .reduce((s, i) => s + i.netAmount, 0),
    periodOutstanding: periodInvoices
      .filter((i) => i.status === "PENDING" || i.status === "FAILED")
      .reduce((s, i) => s + i.netAmount, 0),
    activeSubscriptions: subs.filter((s) => s.status === "ACTIVE").length,
    trialingSubscriptions: subs.filter((s) => s.status === "TRIALING").length,
    cancelledSubscriptions: subs.filter((s) => s.status === "CANCELLED").length,
    pastDueSubscriptions: subs.filter((s) => s.status === "PAST_DUE").length,
  };

  const mapInvoice = (i: (typeof upcoming)[number]) => ({
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    period: i.period,
    pmId: i.userId,
    pmName: i.user?.companyName || i.user?.name || "Unknown",
    pmEmail: i.user?.email || "",
    tierName: i.tierName,
    unitCount: i.unitCount,
    amount: i.amount,
    creditAmount: i.creditAmount,
    adjustmentAmount: i.adjustmentAmount,
    netAmount: i.netAmount,
    status: i.status,
    dueDate: i.dueDate.toISOString(),
    paidAt: i.paidAt?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
  });

  return NextResponse.json({
    period,
    totals,
    upcoming: upcoming.map(mapInvoice),
    periodInvoices: periodInvoices.map(mapInvoice),
    subscriptions: subs.map((s) => ({
      id: s.id,
      pmId: s.userId,
      pmName: s.user?.companyName || s.user?.name || "Unknown",
      pmEmail: s.user?.email || "",
      tier: s.user?.currentTier || "Starter",
      status: s.status,
      currentAmount: Number(s.currentAmount),
      nextBillingDate: s.nextBillingDate.toISOString(),
      lastBillingDate: s.lastBillingDate?.toISOString() ?? null,
      trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
    })),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";

/**
 * GET /api/admin/impersonate?userId=xxx
 *
 * Returns the PM's full dashboard data for the admin "View as PM" page.
 * Read-only — does not switch sessions.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:landlords")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const pm = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      companyName: true,
      currentTier: true,
      createdAt: true,
    },
  });
  if (!pm) {
    return NextResponse.json({ error: "PM not found" }, { status: 404 });
  }

  const subscription = await db.subscription.findUnique({
    where: { userId },
    select: { status: true, trialEndsAt: true },
  });

  const properties = await db.property.findMany({
    where: { landlordId: userId },
    include: {
      units: {
        include: {
          tenantProfiles: {
            select: { user: { select: { name: true } } },
            take: 1,
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const unitCount = properties.reduce((s, p) => s + p.units.length, 0);
  const tenantCount = properties.reduce(
    (s, p) => s + p.units.filter((u) => u.tenantProfiles.length > 0).length,
    0
  );
  const occupancyRate =
    unitCount > 0 ? Math.round((tenantCount / unitCount) * 100) : 0;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const monthlyAgg = await db.payment.aggregate({
    where: {
      landlordId: userId,
      status: "COMPLETED",
      createdAt: { gte: startOfMonth },
    },
    _sum: { amount: true },
  });

  const recentPayments = await db.payment.findMany({
    where: { landlordId: userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      amount: true,
      paymentMethod: true,
      status: true,
      createdAt: true,
      tenant: { select: { user: { select: { name: true } } } },
    },
  });

  const merchantApp = await db.merchantApplication.findUnique({
    where: { userId },
    select: { status: true, kadimaAppId: true },
  });

  const ownerCount = await db.owner.count({
    where: { properties: { some: { landlordId: userId } } },
  });

  return NextResponse.json({
    ...pm,
    subscription,
    propertyCount: properties.length,
    unitCount,
    tenantCount,
    occupancyRate,
    monthlyRevenue: Number(monthlyAgg._sum.amount || 0),
    properties: properties.map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      city: p.city,
      state: p.state,
      zip: p.zip,
      units: p.units.map((u) => ({
        id: u.id,
        unitNumber: u.unitNumber,
        tenant: u.tenantProfiles[0]
          ? { name: u.tenantProfiles[0].user?.name || "Tenant" }
          : null,
      })),
    })),
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      tenantName: p.tenant?.user?.name || null,
    })),
    merchantApp,
    onboarding: {
      paymentMethod: !!subscription,
      owner: ownerCount > 0,
      property: properties.length > 0,
      unit: unitCount > 0,
      tenant: tenantCount > 0,
      merchantApplication: merchantApp?.status === "APPROVED",
    },
  });
}

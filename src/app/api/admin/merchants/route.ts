import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * GET /api/admin/merchants
 *
 * List every merchant application with PM, subscription, and portfolio
 * counts. Computes daysUntilExpiry / isExpiringSoon for the dashboard
 * countdown column.
 *
 * Query params:
 *   ?status=ALL|NOT_STARTED|IN_PROGRESS|SUBMITTED|APPROVED|EXPIRED|REJECTED
 *   ?search=<text>   matches PM name, email, business name, DBA
 *   ?sort=created|status|activity
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:landlords")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const statusFilter = (url.searchParams.get("status") || "ALL").toUpperCase();
  const search = (url.searchParams.get("search") || "").trim();
  const sort = url.searchParams.get("sort") || "created";

  const where: Prisma.MerchantApplicationWhereInput = {};
  if (statusFilter !== "ALL") {
    // Cast — Prisma will validate at runtime
    where.status = statusFilter as Prisma.MerchantApplicationWhereInput["status"];
  }
  if (search) {
    where.OR = [
      { businessLegalName: { contains: search, mode: "insensitive" } },
      { dba: { contains: search, mode: "insensitive" } },
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  let orderBy: Prisma.MerchantApplicationOrderByWithRelationInput = {
    createdAt: "desc",
  };
  if (sort === "status") orderBy = { status: "asc" };
  if (sort === "activity") orderBy = { updatedAt: "desc" };

  const apps = await db.merchantApplication.findMany({
    where,
    orderBy,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          companyName: true,
          subscription: {
            select: { status: true, trialEndsAt: true },
          },
          properties: {
            select: {
              id: true,
              kadimaTerminalId: true,
              units: { select: { id: true } },
            },
          },
        },
      },
    },
    take: 500,
  });

  const now = Date.now();
  const rows = apps.map((app) => {
    const ageDays = Math.floor(
      (now - app.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysUntilExpiry =
      app.status === "APPROVED" || app.status === "EXPIRED"
        ? null
        : Math.max(0, 30 - ageDays);
    const trialDaysLeft = app.user?.subscription?.trialEndsAt
      ? Math.max(
          0,
          Math.ceil(
            (new Date(app.user.subscription.trialEndsAt).getTime() - now) /
              (1000 * 60 * 60 * 24)
          )
        )
      : null;
    const properties = app.user?.properties ?? [];
    const totalUnits = properties.reduce(
      (sum, p) => sum + p.units.length,
      0
    );
    const propertiesWithoutTerminal = properties.filter(
      (p) => !p.kadimaTerminalId
    ).length;

    return {
      id: app.id,
      pmId: app.user?.id ?? null,
      pmName: app.user?.name ?? "",
      pmEmail: app.user?.email ?? "",
      companyName:
        app.businessLegalName || app.dba || app.user?.companyName || "",
      status: app.status,
      currentStep: app.currentStep,
      kadimaAppId: app.kadimaAppId,
      kadimaApplicationUrl: app.kadimaApplicationUrl,
      createdAt: app.createdAt.toISOString(),
      updatedAt: app.updatedAt.toISOString(),
      lastReminderSentAt: app.lastReminderSentAt?.toISOString() ?? null,
      daysUntilExpiry,
      isExpiringSoon: daysUntilExpiry !== null && daysUntilExpiry <= 7,
      subscriptionStatus: app.user?.subscription?.status ?? null,
      trialDaysLeft,
      propertiesCount: properties.length,
      unitsCount: totalUnits,
      propertiesWithoutTerminal,
    };
  });

  // Stats row
  const stats = {
    totalPms: rows.length,
    approved: rows.filter((r) => r.status === "APPROVED").length,
    pending: rows.filter(
      (r) => r.status === "IN_PROGRESS" || r.status === "SUBMITTED"
    ).length,
    notStarted: rows.filter((r) => r.status === "NOT_STARTED").length,
    expired: rows.filter(
      (r) => r.status === "EXPIRED" || r.status === "REJECTED"
    ).length,
  };

  return NextResponse.json({ rows, stats });
}

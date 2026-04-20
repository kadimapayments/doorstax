export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";

/**
 * GET /api/admin/property-reviews
 *
 * Queue of properties awaiting underwriter action. Includes PM + unit
 * count + submitted-for-review date so the admin can triage quickly
 * before diving into the detail page.
 *
 * Filter: ?status=PENDING_REVIEW|NEEDS_INFO|REJECTED|APPROVED (default:
 * PENDING_REVIEW + NEEDS_INFO only — the actionable queue).
 *
 * Gated by admin:landlords.
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

  const statusParam = req.nextUrl.searchParams.get("status");
  const statusFilter = statusParam
    ? { boardingStatus: statusParam }
    : { boardingStatus: { in: ["PENDING_REVIEW", "NEEDS_INFO"] } };

  const properties = await db.property.findMany({
    where: statusFilter,
    include: {
      landlord: {
        select: { id: true, name: true, email: true, companyName: true },
      },
      _count: { select: { units: true, documents: true } },
    },
    orderBy: [
      { submittedForReviewAt: "desc" },
      { createdAt: "desc" },
    ],
    take: 200,
  });

  const queue = properties.map((p) => ({
    id: p.id,
    name: p.name,
    address: `${p.address}, ${p.city}, ${p.state} ${p.zip}`,
    propertyType: p.propertyType,
    boardingStatus: p.boardingStatus,
    submittedForReviewAt: p.submittedForReviewAt?.toISOString() || null,
    unitCount: p._count.units,
    documentCount: p._count.documents,
    residentialUnitCount: p.residentialUnitCount,
    commercialUnitCount: p.commercialUnitCount,
    section8UnitCount: p.section8UnitCount,
    totalSqft: p.totalSqft,
    pmId: p.landlord?.id || null,
    pmName:
      p.landlord?.companyName || p.landlord?.name || p.landlord?.email || "—",
    pmEmail: p.landlord?.email || null,
  }));

  return NextResponse.json({ queue, count: queue.length });
}

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";

/**
 * GET /api/pm/vendor-invoices
 *
 * Lists all VendorInvoice rows submitted to this PM. Filter by ?status=.
 */
export async function GET(req: NextRequest) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const landlordId = await getEffectiveLandlordId(session.user.id);

  const status = req.nextUrl.searchParams.get("status") || undefined;
  const vendorId = req.nextUrl.searchParams.get("vendor") || undefined;

  const invoices = await db.vendorInvoice.findMany({
    where: {
      landlordId,
      ...(status ? { status: status as never } : {}),
      ...(vendorId ? { vendorId } : {}),
    },
    include: {
      vendor: { select: { id: true, name: true, company: true, category: true } },
      ticket: { select: { id: true, title: true, status: true } },
      vendorPayout: {
        select: { id: true, status: true, paidAt: true, method: true },
      },
    },
    orderBy: [{ submittedAt: "desc" }],
    take: 200,
  });

  // Summary counts for the queue header
  const counts = await db.vendorInvoice.groupBy({
    by: ["status"],
    where: { landlordId },
    _count: true,
  });
  const byStatus = Object.fromEntries(
    counts.map((c) => [c.status, c._count])
  ) as Record<string, number>;

  return NextResponse.json({ invoices, counts: byStatus });
}

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/vendor/payouts
 *
 * Read-only list of VendorPayout rows routed to any Vendor record linked
 * to this user. Vendors use this to confirm what's been paid.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "VENDOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payouts = await db.vendorPayout.findMany({
    where: { vendor: { userId: session.user.id } },
    include: {
      landlord: { select: { id: true, name: true, companyName: true } },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          description: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });

  return NextResponse.json({ payouts });
}

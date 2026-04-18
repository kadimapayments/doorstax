export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/vendor/pms
 *
 * Lists every PM in this vendor's network (one entry per linked Vendor row).
 * Used by the "New invoice" and "Tickets filter" pickers.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "VENDOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const records = await db.vendor.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      landlordId: true,
      category: true,
      landlord: { select: { name: true, companyName: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const pms = records.map((r) => ({
    vendorId: r.id,
    landlordId: r.landlordId,
    name: r.landlord.companyName || r.landlord.name,
    category: r.category,
  }));

  return NextResponse.json({ pms });
}

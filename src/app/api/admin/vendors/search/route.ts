export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";

/**
 * GET /api/admin/vendors/search?q=<query>
 *
 * Admin-scoped global vendor search for the Virtual Terminal. Returns
 * the landlordId so admin-initiated payouts can use the correct PM
 * merchant credentials (the PM that added the vendor owns the ACH
 * relationship and the funds).
 *
 * Gated by `admin:payments`.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:payments")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (q.length < 2) return NextResponse.json({ vendors: [] });

  const vendors = await db.vendor.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { company: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      company: true,
      email: true,
      category: true,
      landlordId: true,
      kadimaCustomerId: true,
      kadimaAccountId: true,
      bankName: true,
      bankAccountLast4: true,
      landlord: { select: { name: true, companyName: true } },
    },
    take: 25,
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    vendors: vendors.map((v) => ({
      id: v.id,
      name: v.name,
      company: v.company,
      email: v.email,
      category: v.category,
      landlordId: v.landlordId,
      landlordName: v.landlord?.companyName || v.landlord?.name || null,
      kadimaCustomerId: v.kadimaCustomerId,
      kadimaAccountId: v.kadimaAccountId,
      bankName: v.bankName,
      bankAccountLast4: v.bankAccountLast4,
    })),
  });
}

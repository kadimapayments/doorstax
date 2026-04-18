import { NextRequest, NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";

export const dynamic = "force-dynamic";

/**
 * GET /api/pm/vendors/search?q=...
 *
 * Global VENDOR directory search. Used by the "Add existing vendor" dialog
 * on the PM vendor list. Returns vendors who are NOT already in this PM's
 * vendor network. Matches by email, name, company, or phone.
 */
export async function GET(req: NextRequest) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const landlordId = await getEffectiveLandlordId(session.user.id);

  const q = req.nextUrl.searchParams.get("q") || "";
  if (q.length < 2) return NextResponse.json({ vendors: [] });

  // Find user IDs already in this PM's network so we can exclude them.
  const alreadyLinked = await db.vendor.findMany({
    where: { landlordId, userId: { not: null } },
    select: { userId: true },
  });
  const excludeIds = alreadyLinked
    .map((v) => v.userId)
    .filter((id): id is string => !!id);

  const users = await db.user.findMany({
    where: {
      role: "VENDOR",
      id: { notIn: excludeIds },
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { companyName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      companyName: true,
      // Surface which categories/PMs they work with today — helps PMs
      // decide whether to add.
      vendorRecords: {
        select: {
          category: true,
          landlord: { select: { name: true, companyName: true } },
        },
      },
    },
    take: 10,
    orderBy: { createdAt: "desc" },
  });

  const vendors = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    company: u.companyName,
    categories: Array.from(
      new Set(u.vendorRecords.map((v) => v.category).filter(Boolean))
    ),
    pmCount: u.vendorRecords.length,
  }));

  return NextResponse.json({ vendors });
}

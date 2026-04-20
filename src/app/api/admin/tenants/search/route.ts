export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";

/**
 * GET /api/admin/tenants/search?q=<query>
 *
 * Admin-scoped global tenant search for the Virtual Terminal. Unlike
 * /api/pm/tenants/search, this is not restricted to a single PM's units —
 * an admin can charge any tenant in the system on behalf of that tenant's
 * PM. Returns the tenant's landlordId so the charge endpoint can pull the
 * correct merchant credentials.
 *
 * Gated by the `admin:payments` permission.
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
  if (q.length < 2) return NextResponse.json({ tenants: [] });

  const tenants = await db.tenantProfile.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } },
        { unit: { unitNumber: { contains: q, mode: "insensitive" } } },
        { unit: { property: { name: { contains: q, mode: "insensitive" } } } },
      ],
    },
    select: {
      id: true,
      unitId: true,
      kadimaCustomerId: true,
      kadimaCardTokenId: true,
      cardBrand: true,
      cardLast4: true,
      bankLast4: true,
      paymentMethodType: true,
      user: { select: { name: true, email: true } },
      unit: {
        select: {
          unitNumber: true,
          property: {
            select: {
              name: true,
              landlordId: true,
              landlord: { select: { name: true, companyName: true } },
            },
          },
        },
      },
    },
    take: 25,
    orderBy: { createdAt: "desc" },
  });

  const results = tenants.map((t) => ({
    id: t.id,
    unitId: t.unitId,
    name: t.user?.name || "Tenant",
    email: t.user?.email,
    unitLabel: t.unit
      ? `${t.unit.property?.name || ""} — Unit ${t.unit.unitNumber}`
      : null,
    // Surface the PM so the admin knows whose merchant account the charge
    // runs under — critical context for admin-initiated charges.
    landlordId: t.unit?.property?.landlordId || null,
    landlordName:
      t.unit?.property?.landlord?.companyName ||
      t.unit?.property?.landlord?.name ||
      null,
    savedCard:
      t.kadimaCardTokenId && t.cardLast4
        ? { brand: t.cardBrand, last4: t.cardLast4 }
        : null,
    savedBank: t.bankLast4 ? { last4: t.bankLast4 } : null,
    defaultMethod: t.paymentMethodType || null,
  }));

  return NextResponse.json({ tenants: results });
}

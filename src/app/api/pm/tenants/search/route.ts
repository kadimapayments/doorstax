export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";

/**
 * GET /api/pm/tenants/search?q=<query>
 * GET /api/pm/tenants/search?id=<tenantProfileId>
 *
 * Two modes, identical response shape:
 *   - `q`  : free-text search across name / email / unit / property
 *            (used by the charge-form debounced search box)
 *   - `id` : direct lookup by TenantProfile id (used when a wrapper
 *            page pre-selects a tenant via URL — e.g. the Unpaid Rent
 *            table's "Charge tenant" link sends the form to
 *            `?tenantId=…` and the form auto-selects without forcing
 *            the PM to re-search)
 *
 * Returns up to 20 results with vault-card + unit info inline.
 */
export async function GET(req: NextRequest) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const landlordId = await getEffectiveLandlordId(session.user.id);

  const idParam = req.nextUrl.searchParams.get("id")?.trim();
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";

  // ── Direct-by-id mode ──
  // Same shape as the search branch so the form's auto-select handler
  // doesn't need a second code path. Scoped to the resolved landlord
  // so a malicious id from another PM's portfolio returns nothing.
  if (idParam) {
    const tenants = await db.tenantProfile.findMany({
      where: {
        id: idParam,
        unit: { property: { landlordId } },
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
            property: { select: { name: true } },
          },
        },
      },
      take: 1,
    });
    const results = tenants.map((t) => ({
      id: t.id,
      unitId: t.unitId,
      name: t.user?.name || "Tenant",
      email: t.user?.email,
      unitLabel: t.unit
        ? `${t.unit.property?.name || ""} — Unit ${t.unit.unitNumber}`
        : null,
      savedCard:
        t.kadimaCardTokenId && t.cardLast4
          ? { brand: t.cardBrand, last4: t.cardLast4 }
          : null,
      savedBank: t.bankLast4 ? { last4: t.bankLast4 } : null,
      defaultMethod: t.paymentMethodType || null,
    }));
    return NextResponse.json({ tenants: results });
  }

  if (q.length < 2) return NextResponse.json({ tenants: [] });

  const tenants = await db.tenantProfile.findMany({
    where: {
      status: "ACTIVE",
      unit: { property: { landlordId } },
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
          property: { select: { name: true } },
        },
      },
    },
    take: 20,
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
    savedCard:
      t.kadimaCardTokenId && t.cardLast4
        ? { brand: t.cardBrand, last4: t.cardLast4 }
        : null,
    savedBank: t.bankLast4
      ? { last4: t.bankLast4 }
      : null,
    defaultMethod: t.paymentMethodType || null,
  }));

  return NextResponse.json({ tenants: results });
}

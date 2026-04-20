export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { toCsv, csvResponse } from "@/lib/reports/csv";

/**
 * GET /api/reports/vacancy
 *
 * Returns all AVAILABLE units for the PM with a best-effort
 * "days vacant" figure computed from the most recent former-tenant
 * move-out (leaseEnd) on that unit.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (
    !session?.user ||
    !["PM", "LANDLORD"].includes(session.user.role)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const landlordId = await getEffectiveLandlordId(session.user.id);
  const propertyId = req.nextUrl.searchParams.get("propertyId") || undefined;
  const format = req.nextUrl.searchParams.get("format") || "json";

  const units = await db.unit.findMany({
    where: {
      status: "AVAILABLE",
      property: {
        landlordId,
        ...(propertyId ? { id: propertyId } : {}),
      },
    },
    select: {
      id: true,
      unitNumber: true,
      bedrooms: true,
      bathrooms: true,
      sqft: true,
      rentAmount: true,
      createdAt: true,
      property: { select: { name: true, address: true } },
      tenantProfiles: {
        where: { status: { not: "ACTIVE" } },
        orderBy: { leaseEnd: "desc" },
        take: 1,
        select: {
          leaseEnd: true,
          user: { select: { name: true } },
        },
      },
    },
    orderBy: [{ property: { name: "asc" } }, { unitNumber: "asc" }],
  });

  const now = new Date();
  const rows = units.map((u) => {
    const last = u.tenantProfiles[0];
    // Days-vacant falls back to unit age if we never had a tenant.
    const since = last?.leaseEnd ?? u.createdAt;
    const daysVacant = Math.max(
      0,
      Math.floor((now.getTime() - new Date(since).getTime()) / (1000 * 60 * 60 * 24))
    );
    return {
      property: u.property.name,
      address: u.property.address,
      unit: u.unitNumber,
      beds: u.bedrooms ?? "",
      baths: u.bathrooms ?? "",
      sqft: u.sqft ?? "",
      askingRent: Number(u.rentAmount).toFixed(2),
      daysVacant,
      lastTenant: last?.user?.name || "",
      lastMoveOut: last?.leaseEnd
        ? new Date(last.leaseEnd).toISOString().slice(0, 10)
        : "",
    };
  });

  if (format === "csv") {
    return csvResponse(
      toCsv(rows),
      `vacancy-${new Date().toISOString().slice(0, 10)}.csv`
    );
  }

  const monthlyLoss = rows.reduce((s, r) => s + Number(r.askingRent), 0);
  return NextResponse.json({
    rows,
    summary: {
      vacantCount: rows.length,
      avgDaysVacant:
        rows.length > 0
          ? Math.round(
              rows.reduce((s, r) => s + r.daysVacant, 0) / rows.length
            )
          : 0,
      monthlyRentLoss: monthlyLoss,
    },
  });
}

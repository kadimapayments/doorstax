export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { toCsv, csvResponse } from "@/lib/reports/csv";

/**
 * GET /api/reports/rent-roll
 *
 * Query params:
 *   propertyId?  — scope to a single property
 *   format?      — "csv" | "json" (default json)
 *
 * Returns: every unit in the PM's portfolio with occupancy, tenant name,
 * lease dates, and monthly rent.
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
      rentAmount: true,
      status: true,
      property: { select: { name: true, address: true } },
      tenantProfiles: {
        where: { status: "ACTIVE" },
        select: {
          user: { select: { name: true, email: true } },
          leaseStart: true,
          leaseEnd: true,
        },
      },
    },
    orderBy: [{ property: { name: "asc" } }, { unitNumber: "asc" }],
  });

  const rows = units.map((u) => {
    const tenant = u.tenantProfiles[0];
    return {
      property: u.property.name,
      address: u.property.address,
      unit: u.unitNumber,
      beds: u.bedrooms ?? "",
      baths: u.bathrooms ?? "",
      rent: Number(u.rentAmount).toFixed(2),
      status: u.status,
      tenant: tenant?.user?.name || "",
      tenantEmail: tenant?.user?.email || "",
      leaseStart: tenant?.leaseStart
        ? new Date(tenant.leaseStart).toISOString().slice(0, 10)
        : "",
      leaseEnd: tenant?.leaseEnd
        ? new Date(tenant.leaseEnd).toISOString().slice(0, 10)
        : "",
    };
  });

  if (format === "csv") {
    return csvResponse(toCsv(rows), `rent-roll-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  const occupied = rows.filter((r) => r.status === "OCCUPIED").length;
  const total = rows.length;
  const monthlyPotential = rows.reduce(
    (sum, r) => sum + (r.status === "OCCUPIED" ? Number(r.rent) : 0),
    0
  );

  return NextResponse.json({
    rows,
    summary: {
      totalUnits: total,
      occupiedUnits: occupied,
      vacantUnits: total - occupied,
      occupancyRate: total > 0 ? Math.round((occupied / total) * 100) : 0,
      monthlyRentPotential: monthlyPotential,
    },
  });
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";

/**
 * GET /api/leases/expiring
 * Returns ACTIVE leases expiring within the next 90 days for the PM's portfolio.
 * Used by the ExpiringLeases dashboard widget.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const now = new Date();
  const ninetyDaysOut = new Date(now);
  ninetyDaysOut.setDate(ninetyDaysOut.getDate() + 90);

  const leases = await db.lease.findMany({
    where: {
      landlordId,
      status: "ACTIVE",
      endDate: { gte: now, lte: ninetyDaysOut },
    },
    include: {
      tenant: { include: { user: { select: { name: true } } } },
      unit: { select: { unitNumber: true } },
      property: { select: { name: true } },
    },
    orderBy: { endDate: "asc" },
  });

  // Prisma `gte` / `lte` predicates filter out nulls implicitly, so
  // every row here has a concrete endDate — but TS can't narrow that
  // through Prisma's generic type, hence the explicit guard.
  const result = leases
    .filter((l): l is typeof l & { endDate: Date } => l.endDate !== null)
    .map((l) => ({
      id: l.id,
      tenantName: l.tenant.user.name,
      propertyName: l.property.name,
      unitNumber: l.unit.unitNumber,
      endDate: l.endDate.toISOString(),
      rentAmount: Number(l.rentAmount),
      daysRemaining: Math.ceil(
        (l.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      ),
    }));

  return NextResponse.json(result);
}

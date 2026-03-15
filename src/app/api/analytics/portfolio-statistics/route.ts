import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { withCache } from "@/lib/cache";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") || "pm";

  // Determine property filter for scope
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let unitWhere: any = {};

  if (scope === "pm") {
    const user = session.user;
    if (user.role !== "PM" && user.role !== "ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const landlordId = await getEffectiveLandlordId(user.id);
    const propertyIds = (
      await db.property.findMany({
        where: { landlordId },
        select: { id: true },
      })
    ).map((p) => p.id);
    unitWhere = { propertyId: { in: propertyIds } };
  } else if (scope === "owner") {
    const owner = await db.owner.findFirst({
      where: { userId: session.user.id },
    });
    if (!owner)
      return NextResponse.json({ error: "Owner not found" }, { status: 404 });
    const propertyIds = (
      await db.property.findMany({
        where: { ownerId: owner.id },
        select: { id: true },
      })
    ).map((p) => p.id);
    unitWhere = { propertyId: { in: propertyIds } };
  } else if (scope === "admin") {
    if (session.user.role !== "ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // No additional filter — platform-wide
  }

  // Fetch all units with just the fields we need
  const allUnits = await db.unit.findMany({
    where: unitWhere,
    select: {
      id: true,
      createdAt: true,
      archivedAt: true,
    },
  });

  // Build 12-month snapshots ending at current month
  const now = new Date();
  const months: Array<{
    label: string;
    year: number;
    month: number;
    added: number;
    closed: number;
    total: number;
    pctAdded: number;
    pctClosed: number;
    pctGrowth: number;
  }> = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mYear = d.getFullYear();
    const mMonth = d.getMonth(); // 0-indexed
    const monthStart = new Date(mYear, mMonth, 1);
    const monthEnd = new Date(mYear, mMonth + 1, 1);

    let added = 0;
    let closed = 0;
    let totalActive = 0;

    for (const unit of allUnits) {
      const created = new Date(unit.createdAt);
      const archived = unit.archivedAt ? new Date(unit.archivedAt) : null;

      // Was this unit added during this month?
      if (created >= monthStart && created < monthEnd) {
        added++;
      }

      // Was this unit closed/archived during this month?
      if (archived && archived >= monthStart && archived < monthEnd) {
        closed++;
      }

      // Is this unit active at the end of this month?
      // Active = created before month end AND (not archived OR archived after month end)
      if (created < monthEnd && (!archived || archived >= monthEnd)) {
        totalActive++;
      }
    }

    // Previous month's total for percentage calculations
    const prevTotal = months.length > 0 ? months[months.length - 1].total : (totalActive - added + closed);

    months.push({
      label: `${MONTH_NAMES[mMonth].slice(0, 3)} ${mYear}`,
      year: mYear,
      month: mMonth + 1, // 1-indexed
      added,
      closed,
      total: totalActive,
      pctAdded: prevTotal > 0 ? Math.round((added / prevTotal) * 10000) / 100 : 0,
      pctClosed: prevTotal > 0 ? Math.round((closed / prevTotal) * 10000) / 100 : 0,
      pctGrowth: prevTotal > 0
        ? Math.round(((totalActive - prevTotal) / prevTotal) * 10000) / 100
        : 0,
    });
  }

  return NextResponse.json({ months });
}

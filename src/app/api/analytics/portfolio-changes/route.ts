import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";

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

  const now = new Date();
  const reqMonth = searchParams.get("month");
  const reqYear = searchParams.get("year");
  const month = reqMonth ? parseInt(reqMonth, 10) - 1 : now.getMonth();
  const year = reqYear ? parseInt(reqYear, 10) : now.getFullYear();

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const propertyWhere: any = { createdAt: { gte: monthStart, lt: monthEnd } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let unitWhere: any = { createdAt: { gte: monthStart, lt: monthEnd } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const propertyArchivedWhere: any = { archivedAt: { gte: monthStart, lt: monthEnd } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let unitArchivedWhere: any = { archivedAt: { gte: monthStart, lt: monthEnd } };

  if (scope === "pm") {
    const user = session.user;
    if (user.role !== "PM" && user.role !== "ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const landlordId = await getEffectiveLandlordId(user.id);
    propertyWhere.landlordId = landlordId;
    propertyArchivedWhere.landlordId = landlordId;
    const propertyIds = (
      await db.property.findMany({
        where: { landlordId },
        select: { id: true },
      })
    ).map((p) => p.id);
    unitWhere = {
      createdAt: { gte: monthStart, lt: monthEnd },
      propertyId: { in: propertyIds },
    };
    unitArchivedWhere = {
      archivedAt: { gte: monthStart, lt: monthEnd },
      propertyId: { in: propertyIds },
    };
  } else if (scope === "owner") {
    const owner = await db.owner.findFirst({
      where: { userId: session.user.id },
    });
    if (!owner)
      return NextResponse.json({ error: "Owner not found" }, { status: 404 });
    propertyWhere.ownerId = owner.id;
    propertyArchivedWhere.ownerId = owner.id;
    const propertyIds = (
      await db.property.findMany({
        where: { ownerId: owner.id },
        select: { id: true },
      })
    ).map((p) => p.id);
    unitWhere = {
      createdAt: { gte: monthStart, lt: monthEnd },
      propertyId: { in: propertyIds },
    };
    unitArchivedWhere = {
      archivedAt: { gte: monthStart, lt: monthEnd },
      propertyId: { in: propertyIds },
    };
  } else if (scope === "admin") {
    if (session.user.role !== "ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [newProperties, newUnits, removedProperties, removedUnits] = await Promise.all([
    db.property.findMany({
      where: propertyWhere,
      select: { id: true, name: true, createdAt: true },
    }),
    db.unit.findMany({
      where: unitWhere,
      select: { id: true, unitNumber: true, createdAt: true, property: { select: { name: true } } },
    }),
    db.property.findMany({
      where: propertyArchivedWhere,
      select: { id: true, name: true, archivedAt: true },
    }),
    db.unit.findMany({
      where: unitArchivedWhere,
      select: { id: true, unitNumber: true, archivedAt: true, property: { select: { name: true } } },
    }),
  ]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = MONTH_NAMES[month];
  const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    return {
      date: `${monthName.slice(0, 3)} ${day}`,
      propertiesAdded: 0,
      unitsAdded: 0,
      propertiesRemoved: 0,
      unitsRemoved: 0,
    };
  });

  for (const p of newProperties) {
    const day = p.createdAt.getDate() - 1;
    if (day >= 0 && day < daysInMonth) dailyData[day].propertiesAdded++;
  }
  for (const u of newUnits) {
    const day = u.createdAt.getDate() - 1;
    if (day >= 0 && day < daysInMonth) dailyData[day].unitsAdded++;
  }
  for (const p of removedProperties) {
    if (p.archivedAt) {
      const day = p.archivedAt.getDate() - 1;
      if (day >= 0 && day < daysInMonth) dailyData[day].propertiesRemoved++;
    }
  }
  for (const u of removedUnits) {
    if (u.archivedAt) {
      const day = u.archivedAt.getDate() - 1;
      if (day >= 0 && day < daysInMonth) dailyData[day].unitsRemoved++;
    }
  }

  // Negate removals for chart display (negative bars)
  const chartData = dailyData.map((d) => ({
    ...d,
    propertiesRemoved: -d.propertiesRemoved,
    unitsRemoved: -d.unitsRemoved,
  }));

  const summary = {
    totalPropertiesAdded: newProperties.length,
    totalUnitsAdded: newUnits.length,
    totalPropertiesRemoved: removedProperties.length,
    totalUnitsRemoved: removedUnits.length,
  };

  return NextResponse.json({
    dailyData: chartData,
    summary,
    month: month + 1,
    year,
    monthLabel: `${monthName} ${year}`,
  });
}

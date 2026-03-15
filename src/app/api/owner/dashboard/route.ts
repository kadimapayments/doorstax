import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owner = await db.owner.findFirst({ where: { userId: session.user.id } });
  if (!owner) return NextResponse.json({ error: "Owner profile not found" }, { status: 404 });

  const properties = await db.property.findMany({
    where: { ownerId: owner.id },
    include: {
      units: { select: { id: true, status: true, rentAmount: true } },
    },
  });

  const totalUnits = properties.reduce((s, p) => s + p.units.length, 0);
  const occupiedUnits = properties.reduce((s, p) => s + p.units.filter(u => u.status === "OCCUPIED").length, 0);
  const totalRent = properties.reduce((s, p) => s + p.units.reduce((us, u) => us + Number(u.rentAmount), 0), 0);
  const avgRentPerUnit = occupiedUnits > 0 ? Math.round(totalRent / occupiedUnits) : 0;
  const vacantUnits = totalUnits - occupiedUnits;

  // Recent payouts
  const payouts = await db.ownerPayout.findMany({
    where: { ownerId: owner.id },
    orderBy: { periodStart: "desc" },
    take: 5,
  });

  // YTD totals
  const ytdStart = new Date(new Date().getFullYear(), 0, 1);
  const ytdPayouts = await db.ownerPayout.aggregate({
    where: { ownerId: owner.id, periodStart: { gte: ytdStart }, status: "PAID" },
    _sum: { grossRent: true, netPayout: true },
  });

  // Collection rate: YTD gross rent collected vs expected
  const monthsElapsed = new Date().getMonth() + 1;
  const expectedYtdRent = totalRent * monthsElapsed;
  const ytdGross = Number(ytdPayouts._sum.grossRent ?? 0);
  const collectionRate = expectedYtdRent > 0 ? Math.round((ytdGross / expectedYtdRent) * 100) : 0;

  return NextResponse.json({
    ownerName: owner.name,
    properties: properties.length,
    totalUnits,
    occupiedUnits,
    occupancyRate: totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
    totalMonthlyRent: totalRent,
    avgRentPerUnit,
    collectionRate,
    vacantUnits,
    ytdGrossRent: ytdGross,
    ytdNetPayouts: Number(ytdPayouts._sum.netPayout ?? 0),
    recentPayouts: payouts.map(p => ({
      id: p.id,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      grossRent: Number(p.grossRent),
      netPayout: Number(p.netPayout),
      status: p.status,
    })),
    propertyList: properties.map(p => ({
      id: p.id,
      name: p.name,
      address: p.address,
      city: p.city,
      state: p.state,
      units: p.units.length,
      occupied: p.units.filter(u => u.status === "OCCUPIED").length,
    })),
  });
}

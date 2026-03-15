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
      units: {
        select: {
          id: true,
          unitNumber: true,
          status: true,
          rentAmount: true,
          tenantProfiles: {
            where: { status: "ACTIVE" },
            select: {
              user: { select: { name: true } },
            },
            take: 1,
          },
        },
      },
    },
  });

  return NextResponse.json(
    properties.map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      city: p.city,
      state: p.state,
      zip: p.zip,
      propertyType: p.propertyType,
      units: p.units.map((u) => ({
        id: u.id,
        unitNumber: u.unitNumber,
        status: u.status,
        rentAmount: Number(u.rentAmount),
        tenantName: u.tenantProfiles[0]?.user?.name ?? null,
      })),
      totalRent: p.units.reduce((s, u) => s + Number(u.rentAmount), 0),
      occupied: p.units.filter((u) => u.status === "OCCUPIED").length,
      totalUnits: p.units.length,
    }))
  );
}

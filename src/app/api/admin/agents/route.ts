import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const relationships = await db.agentRelationship.findMany({
      include: {
        parentPm: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        agentUser: {
          select: {
            id: true,
            name: true,
            email: true,
            properties: {
              where: { archivedAt: null },
              select: {
                units: {
                  where: { archivedAt: null },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = relationships.map((rel) => {
      const agentUnitCount = rel.agentUser.properties.reduce(
        (sum, p) => sum + p.units.length,
        0
      );

      return {
        id: rel.id,
        parentPm: {
          id: rel.parentPm.id,
          name: rel.parentPm.name,
          email: rel.parentPm.email,
        },
        agent: {
          id: rel.agentUser.id,
          name: rel.agentUser.name,
          email: rel.agentUser.email,
        },
        unitCount: agentUnitCount,
        propertyCount: rel.agentUser.properties.length,
        perUnitCost: Number(rel.perUnitCost),
        cardRateOverride: rel.cardRateOverride
          ? Number(rel.cardRateOverride)
          : null,
        achRateOverride: rel.achRateOverride
          ? Number(rel.achRateOverride)
          : null,
        commissionRate: Number(rel.commissionRate),
        residualSplit: Number(rel.residualSplit),
        isActive: rel.isActive,
        createdAt: rel.createdAt.toISOString(),
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/admin/agents error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

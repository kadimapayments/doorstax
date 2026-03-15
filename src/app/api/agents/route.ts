import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const relationships = await db.agentRelationship.findMany({
      where: { parentPmId: session.user.id },
      include: {
        agentUser: {
          select: {
            id: true,
            name: true,
            email: true,
            properties: {
              where: { archivedAt: null },
              select: {
                id: true,
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

    const agents = await Promise.all(
      relationships.map(async (rel) => {
        const agent = rel.agentUser;

        // Count units across all agent's properties
        const unitCount = agent.properties.reduce(
          (sum, p) => sum + p.units.length,
          0
        );
        const propertyCount = agent.properties.length;

        // Get all unit IDs for payment volume query
        const unitIds = agent.properties.flatMap((p) =>
          p.units.map((u) => u.id)
        );

        // Monthly payment volume
        let monthlyPaymentVolume = 0;
        if (unitIds.length > 0) {
          const payments = await db.payment.aggregate({
            where: {
              unitId: { in: unitIds },
              status: "COMPLETED",
              paidAt: { gte: monthStart },
            },
            _sum: { amount: true },
          });
          monthlyPaymentVolume = Number(payments._sum.amount ?? 0);
        }

        return {
          id: rel.id,
          agentUserId: agent.id,
          name: agent.name,
          email: agent.email,
          unitCount,
          propertyCount,
          monthlyPaymentVolume,
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
      })
    );

    return NextResponse.json(agents);
  } catch (error) {
    console.error("GET /api/agents error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

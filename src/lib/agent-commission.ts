import { db } from "@/lib/db";
import { getTier } from "@/lib/residual-tiers";

interface AgentCommissionResult {
  agentId: string;
  name: string;
  unitCount: number;
  subscriptionSpread: number;
  residualEarnings: number;
  totalCommission: number;
}

interface CommissionSummary {
  agents: AgentCommissionResult[];
  totalEarnings: number;
}

/**
 * Calculate the commission a parent PM earns from their agent network.
 *
 * Subscription spread: the difference between the agent's per-unit cost
 * and the parent PM's own tiered rate, multiplied by the agent's unit count.
 *
 * Residual earnings: the agent's residualSplit percentage applied to the
 * parent PM's card-rate residual on the agent's card payment volume.
 */
export async function calculateAgentCommission(
  parentPmId: string
): Promise<CommissionSummary> {
  // Get all active agent relationships for this parent PM
  const relationships = await db.agentRelationship.findMany({
    where: { parentPmId, isActive: true },
    include: {
      agentUser: {
        select: {
          id: true,
          name: true,
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
  });

  // Get the parent PM's total unit count (for tier calculation)
  const parentUnitCount = await db.unit.count({
    where: { property: { landlordId: parentPmId, archivedAt: null } },
  });
  const parentTier = getTier(parentUnitCount);

  // Current month boundaries for payment volume
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const agents: AgentCommissionResult[] = await Promise.all(
    relationships.map(async (rel) => {
      const agent = rel.agentUser;

      // Count the agent's units
      const agentUnitCount = agent.properties.reduce(
        (sum, p) => sum + p.units.length,
        0
      );

      // Subscription spread: (agent per-unit cost - parent's tiered per-unit cost) * agent units
      const agentPerUnit = Number(rel.perUnitCost);
      const subscriptionSpread =
        Math.max(0, agentPerUnit - parentTier.perUnitCost) * agentUnitCount;

      // Gather all unit IDs for payment volume query
      const unitIds = agent.properties.flatMap((p) =>
        p.units.map((u) => u.id)
      );

      let residualEarnings = 0;

      if (unitIds.length > 0 && parentTier.cardRate > 0) {
        // Get card payment volume for the agent's units this month
        const cardPayments = await db.payment.aggregate({
          where: {
            unitId: { in: unitIds },
            status: "COMPLETED",
            paymentMethod: "card",
            paidAt: { gte: monthStart },
          },
          _sum: { amount: true },
        });

        const cardVolume = Number(cardPayments._sum.amount ?? 0);

        // Residual: residualSplit % of the parent's card rate applied to agent's card volume
        const residualSplitRate = Number(rel.residualSplit);
        residualEarnings = cardVolume * parentTier.cardRate * residualSplitRate;
      }

      const totalCommission = subscriptionSpread + residualEarnings;

      return {
        agentId: agent.id,
        name: agent.name,
        unitCount: agentUnitCount,
        subscriptionSpread,
        residualEarnings,
        totalCommission,
      };
    })
  );

  const totalEarnings = agents.reduce((sum, a) => sum + a.totalCommission, 0);

  return { agents, totalEarnings };
}

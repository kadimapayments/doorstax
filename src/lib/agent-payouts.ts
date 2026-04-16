/**
 * Agent payout calculation engine.
 *
 * Agents earn a flat kickback per transacting unit based on the PM's tier.
 * A "transacting unit" is one where at least one COMPLETED payment was
 * processed during the period.
 *
 * Kickback rates:
 *   Starter ($2.50), Growth ($2.00), Scale ($1.50), Enterprise ($1.00)
 */

import { db } from "@/lib/db";
import { getTier, getAgentKickback } from "@/lib/residual-tiers";

export interface PMBreakdown {
  pmId: string;
  pmName: string;
  tier: string;
  totalUnits: number;
  transactingUnits: number;
  kickbackRate: number;
  earnings: number;
}

export async function calculateAgentPayout(
  agentUserId: string,
  yearMonth: string
): Promise<{
  totalEarnings: number;
  totalTransactingUnits: number;
  pmBreakdown: PMBreakdown[];
}> {
  const [year, month] = yearMonth.split("-").map(Number);
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);

  // Load the agent's commission config. If commissions are disabled for this
  // agent, short-circuit to zero earnings — referral tracking stays intact.
  const agentProfile = await db.agentProfile.findUnique({
    where: { userId: agentUserId },
    select: {
      commissionEnabled: true,
      commissionMode: true,
      customTierRates: true,
    },
  });

  if (agentProfile && agentProfile.commissionEnabled === false) {
    return { totalEarnings: 0, totalTransactingUnits: 0, pmBreakdown: [] };
  }

  const customRates =
    agentProfile?.commissionMode === "CUSTOM_TIER" &&
    agentProfile.customTierRates &&
    typeof agentProfile.customTierRates === "object"
      ? (agentProfile.customTierRates as Record<string, number>)
      : undefined;

  // PMs referred by this agent
  const referredPMs = await db.user.findMany({
    where: { referredByAgentId: agentUserId },
    select: { id: true, name: true, companyName: true },
  });

  if (referredPMs.length === 0) {
    return { totalEarnings: 0, totalTransactingUnits: 0, pmBreakdown: [] };
  }

  const pmBreakdown: PMBreakdown[] = [];
  let totalEarnings = 0;
  let totalTransactingUnits = 0;

  for (const pm of referredPMs) {
    const totalUnits = await db.unit.count({
      where: { property: { landlordId: pm.id } },
    });

    const tier = getTier(totalUnits);
    const kickbackRate = getAgentKickback(tier.name, customRates);

    // Count units with at least one COMPLETED payment in the period
    const transactingUnits = await db.unit.count({
      where: {
        property: { landlordId: pm.id },
        payments: {
          some: {
            status: "COMPLETED",
            createdAt: { gte: periodStart, lte: periodEnd },
          },
        },
      },
    });

    const earnings = transactingUnits * kickbackRate;

    pmBreakdown.push({
      pmId: pm.id,
      pmName: pm.name || pm.companyName || "PM",
      tier: tier.name,
      totalUnits,
      transactingUnits,
      kickbackRate,
      earnings,
    });

    totalEarnings += earnings;
    totalTransactingUnits += transactingUnits;
  }

  return { totalEarnings, totalTransactingUnits, pmBreakdown };
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateAgentPayout } from "@/lib/agent-payouts";

/**
 * Monthly agent payout calculation cron.
 * Runs on the 2nd of each month at 06:00 UTC — after rent payments on
 * the 1st have settled.
 *
 * For each active agent with an AgentProfile, calculates the previous
 * month's transacting-unit kickback and creates a PENDING AgentPayout.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const period = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;

  const agents = await db.agentProfile.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, userId: true },
  });

  let payoutsCreated = 0;
  const failures: string[] = [];

  for (const agent of agents) {
    try {
      // Skip if payout already calculated
      const existing = await db.agentPayout.findUnique({
        where: {
          agentProfileId_period: {
            agentProfileId: agent.id,
            period,
          },
        },
      });
      if (existing) continue;

      const {
        totalEarnings,
        totalTransactingUnits,
        pmBreakdown,
      } = await calculateAgentPayout(agent.userId, period);

      if (totalEarnings <= 0) continue;

      await db.agentPayout.create({
        data: {
          agentProfileId: agent.id,
          amount: totalEarnings,
          period,
          status: "PENDING",
          transactingUnits: totalTransactingUnits,
          pmBreakdown: JSON.parse(JSON.stringify(pmBreakdown)),
        },
      });

      // Notify admins
      try {
        const admins = await db.user.findMany({
          where: { role: "ADMIN" },
          select: { id: true },
        });
        const agentUser = await db.user.findUnique({
          where: { id: agent.userId },
          select: { name: true },
        });
        for (const admin of admins) {
          await db.dashboardNotice.create({
            data: {
              targetUserId: admin.id,
              createdById: admin.id,
              type: "AGENT_PAYOUT_DUE",
              title: `Agent Payout: $${totalEarnings.toFixed(2)}`,
              message: `${agentUser?.name || "Agent"} earned $${totalEarnings.toFixed(2)} from ${totalTransactingUnits} transacting units in ${period}`,
              severity: "info",
              actionUrl: `/admin/agents/${agent.userId}`,
            },
          }).catch(console.error);
        }
      } catch {}

      payoutsCreated++;
    } catch (e) {
      console.error("[agent-payouts] Failed for agent", agent.id, e);
      failures.push(agent.id);
    }
  }

  return NextResponse.json({
    period,
    agentsProcessed: agents.length,
    payoutsCreated,
    failed: failures.length,
  });
}

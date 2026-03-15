"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { Users, Network, ArrowRight } from "lucide-react";

interface AgentRelationshipRow {
  id: string;
  parentPm: { id: string; name: string; email: string };
  agent: { id: string; name: string; email: string };
  unitCount: number;
  propertyCount: number;
  perUnitCost: number;
  cardRateOverride: number | null;
  achRateOverride: number | null;
  commissionRate: number;
  residualSplit: number;
  isActive: boolean;
  createdAt: string;
}

interface GroupedPM {
  id: string;
  name: string;
  email: string;
  agents: AgentRelationshipRow[];
}

export default function AdminAgentsPage() {
  const [data, setData] = useState<AgentRelationshipRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/agents")
      .then((r) => r.json())
      .then((rows) => setData(Array.isArray(rows) ? rows : []))
      .catch(() => toast.error("Failed to load agent data"))
      .finally(() => setLoading(false));
  }, []);

  // Group by parent PM
  const grouped: GroupedPM[] = [];
  const pmMap = new Map<string, GroupedPM>();

  for (const row of data) {
    if (!pmMap.has(row.parentPm.id)) {
      const pm: GroupedPM = {
        id: row.parentPm.id,
        name: row.parentPm.name,
        email: row.parentPm.email,
        agents: [],
      };
      pmMap.set(row.parentPm.id, pm);
      grouped.push(pm);
    }
    pmMap.get(row.parentPm.id)!.agents.push(row);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent Hierarchy"
        description="Platform-wide view of all PM-agent relationships and revenue flow."
      />

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={<Network className="h-12 w-12" />}
          title="No agent relationships"
          description="No PM has invited any agents yet. Agent relationships will appear here once PMs begin recruiting sub-PMs."
        />
      ) : (
        <div className="space-y-6">
          {grouped.map((pm) => {
            const totalUnits = pm.agents.reduce(
              (sum, a) => sum + a.unitCount,
              0
            );
            return (
              <Card key={pm.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{pm.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {pm.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">
                        <Users className="mr-1 h-3 w-3" />
                        {pm.agents.length} agent
                        {pm.agents.length !== 1 ? "s" : ""}
                      </Badge>
                      <Badge variant="outline">{totalUnits} units</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground border-b">
                          <th className="pb-2 pr-4 font-medium">Agent</th>
                          <th className="pb-2 pr-4 font-medium">Email</th>
                          <th className="pb-2 pr-4 font-medium text-right">
                            Properties
                          </th>
                          <th className="pb-2 pr-4 font-medium text-right">
                            Units
                          </th>
                          <th className="pb-2 pr-4 font-medium text-right">
                            Per-Unit
                          </th>
                          <th className="pb-2 pr-4 font-medium text-right">
                            Commission
                          </th>
                          <th className="pb-2 pr-4 font-medium text-right">
                            Earnings Split
                          </th>
                          <th className="pb-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pm.agents.map((agent) => (
                          <tr
                            key={agent.id}
                            className="border-b border-border/50 last:border-0"
                          >
                            <td className="py-2.5 pr-4 font-medium">
                              <div className="flex items-center gap-2">
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                {agent.agent.name}
                              </div>
                            </td>
                            <td className="py-2.5 pr-4 text-muted-foreground">
                              {agent.agent.email}
                            </td>
                            <td className="py-2.5 pr-4 text-right">
                              {agent.propertyCount}
                            </td>
                            <td className="py-2.5 pr-4 text-right">
                              {agent.unitCount}
                            </td>
                            <td className="py-2.5 pr-4 text-right">
                              {formatCurrency(agent.perUnitCost)}
                            </td>
                            <td className="py-2.5 pr-4 text-right">
                              {(agent.commissionRate * 100).toFixed(1)}%
                            </td>
                            <td className="py-2.5 pr-4 text-right">
                              {(agent.residualSplit * 100).toFixed(1)}%
                            </td>
                            <td className="py-2.5">
                              <StatusBadge
                                status={agent.isActive ? "ACTIVE" : "PAUSED"}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

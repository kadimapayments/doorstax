"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, Users, Copy, Check } from "lucide-react";

interface Agent {
  id: string;
  agentUserId: string;
  name: string;
  email: string;
  unitCount: number;
  propertyCount: number;
  monthlyPaymentVolume: number;
  perUnitCost: number;
  cardRateOverride: number | null;
  achRateOverride: number | null;
  commissionRate: number;
  residualSplit: number;
  isActive: boolean;
  createdAt: string;
}

export default function AgentManagementPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [email, setEmail] = useState("");
  const [perUnitCost, setPerUnitCost] = useState("");
  const [cardRateOverride, setCardRateOverride] = useState("");
  const [achRateOverride, setAchRateOverride] = useState("");
  const [commissionRate, setCommissionRate] = useState("");
  const [residualSplit, setResidualSplit] = useState("");

  useEffect(() => {
    fetchAgents();
  }, []);

  async function fetchAgents() {
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      setAgents(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load agents");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEmail("");
    setPerUnitCost("");
    setCardRateOverride("");
    setAchRateOverride("");
    setCommissionRate("");
    setResidualSplit("");
    setInviteUrl(null);
    setCopied(false);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/agents/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          perUnitCost: parseFloat(perUnitCost),
          cardRateOverride: cardRateOverride
            ? parseFloat(cardRateOverride) / 100
            : undefined,
          achRateOverride: achRateOverride
            ? parseFloat(achRateOverride)
            : undefined,
          commissionRate: parseFloat(commissionRate) / 100,
          residualSplit: parseFloat(residualSplit) / 100,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to create invite");
        return;
      }

      setInviteUrl(data.inviteUrl);
      toast.success("Agent invite created");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyInviteUrl() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast.success("Invite link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent Management"
        description="Manage your agents and sub-PMs. Invite new agents and track their performance."
        actions={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Invite Agent
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {inviteUrl ? "Invite Created" : "Invite Agent"}
                </DialogTitle>
              </DialogHeader>

              {inviteUrl ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Share this link with your agent to complete registration:
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={inviteUrl}
                      readOnly
                      className="text-xs font-mono"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={copyInviteUrl}
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This link expires in 7 days.
                  </p>
                  <div className="flex justify-end">
                    <Button
                      onClick={() => {
                        setOpen(false);
                        resetForm();
                        fetchAgents();
                      }}
                    >
                      Done
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleInvite} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="agent-email">Email</Label>
                    <Input
                      id="agent-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="agent@example.com"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="per-unit-cost">Per-Unit Cost ($)</Label>
                      <Input
                        id="per-unit-cost"
                        type="number"
                        step="0.01"
                        min="0"
                        value={perUnitCost}
                        onChange={(e) => setPerUnitCost(e.target.value)}
                        placeholder="3.00"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="commission-rate">
                        Commission Rate (%)
                      </Label>
                      <Input
                        id="commission-rate"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={commissionRate}
                        onChange={(e) => setCommissionRate(e.target.value)}
                        placeholder="10"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="card-rate">
                        Card Rate Override (%)
                      </Label>
                      <Input
                        id="card-rate"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={cardRateOverride}
                        onChange={(e) => setCardRateOverride(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ach-rate">
                        ACH Rate Override ($)
                      </Label>
                      <Input
                        id="ach-rate"
                        type="number"
                        step="0.01"
                        min="0"
                        value={achRateOverride}
                        onChange={(e) => setAchRateOverride(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="residual-split">Earnings Split (%)</Label>
                    <Input
                      id="residual-split"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={residualSplit}
                      onChange={(e) => setResidualSplit(e.target.value)}
                      placeholder="50"
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setOpen(false);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Creating..." : "Create Invite"}
                    </Button>
                  </div>
                </form>
              )}
            </DialogContent>
          </Dialog>
        }
      />

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">Loading agents...</p>
          </CardContent>
        </Card>
      ) : agents.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="No agents yet"
          description="Invite agents to help grow your property management network. Agents can manage their own properties while you earn commissions on their portfolio."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Your Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="pb-3 pr-4 font-medium">Agent Name</th>
                    <th className="pb-3 pr-4 font-medium">Email</th>
                    <th className="pb-3 pr-4 font-medium text-right">Units</th>
                    <th className="pb-3 pr-4 font-medium text-right">
                      Monthly Volume
                    </th>
                    <th className="pb-3 pr-4 font-medium text-right">
                      Commission
                    </th>
                    <th className="pb-3 pr-4 font-medium text-right">
                      Earnings Split
                    </th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => (
                    <tr
                      key={agent.id}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="py-3 pr-4 font-medium">{agent.name}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {agent.email}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {agent.unitCount}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {formatCurrency(agent.monthlyPaymentVolume)}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {(agent.commissionRate * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {(agent.residualSplit * 100).toFixed(1)}%
                      </td>
                      <td className="py-3">
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
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Network, Copy, Loader2, Users } from "lucide-react";

interface AgentRow {
  id: string;
  name: string;
  email: string;
  referralCode: string | null;
  referredPmCount: number;
  totalUnits: number;
  perUnitCost: number;
  commissionRate: number;
  residualSplit: number;
  isActive: boolean;
}

interface Stats {
  total: number;
  active: number;
  referredPms: number;
}

const BASE =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://doorstax.com";

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    perUnitCost: 3,
    commissionRate: 10,
    cardRateOverride: "",
    achRateOverride: "",
    earningsSplit: 50,
  });

  async function fetchAgents() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/agents");
      if (res.ok) {
        const d = await res.json();
        setAgents(d.agents || []);
        setStats(d.stats || null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAgents();
  }, []);

  async function handleInvite() {
    if (!form.name || !form.email) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          cardRateOverride: form.cardRateOverride
            ? parseFloat(form.cardRateOverride)
            : undefined,
          achRateOverride: form.achRateOverride
            ? parseFloat(form.achRateOverride)
            : undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Agent invited");
        setOpen(false);
        setForm({
          name: "",
          email: "",
          phone: "",
          company: "",
          perUnitCost: 3,
          commissionRate: 10,
          cardRateOverride: "",
          achRateOverride: "",
          earningsSplit: 50,
        });
        fetchAgents();
      } else {
        toast.error(d.error || "Failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function copyLink(code: string) {
    navigator.clipboard.writeText(`${BASE}/register?ref=${code}`);
    toast.success("Referral link copied");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent Network"
        description="Manage DoorStax sales agents and their referral performance."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Invite Agent
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Invite Sales Agent</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Name *</Label>
                    <Input
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      placeholder="Full name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      placeholder="agent@example.com"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Company</Label>
                    <Input
                      value={form.company}
                      onChange={(e) =>
                        setForm({ ...form, company: e.target.value })
                      }
                    />
                  </div>
                </div>
                <h4 className="text-sm font-semibold border-t pt-3">
                  Revenue Share Terms
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Per-Unit Cost ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.perUnitCost}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          perUnitCost: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Commission (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={form.commissionRate}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          commissionRate: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Card Override (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.cardRateOverride}
                      onChange={(e) =>
                        setForm({ ...form, cardRateOverride: e.target.value })
                      }
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>ACH Override ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.achRateOverride}
                      onChange={(e) =>
                        setForm({ ...form, achRateOverride: e.target.value })
                      }
                      placeholder="Optional"
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label>Earnings Split (%)</Label>
                    <Input
                      type="number"
                      step="1"
                      value={form.earningsSplit}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          earningsSplit: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleInvite}
                  disabled={!form.name || !form.email || submitting}
                >
                  {submitting && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  Create &amp; Send Invite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total Agents" value={stats.total} />
          <StatCard
            label="Active"
            value={stats.active}
            className="text-emerald-500"
          />
          <StatCard
            label="Referred PMs"
            value={stats.referredPms}
            className="text-primary"
          />
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : agents.length === 0 ? (
        <EmptyState
          icon={<Network className="h-12 w-12" />}
          title="No agents yet"
          description="Invite your first sales agent to start growing the DoorStax network."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Invite Agent
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {agents.map((a) => (
            <Card key={a.id} className="border-border">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{a.name}</span>
                  <Badge
                    variant="outline"
                    className={
                      a.isActive
                        ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20"
                        : "bg-zinc-500/15 text-zinc-400 border-zinc-500/20"
                    }
                  >
                    {a.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{a.email}</p>
                {a.referralCode && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-mono bg-muted px-2 py-1 rounded truncate max-w-xs">
                      {BASE}/register?ref={a.referralCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyLink(a.referralCode!)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                  <span>
                    <Users className="h-3 w-3 inline mr-1" />
                    {a.referredPmCount} PMs
                  </span>
                  <span>{a.totalUnits} units</span>
                  <span>
                    Commission: {(a.commissionRate * 100).toFixed(1)}%
                  </span>
                  <span>Split: {(a.residualSplit * 100).toFixed(0)}%</span>
                  <span>Per unit: ${a.perUnitCost.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          {label}
        </div>
        <div className={`text-2xl font-bold mt-1 ${className || ""}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

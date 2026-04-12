"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  MoreVertical,
  Mail,
  Clock,
  Ban,
  CheckCircle,
  Server,
  Zap,
  Eye,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Building2,
  CreditCard,
  Users,
  FileText,
  Activity,
  Settings,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* eslint-disable @typescript-eslint/no-explicit-any */
type ProfileData = any;

const TABS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "kadima", label: "Kadima", icon: CreditCard },
  { id: "properties", label: "Properties", icon: Building2 },
  { id: "financial", label: "Financial", icon: FileText },
  { id: "team", label: "Team", icon: Users },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "actions", label: "Actions", icon: Settings },
];

const STATUS_CLASS: Record<string, string> = {
  NOT_STARTED: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  IN_PROGRESS: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  SUBMITTED: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  APPROVED: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  EXPIRED: "bg-red-500/15 text-red-500 border-red-500/20",
  REJECTED: "bg-red-500/15 text-red-500 border-red-500/20",
  TRIALING: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  ACTIVE: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  PAST_DUE: "bg-red-500/15 text-red-500 border-red-500/20",
  CANCELLED: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

const TIER_CLASS: Record<string, string> = {
  Starter: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  Growth: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  Scale: "bg-purple-500/15 text-purple-500 border-purple-500/20",
  Enterprise: "bg-amber-500/15 text-amber-600 border-amber-500/20",
};

export function PMProfileDetail({
  merchantAppId,
}: {
  merchantAppId: string;
}) {
  const [data, setData] = useState<ProfileData>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedProps, setExpandedProps] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [actionInput, setActionInput] = useState("");

  async function fetchProfile() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/merchants/${merchantAppId}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function fetchNotes() {
    try {
      const res = await fetch(`/api/admin/merchants/${merchantAppId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get-notes" }),
      });
      if (res.ok) {
        const d = await res.json();
        setNotes(d.notes || []);
      }
    } catch {}
  }

  async function saveNote() {
    if (!newNote.trim()) return;
    setNoteSaving(true);
    try {
      const res = await fetch(`/api/admin/merchants/${merchantAppId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add-note", content: newNote }),
      });
      if (res.ok) {
        setNewNote("");
        fetchNotes();
        toast.success("Note added");
      }
    } finally {
      setNoteSaving(false);
    }
  }

  useEffect(() => {
    fetchProfile();
    fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantAppId]);

  async function runAction(action: string, payload: any = {}) {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/admin/merchants/${merchantAppId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Done");
        fetchProfile();
      } else {
        toast.error(d.error || "Failed");
      }
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data?.app) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        Merchant application not found.
      </div>
    );
  }

  const app = data.app;
  const pm = app.user;
  const tier = data.tier;
  const initials = (pm?.name || "?")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  function toggleProp(id: string) {
    setExpandedProps((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <Link
        href="/admin/merchants"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Merchants
      </Link>

      {/* Identity header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-2xl font-bold text-primary">{initials}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">{pm?.name || "Unknown"}</h1>
            <p className="text-sm text-muted-foreground">{pm?.email}</p>
            {pm?.companyName && (
              <p className="text-sm text-muted-foreground">
                {pm.companyName}
              </p>
            )}
            {pm?.phone && (
              <p className="text-xs text-muted-foreground">{pm.phone}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className={TIER_CLASS[pm?.currentTier] || TIER_CLASS.Starter}
          >
            {pm?.currentTier || "Starter"}
          </Badge>
          <Badge
            variant="outline"
            className={
              STATUS_CLASS[pm?.subscription?.status] || STATUS_CLASS.CANCELLED
            }
          >
            {(pm?.subscription?.status || "No sub").replace("_", " ")}
          </Badge>
          <Badge
            variant="outline"
            className={STATUS_CLASS[app.status] || STATUS_CLASS.NOT_STARTED}
          >
            Merchant: {app.status.replace("_", " ")}
          </Badge>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <Stat label="Units" value={data.unitCount} />
        <Stat label="Properties" value={data.propertyCount} />
        <Stat label="Tenants" value={data.tenantCount} />
        <Stat
          label="30d Revenue"
          value={formatCurrency(data.volume?.total ?? 0)}
        />
        <Stat
          label="Member Since"
          value={pm?.createdAt ? formatDate(pm.createdAt) : "—"}
        />
        <Stat label="Kadima App" value={app.kadimaAppId || "—"} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap " +
              (tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Onboarding */}
          <Card className="border-border">
            <CardContent className="p-5 space-y-3">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Onboarding
              </h3>
              {[
                {
                  label: "Merchant app started",
                  done: pm?.onboardingMerchantStarted,
                },
                { label: "Property added", done: pm?.onboardingPropertyAdded },
                { label: "Tenant added", done: pm?.onboardingTenantAdded },
                { label: "Invite sent", done: pm?.onboardingInviteSent },
                {
                  label: "Payment method on file",
                  done: !!pm?.kadimaCardTokenId,
                },
                {
                  label: "Merchant approved",
                  done: app.status === "APPROVED",
                },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <div
                    className={
                      "h-5 w-5 rounded-full flex items-center justify-center text-[10px] " +
                      (s.done
                        ? "bg-emerald-500 text-white"
                        : "border-2 border-muted-foreground/30")
                    }
                  >
                    {s.done ? "✓" : ""}
                  </div>
                  <span className="text-sm">{s.label}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Subscription */}
          <Card className="border-border">
            <CardContent className="p-5 space-y-2">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Subscription
              </h3>
              <div className="text-sm space-y-1">
                <Row
                  label="Status"
                  value={pm?.subscription?.status || "None"}
                />
                <Row
                  label="Trial Ends"
                  value={
                    pm?.subscription?.trialEndsAt
                      ? formatDate(pm.subscription.trialEndsAt)
                      : "—"
                  }
                />
                <Row
                  label="Per-Unit Cost"
                  value={`$${tier?.perUnitCost?.toFixed(2) ?? "?"}/unit`}
                />
                <Row
                  label="Payment Method"
                  value={pm?.kadimaCardTokenId ? "On file" : "None"}
                />
              </div>
            </CardContent>
          </Card>

          {/* Merchant Application */}
          <Card className="border-border">
            <CardContent className="p-5 space-y-2">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Merchant Application
              </h3>
              <div className="text-sm space-y-1">
                <Row label="Status" value={app.status.replace("_", " ")} />
                <Row label="Kadima App ID" value={app.kadimaAppId || "—"} />
                <Row label="Step" value={`${app.currentStep}/5`} />
                <Row
                  label="Created"
                  value={formatDate(app.createdAt)}
                />
                {app.kadimaApplicationUrl && (
                  <div className="pt-2">
                    <a
                      href={app.kadimaApplicationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open Kadima Application
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tier & Earnings */}
          <Card className="border-border">
            <CardContent className="p-5 space-y-2">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Tier & Rates
              </h3>
              <div className="text-sm space-y-1">
                <Row label="Tier" value={tier?.name || "Starter"} />
                <Row label="Units" value={String(data.unitCount)} />
                {data.nextTier && (
                  <Row
                    label="Next Tier"
                    value={`${data.nextTier.name} at ${data.nextTier.minUnits} units`}
                  />
                )}
                <Row
                  label="ACH Platform Cost"
                  value={`$${tier?.platformAchCost?.toFixed(2) ?? "?"}`}
                />
                <Row
                  label="Card Earnings"
                  value={`${((tier?.cardRate ?? 0) * 100).toFixed(2)}%`}
                />
                <Row
                  label="Fee Schedule"
                  value={tier?.feeScheduleLocked ? "Locked" : "Unlocked"}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "kadima" && (
        <div className="space-y-4">
          <Card className="border-border">
            <CardContent className="p-5 space-y-2">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Kadima Configuration
              </h3>
              <div className="text-sm space-y-1">
                <Row label="App ID" value={app.kadimaAppId || "—"} />
                <Row
                  label="Application URL"
                  value={
                    app.kadimaApplicationUrl ? (
                      <a
                        href={app.kadimaApplicationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open
                      </a>
                    ) : (
                      "—"
                    )
                  }
                />
                <Row
                  label="Campaign Rates"
                  value={`Card ${((tier?.platformCardRate ?? 0) * 100).toFixed(2)}%, ACH $${tier?.platformAchCost?.toFixed(2) ?? "?"}`}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-5 space-y-3">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Terminal Assignments
              </h3>
              {(pm?.properties ?? []).map((p: any) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.address}, {p.city}, {p.state}
                    </p>
                  </div>
                  <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                    TID: {p.kadimaTerminalId || "Not assigned"}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-5 space-y-2">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                30-Day Processing Volume
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat
                  label="Card Txns"
                  value={String(data.volume?.cardCount ?? 0)}
                />
                <Stat
                  label="Card Volume"
                  value={formatCurrency(data.volume?.cardTotal ?? 0)}
                />
                <Stat
                  label="ACH Txns"
                  value={String(data.volume?.achCount ?? 0)}
                />
                <Stat
                  label="ACH Volume"
                  value={formatCurrency(data.volume?.achTotal ?? 0)}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "properties" && (
        <div className="space-y-3">
          {(pm?.properties ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No properties yet.
            </p>
          ) : (
            (pm?.properties ?? []).map((prop: any) => {
              const isExpanded = expandedProps.has(prop.id);
              return (
                <Card key={prop.id} className="border-border overflow-hidden">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between p-4 text-left"
                    onClick={() => toggleProp(prop.id)}
                  >
                    <div>
                      <p className="font-medium text-sm">{prop.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {prop.address}, {prop.city}, {prop.state} {prop.zip}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {prop.units.length} unit
                        {prop.units.length !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                        TID: {prop.kadimaTerminalId || "—"}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t px-4 py-2 divide-y">
                      {prop.units.map((u: any) => {
                        const tenant =
                          u.tenantProfiles?.[0]?.user?.name || null;
                        return (
                          <div
                            key={u.id}
                            className="flex items-center justify-between py-2 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {u.unitNumber || u.name || "Unit"}
                              </span>
                              {tenant && (
                                <span className="text-xs text-muted-foreground">
                                  {tenant}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {u.rentAmount && (
                                <span className="text-xs text-muted-foreground">
                                  {formatCurrency(Number(u.rentAmount))}
                                </span>
                              )}
                              <Badge
                                variant="outline"
                                className={
                                  tenant
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                    : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                                }
                              >
                                {tenant ? "Occupied" : "Vacant"}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {tab === "financial" && (
        <div className="space-y-6">
          {/* Fee Schedules */}
          <Card className="border-border">
            <CardContent className="p-5 space-y-3">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Fee Schedules
              </h3>
              {(pm?.feeSchedules ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No fee schedules created.
                </p>
              ) : (
                (pm?.feeSchedules ?? []).map((fs: any) => (
                  <div
                    key={fs.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <span className="text-sm font-medium">{fs.name}</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>ACH: ${Number(fs.achRate).toFixed(2)}</span>
                      <span>
                        Mgmt: {Number(fs.managementFeePercent).toFixed(1)}%
                      </span>
                      <span>Pays: {fs.achFeeResponsibility}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Recent Payments */}
          <Card className="border-border">
            <CardContent className="p-5 space-y-3">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Recent Payments
              </h3>
              {data.recentPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No payment activity.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground uppercase tracking-wider border-b">
                        <th className="text-left py-2 pr-4">Date</th>
                        <th className="text-left py-2 pr-4">Tenant</th>
                        <th className="text-right py-2 pr-4">Amount</th>
                        <th className="text-center py-2 pr-4">Method</th>
                        <th className="text-center py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentPayments.map((p: any) => (
                        <tr key={p.id} className="border-b last:border-0">
                          <td className="py-2 pr-4 text-xs text-muted-foreground">
                            {formatDate(p.createdAt)}
                          </td>
                          <td className="py-2 pr-4 text-xs">
                            {p.tenant?.user?.name || "—"}
                          </td>
                          <td className="py-2 pr-4 text-right font-medium">
                            {formatCurrency(Number(p.amount))}
                          </td>
                          <td className="py-2 pr-4 text-center">
                            <Badge variant="outline" className="text-[10px]">
                              {p.paymentMethod || "—"}
                            </Badge>
                          </td>
                          <td className="py-2 text-center">
                            <Badge
                              variant="outline"
                              className={
                                STATUS_CLASS[p.status] ||
                                "bg-zinc-500/15 text-zinc-400"
                              }
                            >
                              {p.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "team" && (
        <Card className="border-border">
          <CardContent className="p-5 space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              Team Members
            </h3>
            {(pm?.teamOwned ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No team members.
              </p>
            ) : (
              (pm?.teamOwned ?? []).map((m: any) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {m.name || m.email}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{m.role}</Badge>
                    <Badge
                      variant="outline"
                      className={
                        m.status === "ACTIVE"
                          ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20"
                          : "bg-amber-500/15 text-amber-500 border-amber-500/20"
                      }
                    >
                      {m.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Notes Tab ──────────────────────────────── */}
      {tab === "notes" && (
        <div className="space-y-4 max-w-2xl">
          <div className="flex gap-2">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add an internal note (only visible to admins)..."
              rows={2}
              className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <Button
              onClick={saveNote}
              disabled={noteSaving || !newNote.trim()}
              className="self-end"
            >
              {noteSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Add"
              )}
            </Button>
          </div>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No notes yet.
            </p>
          ) : (
            notes.map((n: any) => (
              <Card key={n.id} className="border-border">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {n.author?.name || "Admin"} &middot;{" "}
                      {formatDate(n.createdAt)}
                    </span>
                    {n.isPinned && (
                      <span className="text-[10px] font-medium text-primary">
                        Pinned
                      </span>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── Actions Tab (expanded with groups) ────── */}
      {tab === "actions" && (
        <div className="space-y-6">
          {/* Account */}
          <ActionGroup label="Account">
            <ActionCard
              title="Reset Password"
              description="Send a password reset email"
              icon={<Mail className="h-5 w-5" />}
              loading={actionLoading === "reset-password"}
              onClick={() => runAction("reset-password")}
            />
            <ActionCard
              title="Change Email"
              description="Update the PM's email address"
              icon={<Settings className="h-5 w-5" />}
              loading={actionLoading === "change-email"}
              onClick={() => {
                const email = prompt("New email address:");
                if (email) runAction("change-email", { value: email });
              }}
            />
            <ActionCard
              title="View as PM"
              description="Impersonate this PM's dashboard"
              icon={<Eye className="h-5 w-5 text-amber-500" />}
              loading={false}
              onClick={() => {
                if (pm?.id) window.open(`/admin/impersonate/${pm.id}`, "_blank");
              }}
            />
          </ActionGroup>

          {/* Subscription */}
          <ActionGroup label="Subscription">
            <ActionCard
              title="Extend Trial"
              description="Add days to the trial period"
              icon={<Clock className="h-5 w-5" />}
              loading={actionLoading === "extend-trial"}
              onClick={() => {
                const days = prompt("Days to add:", "7");
                if (days) runAction("extend-trial", { value: days });
              }}
            />
            <ActionCard
              title="Suspend Subscription"
              description="Block dashboard + payment processing"
              icon={<Ban className="h-5 w-5 text-red-500" />}
              loading={actionLoading === "suspend-subscription"}
              onClick={() => {
                if (confirm("Suspend?")) runAction("suspend-subscription");
              }}
            />
            <ActionCard
              title="Cancel Subscription"
              description="Permanently cancel (type CANCEL)"
              icon={<Ban className="h-5 w-5 text-red-500" />}
              loading={actionLoading === "cancel-subscription"}
              onClick={() => {
                const c = prompt("Type CANCEL to confirm:");
                if (c === "CANCEL") runAction("cancel-subscription", { confirm: "CANCEL" });
              }}
            />
          </ActionGroup>

          {/* Merchant Application */}
          <ActionGroup label="Merchant Application">
            <ActionCard
              title="Resend Completion Link"
              description="Email the Kadima application URL"
              icon={<Mail className="h-5 w-5" />}
              loading={actionLoading === "resend-link"}
              onClick={() => runAction("resend-link")}
            />
            <ActionCard
              title="Extend Deadline +15d"
              description="Add 15 days to expiry window"
              icon={<Clock className="h-5 w-5" />}
              loading={actionLoading === "extend"}
              onClick={() => runAction("extend")}
            />
            <ActionCard
              title="Force Approve"
              description="Manually approve (bypass Kadima)"
              icon={<CheckCircle className="h-5 w-5 text-emerald-500" />}
              loading={actionLoading === "force-approve"}
              onClick={() => {
                if (confirm("Force approve?")) runAction("force-approve");
              }}
            />
            <ActionCard
              title="Force Expire"
              description="Immediately expire the application"
              icon={<Ban className="h-5 w-5 text-red-500" />}
              loading={actionLoading === "expire"}
              onClick={() => {
                if (confirm("Expire?")) runAction("expire");
              }}
            />
            <ActionCard
              title="Reset Application"
              description="Clear and start fresh (type RESET)"
              icon={<Ban className="h-5 w-5 text-red-500" />}
              loading={actionLoading === "reset-application"}
              onClick={() => {
                const c = prompt("Type RESET to confirm:");
                if (c === "RESET") runAction("reset-application", { confirm: "RESET" });
              }}
            />
          </ActionGroup>

          {/* Kadima */}
          <ActionGroup label="Kadima Configuration">
            <ActionCard
              title="Assign Terminal"
              description="Set terminal ID on a property"
              icon={<Server className="h-5 w-5" />}
              loading={actionLoading === "assign-terminal"}
              onClick={() => {
                const propertyId = prompt("Property ID:");
                const terminalId = prompt("Terminal ID:");
                if (propertyId && terminalId) runAction("assign-terminal", { propertyId, terminalId });
              }}
            />
            <ActionCard
              title="Set Campaign ID"
              description="Update the Kadima campaign"
              icon={<Settings className="h-5 w-5" />}
              loading={actionLoading === "set-campaign-id"}
              onClick={() => {
                const v = prompt("Campaign ID:");
                if (v) runAction("set-campaign-id", { value: v });
              }}
            />
            <ActionCard
              title="Mark Campaign Updated"
              description="Confirm rates are set in Kadima"
              icon={<CheckCircle className="h-5 w-5 text-emerald-500" />}
              loading={actionLoading === "mark-campaign-updated"}
              onClick={() => runAction("mark-campaign-updated")}
            />
          </ActionGroup>

          {/* Tier */}
          <ActionGroup label="Tier Management">
            <ActionCard
              title="Force Tier Override"
              description="Manually set tier (locks auto-calc)"
              icon={<Zap className="h-5 w-5 text-amber-500" />}
              loading={actionLoading === "force-tier"}
              onClick={() => {
                const t = prompt("Tier (Starter, Growth, Scale, Enterprise):");
                if (t) runAction("force-tier", { value: t });
              }}
            />
            <ActionCard
              title="Lock Tier"
              description="Prevent auto tier calculation"
              icon={<Settings className="h-5 w-5" />}
              loading={actionLoading === "lock-tier"}
              onClick={() => runAction("lock-tier")}
            />
            <ActionCard
              title="Unlock Tier"
              description="Resume automatic tier calculation"
              icon={<CheckCircle className="h-5 w-5 text-emerald-500" />}
              loading={actionLoading === "unlock-tier"}
              onClick={() => runAction("unlock-tier")}
            />
          </ActionGroup>

          {/* Financial */}
          <ActionGroup label="Financial">
            <ActionCard
              title="Freeze Payouts"
              description="Stop all owner payouts"
              icon={<Ban className="h-5 w-5 text-red-500" />}
              loading={actionLoading === "freeze-payouts"}
              onClick={() => {
                if (confirm("Freeze payouts?")) runAction("freeze-payouts");
              }}
            />
            <ActionCard
              title="Unfreeze Payouts"
              description="Resume owner payouts"
              icon={<CheckCircle className="h-5 w-5 text-emerald-500" />}
              loading={actionLoading === "unfreeze-payouts"}
              onClick={() => runAction("unfreeze-payouts")}
            />
          </ActionGroup>

          {/* Communication */}
          <ActionGroup label="Communication">
            <ActionCard
              title="Send Notification"
              description="Create an in-app notification"
              icon={<Mail className="h-5 w-5" />}
              loading={actionLoading === "send-notification"}
              onClick={() => {
                const msg = prompt("Notification message:");
                if (msg) runAction("send-notification", { value: msg });
              }}
            />
            <ActionCard
              title="Send Custom Email"
              description="Compose and send a branded email"
              icon={<Mail className="h-5 w-5" />}
              loading={actionLoading === "send-email"}
              onClick={() => {
                const subject = prompt("Email subject:");
                const emailBody = prompt("Email body:");
                if (subject && emailBody) runAction("send-email", { subject, body: emailBody });
              }}
            />
          </ActionGroup>
        </div>
      )}
    </div>
  );
}

/* ── Helper components ──────────────────────────────── */

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="border-border">
      <CardContent className="p-3">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {label}
        </div>
        <div className="text-lg font-bold mt-0.5 truncate">{value}</div>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function ActionCard({
  title,
  description,
  icon,
  loading,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="rounded-xl border bg-card p-5 text-left hover:border-primary/30 hover:shadow-sm transition-all disabled:opacity-50"
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            icon
          )}
        </div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}

function ActionGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

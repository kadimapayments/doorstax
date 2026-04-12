"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { AGENT_KICKBACK_RATES } from "@/lib/residual-tiers";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Copy,
  Users,
  DollarSign,
  FileText,
  Settings,
  Activity,
  CheckCircle,
  Ban,
  Mail,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const TABS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "pms", label: "Referred PMs", icon: Users },
  { id: "payouts", label: "Payouts", icon: DollarSign },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "actions", label: "Actions", icon: Settings },
];

const BASE =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://doorstax.com";

export default function AgentProfilePage() {
  const params = useParams();
  const agentId = params.id as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/agents/${agentId}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  // Bank form state
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState("checking");
  const [savingBank, setSavingBank] = useState(false);

  async function handleSaveBank() {
    setSavingBank(true);
    try {
      const res = await fetch(`/api/admin/agents/${agentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-bank",
          bankName,
          accountHolderName: accountHolder,
          routingNumber,
          accountNumber,
          accountType,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Payout account saved and vaulted");
        setShowBankForm(false);
        setBankName("");
        setAccountHolder("");
        setRoutingNumber("");
        setAccountNumber("");
        fetchData();
      } else {
        toast.error(d.error || "Failed to save bank info");
      }
    } finally {
      setSavingBank(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  async function runAction(action: string, payload: any = {}) {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/admin/agents/${agentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      if (res.ok) {
        toast.success("Done");
        fetchData();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Failed");
      }
    } finally {
      setActionLoading(null);
    }
  }

  function copyLink() {
    const code = data?.user?.referralCode;
    if (code) {
      navigator.clipboard.writeText(`${BASE}/register?ref=${code}`);
      toast.success("Link copied");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data?.user) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        Agent not found.
      </div>
    );
  }

  const { user, profile, referredPMs, lifetimeEarnings, pendingPayouts } =
    data;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/agents"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Agent Network
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          {user.companyName && (
            <p className="text-sm text-muted-foreground">
              {user.companyName}
            </p>
          )}
          {user.referralCode && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                {BASE}/register?ref={user.referralCode}
              </span>
              <button onClick={copyLink}>
                <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          )}
        </div>
        <Badge
          variant="outline"
          className={
            profile?.status === "ACTIVE"
              ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20"
              : "bg-zinc-500/15 text-zinc-400 border-zinc-500/20"
          }
        >
          {profile?.status || "No Profile"}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Referred PMs" value={referredPMs?.length ?? 0} />
        <Stat
          label="Lifetime Earnings"
          value={formatCurrency(lifetimeEarnings ?? 0)}
        />
        <Stat
          label="Pending Payouts"
          value={formatCurrency(pendingPayouts ?? 0)}
        />
        <Stat
          label="W-9 Status"
          value={profile?.w9Status?.replace("_", " ") || "N/A"}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap " +
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

      {/* Overview */}
      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border">
            <CardContent className="p-5 space-y-2">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Contact
              </h3>
              <Row label="Name" value={user.name} />
              <Row label="Email" value={user.email} />
              <Row label="Phone" value={user.phone || "—"} />
              <Row label="Company" value={user.companyName || "—"} />
              <Row label="Joined" value={formatDate(user.createdAt)} />
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                  Payout Account
                </h3>
                {profile?.kadimaCustomerId && (
                  <span className="text-xs bg-emerald-500/15 text-emerald-500 px-2 py-0.5 rounded-full">
                    Vault Linked
                  </span>
                )}
              </div>
              {profile?.bankAccountLast4 ? (
                <div className="space-y-2">
                  <Row
                    label="Bank"
                    value={profile.bankName || "Bank Account"}
                  />
                  <Row
                    label="Account"
                    value={`••••${profile.bankAccountLast4}`}
                  />
                  <Row
                    label="Routing"
                    value={`••••${profile.bankRoutingLast4 || "????"}`}
                  />
                  <button
                    onClick={() => setShowBankForm(true)}
                    className="text-xs text-primary hover:underline mt-1"
                  >
                    Update Bank Info
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    No payout account on file.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setShowBankForm(true)}
                  >
                    Set Up Payout Account
                  </Button>
                </div>
              )}

              {/* Bank form inline */}
              {showBankForm && (
                <div className="mt-3 border-t pt-3 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Bank details are vaulted via Kadima. Only last 4 digits
                    stored.
                  </p>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="Bank Name *"
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                      placeholder="Account Holder Name *"
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        maxLength={9}
                        value={routingNumber}
                        onChange={(e) =>
                          setRoutingNumber(
                            e.target.value.replace(/\D/g, "")
                          )
                        }
                        placeholder="Routing (9 digits) *"
                        className="rounded-lg border bg-background px-3 py-2 text-sm font-mono"
                      />
                      <input
                        type="text"
                        value={accountNumber}
                        onChange={(e) =>
                          setAccountNumber(
                            e.target.value.replace(/\D/g, "")
                          )
                        }
                        placeholder="Account Number *"
                        className="rounded-lg border bg-background px-3 py-2 text-sm font-mono"
                      />
                    </div>
                    <select
                      value={accountType}
                      onChange={(e) => setAccountType(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    >
                      <option value="checking">Checking</option>
                      <option value="savings">Savings</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveBank}
                      disabled={
                        savingBank ||
                        !bankName ||
                        !accountHolder ||
                        routingNumber.length !== 9 ||
                        !accountNumber
                      }
                    >
                      {savingBank ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : null}
                      Save &amp; Vault
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowBankForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border-border col-span-full">
            <CardContent className="p-5 space-y-2">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Kickback Rates
              </h3>
              <div className="grid grid-cols-4 gap-3">
                {Object.entries(AGENT_KICKBACK_RATES).map(([tier, rate]) => (
                  <div key={tier} className="text-center p-3 rounded-lg border">
                    <div className="text-xs text-muted-foreground">{tier}</div>
                    <div className="text-lg font-bold mt-1">
                      ${rate.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      per transacting unit
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Referred PMs */}
      {tab === "pms" && (
        <div className="space-y-3">
          {(!referredPMs || referredPMs.length === 0) ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No PMs referred yet.
            </p>
          ) : (
            referredPMs.map((pm: any) => (
              <Card key={pm.id} className="border-border">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-sm">{pm.name || pm.email}</p>
                    <p className="text-xs text-muted-foreground">{pm.email}</p>
                    {pm.company && (
                      <p className="text-xs text-muted-foreground">
                        {pm.company}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <Badge variant="outline">{pm.tier || "Starter"}</Badge>
                    <span className="text-muted-foreground">
                      {pm.totalUnits} units
                    </span>
                    <Link
                      href={`/admin/merchants`}
                      className="text-primary hover:underline"
                    >
                      View →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Payouts */}
      {tab === "payouts" && (
        <div className="space-y-3">
          {(!profile?.payouts || profile.payouts.length === 0) ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No payouts yet.
            </p>
          ) : (
            profile.payouts.map((p: any) => (
              <Card key={p.id} className="border-border">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium">{p.period}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.transactingUnits} transacting units
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold">
                      {formatCurrency(p.amount)}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        p.status === "COMPLETED"
                          ? "bg-emerald-500/15 text-emerald-500"
                          : p.status === "FAILED"
                            ? "bg-red-500/15 text-red-500"
                            : "bg-amber-500/15 text-amber-500"
                      }
                    >
                      {p.status}
                    </Badge>
                    {p.status === "PENDING" && (
                      <Button
                        size="sm"
                        onClick={() =>
                          runAction("process-payout", { payoutId: p.id })
                        }
                        disabled={actionLoading === "process-payout"}
                      >
                        {actionLoading === "process-payout" ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Process"
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Documents */}
      {tab === "documents" && (
        <div className="space-y-4">
          <Card className="border-border">
            <CardContent className="p-5 space-y-3">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                W-9 Status
              </h3>
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={
                    profile?.w9Status === "VERIFIED"
                      ? "bg-emerald-500/15 text-emerald-500"
                      : profile?.w9Status === "RECEIVED"
                        ? "bg-blue-500/15 text-blue-500"
                        : profile?.w9Status === "REQUESTED"
                          ? "bg-amber-500/15 text-amber-500"
                          : "bg-zinc-500/15 text-zinc-400"
                  }
                >
                  {(profile?.w9Status || "NOT_REQUESTED").replace("_", " ")}
                </Badge>
                {profile?.w9Status !== "VERIFIED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runAction("request-w9")}
                    disabled={actionLoading === "request-w9"}
                  >
                    <Mail className="h-3.5 w-3.5 mr-1" />
                    {profile?.w9Status === "REQUESTED"
                      ? "Resend W-9 Request"
                      : "Request W-9"}
                  </Button>
                )}
                {profile?.w9Status === "RECEIVED" && (
                  <Button
                    size="sm"
                    onClick={() => runAction("verify-w9")}
                    disabled={actionLoading === "verify-w9"}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                    Verify
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-5 space-y-3">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Documents
              </h3>
              {(!profile?.documents || profile.documents.length === 0) ? (
                <p className="text-sm text-muted-foreground">
                  No documents uploaded.
                </p>
              ) : (
                profile.documents.map((d: any) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.type} &middot;{" "}
                        {d.fileSizeMb
                          ? `${d.fileSizeMb.toFixed(1)} MB`
                          : ""}
                      </p>
                    </div>
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      Download
                    </a>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Actions */}
      {tab === "actions" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ActionCard
            title="Request W-9"
            description="Send W-9 request email"
            icon={<Mail className="h-5 w-5" />}
            loading={actionLoading === "request-w9"}
            onClick={() => runAction("request-w9")}
          />
          <ActionCard
            title={
              profile?.status === "ACTIVE" ? "Deactivate" : "Reactivate"
            }
            description={
              profile?.status === "ACTIVE"
                ? "Pause this agent's account"
                : "Re-enable this agent"
            }
            icon={
              profile?.status === "ACTIVE" ? (
                <Ban className="h-5 w-5 text-red-500" />
              ) : (
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              )
            }
            loading={
              actionLoading === "deactivate" ||
              actionLoading === "reactivate"
            }
            onClick={() =>
              runAction(
                profile?.status === "ACTIVE" ? "deactivate" : "reactivate"
              )
            }
          />
        </div>
      )}
    </div>
  );
}

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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
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

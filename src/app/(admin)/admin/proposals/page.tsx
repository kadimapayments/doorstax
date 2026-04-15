"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Loader2,
  FileText,
  ExternalLink,
  Send,
  ChevronDown,
  ChevronRight,
  Eye,
  MousePointerClick,
  CheckCircle2,
  Mail,
  Clock,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUS_CLASS: Record<string, string> = {
  DRAFT: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  SENT: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  OPENED: "bg-purple-500/15 text-purple-500 border-purple-500/20",
  CLICKED: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  CONVERTED: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  EXPIRED: "bg-red-500/15 text-red-500 border-red-500/20",
};

function fmtFullDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminProposalsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resendOpen, setResendOpen] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [resending, setResending] = useState(false);

  function reload() {
    setLoading(true);
    fetch("/api/admin/proposals")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  // Close resend dropdown on click-outside or ESC
  useEffect(() => {
    if (!resendOpen) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-resend-dropdown]")) {
        setResendOpen(null);
        setNewEmail("");
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setResendOpen(null);
        setNewEmail("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [resendOpen]);

  async function handleResend(id: string, email: string) {
    if (!email) return;
    setResending(true);
    try {
      const res = await fetch("/api/admin/proposals/" + id + "/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        toast.success("Proposal resent to " + email);
        setResendOpen(null);
        setNewEmail("");
        reload();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to resend");
      }
    } finally {
      setResending(false);
    }
  }

  const rows = data?.rows || [];
  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proposals"
        description="Track pricing proposals sent to prospects — opens, clicks, and conversions."
      />

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <Stat label="Total Sent" value={stats.total} />
          <Stat label="Opened" value={stats.opened} className="text-purple-500" />
          <Stat label="Clicked CTA" value={stats.clicked} className="text-amber-500" />
          <Stat label="Converted" value={stats.converted} className="text-emerald-500" />
          <Stat label="Open Rate" value={stats.openRate + "%"} />
          <Stat label="Conv. Rate" value={stats.conversionRate + "%"} className="text-emerald-500" />
          <Stat label="Pending" value={stats.sent} className="text-blue-500" />
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="border-border">
          <CardContent className="p-12 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No proposals sent yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Use the Profit Calculator to generate and email proposals.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="text-left p-3 w-8"></th>
                    <th className="text-left p-3">Prospect</th>
                    <th className="text-left p-3">Company</th>
                    <th className="text-right p-3">Units</th>
                    <th className="text-right p-3">Monthly Value</th>
                    <th className="text-left p-3">Agent</th>
                    <th className="text-left p-3">Sent</th>
                    <th className="text-center p-3">Status</th>
                    <th className="text-center p-3">Opens</th>
                    <th className="text-center p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => {
                    const isExpanded = expandedId === r.id;
                    return (
                      <ProposalRow
                        key={r.id}
                        r={r}
                        isExpanded={isExpanded}
                        onToggle={() => setExpandedId(isExpanded ? null : r.id)}
                        resendOpen={resendOpen}
                        setResendOpen={setResendOpen}
                        newEmail={newEmail}
                        setNewEmail={setNewEmail}
                        resending={resending}
                        onResend={handleResend}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ProposalRow({
  r,
  isExpanded,
  onToggle,
  resendOpen,
  setResendOpen,
  newEmail,
  setNewEmail,
  resending,
  onResend,
}: {
  r: any;
  isExpanded: boolean;
  onToggle: () => void;
  resendOpen: string | null;
  setResendOpen: (id: string | null) => void;
  newEmail: string;
  setNewEmail: (v: string) => void;
  resending: boolean;
  onResend: (id: string, email: string) => void;
}) {
  return (
    <>
      <tr
        className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
        onClick={onToggle}
      >
        <td className="p-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </td>
        <td className="p-3" onClick={(e) => e.stopPropagation()}>
          {r.leadId ? (
            <Link
              href={"/admin/leads/" + r.leadId}
              className="font-medium text-primary hover:underline"
            >
              {r.prospectName}
            </Link>
          ) : (
            <span className="font-medium">{r.prospectName}</span>
          )}
          <p className="text-xs text-muted-foreground">{r.prospectEmail}</p>
          {r.leadId && r.leadStatus && (
            <Link
              href={"/admin/leads/" + r.leadId}
              className="text-[10px] text-primary hover:underline"
            >
              Lead: {r.leadStatus?.replace(/_/g, " ")}
            </Link>
          )}
        </td>
        <td className="p-3 text-muted-foreground">{r.prospectCompany || "—"}</td>
        <td className="p-3 text-right">{r.unitCount}</td>
        <td className="p-3 text-right">{formatCurrency(r.softwareCost)}</td>
        <td className="p-3">
          <div className="text-xs">{r.agentName}</div>
          {r.agentId && (
            <div className="text-[10px] text-muted-foreground font-mono">
              {r.agentId}
            </div>
          )}
        </td>
        <td className="p-3 text-xs text-muted-foreground">
          {r.sentAt ? formatDate(r.sentAt) : "—"}
        </td>
        <td className="p-3 text-center">
          <Badge
            variant="outline"
            className={STATUS_CLASS[r.status] || STATUS_CLASS.DRAFT}
          >
            {r.status}
          </Badge>
        </td>
        <td className="p-3 text-center text-xs text-muted-foreground">
          {r.openCount > 0 ? r.openCount : "—"}
        </td>
        <td
          className="p-3 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-center gap-2">
            {r.pdfUrl && (
              <a
                href={r.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                title="View PDF"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <div className="relative" data-resend-dropdown>
              <button
                onClick={() =>
                  setResendOpen(resendOpen === r.id ? null : r.id)
                }
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                title="Resend"
              >
                <Send className="h-3 w-3" />
              </button>
              {resendOpen === r.id && (
                <div
                  data-resend-dropdown
                  className="absolute z-20 right-0 mt-1 w-72 rounded-lg border bg-card shadow-lg p-3 space-y-3 text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">Resend Proposal</span>
                    <button
                      onClick={() => {
                        setResendOpen(null);
                        setNewEmail("");
                      }}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Close"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => onResend(r.id, r.prospectEmail)}
                    disabled={resending}
                    className="w-full text-left text-sm hover:bg-muted rounded px-2 py-1.5 disabled:opacity-50"
                  >
                    {resending ? "Sending..." : "Resend to " + r.prospectEmail}
                  </button>
                  <div className="border-t pt-2">
                    <label className="text-xs font-medium">
                      Send to different email:
                    </label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="new@email.com"
                        className="flex-1 rounded border bg-background px-2 py-1 text-xs"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newEmail) {
                            onResend(r.id, newEmail);
                          }
                        }}
                      />
                      <button
                        onClick={() => onResend(r.id, newEmail)}
                        disabled={!newEmail || resending}
                        className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b bg-muted/10">
          <td colSpan={10} className="p-5">
            <ExpandedDetail r={r} />
          </td>
        </tr>
      )}
    </>
  );
}

function ExpandedDetail({ r }: { r: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {/* Parameters */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Proposal Parameters
        </h4>
        <dl className="space-y-1.5 text-sm">
          <Row label="Quote ID" value={<span className="font-mono text-xs">{r.quoteId}</span>} />
          <Row label="Units" value={r.unitCount} />
          <Row label="Tier" value={r.tierName} />
          <Row label="Software Cost" value={formatCurrency(r.softwareCost) + "/mo"} />
          <Row
            label="Total Payment Earnings"
            value={formatCurrency(r.totalPaymentEarnings || 0) + "/mo"}
          />
          <Row
            label="Net Cost/Profit"
            value={
              <span className={r.netCostOrProfit >= 0 ? "text-emerald-500" : "text-red-500"}>
                {(r.netCostOrProfit >= 0 ? "+" : "") + formatCurrency(r.netCostOrProfit || 0)}
              </span>
            }
          />
        </dl>
      </div>

      {/* Tracking Timeline */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tracking Timeline
        </h4>
        <ol className="space-y-2.5 text-sm">
          <TimelineStep
            icon={<Mail className="h-3.5 w-3.5" />}
            label="Sent"
            time={r.sentAt}
            active={!!r.sentAt}
            accent="text-blue-500"
          />
          <TimelineStep
            icon={<Eye className="h-3.5 w-3.5" />}
            label={"Opened" + (r.openCount > 0 ? ` (${r.openCount}x)` : "")}
            time={r.openedAt}
            active={r.openCount > 0}
            accent="text-purple-500"
          />
          <TimelineStep
            icon={<MousePointerClick className="h-3.5 w-3.5" />}
            label="Clicked CTA"
            time={r.clickedAt}
            active={!!r.clickedAt}
            accent="text-amber-500"
          />
          <TimelineStep
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            label="Converted"
            time={r.convertedAt}
            active={r.status === "CONVERTED"}
            accent="text-emerald-500"
          />
        </ol>
      </div>

      {/* Actions & Links */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Links & Actions
        </h4>
        <div className="space-y-2 text-sm">
          {r.pdfUrl && (
            <a
              href={r.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-primary hover:underline"
            >
              <FileText className="h-3.5 w-3.5" />
              View PDF
            </a>
          )}
          {r.leadId && (
            <Link
              href={"/admin/leads/" + r.leadId}
              className="flex items-center gap-2 text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View Lead Profile
            </Link>
          )}
          {r.convertedPmId && (
            <Link
              href={"/admin/merchants/" + r.convertedPmId}
              className="flex items-center gap-2 text-emerald-500 hover:underline"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              View Converted PM
            </Link>
          )}
          <div className="pt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              Created {fmtFullDate(r.createdAt)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium text-xs">{value}</dd>
    </div>
  );
}

function TimelineStep({
  icon,
  label,
  time,
  active,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  time: string | null;
  active: boolean;
  accent: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <div
        className={
          "mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border " +
          (active
            ? accent + " border-current bg-current/10"
            : "text-muted-foreground/40 border-muted")
        }
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={"text-sm " + (active ? "font-medium" : "text-muted-foreground")}>
          {label}
        </p>
        {time && (
          <p className="text-xs text-muted-foreground">{fmtFullDate(time)}</p>
        )}
      </div>
    </li>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <Card className="border-border">
      <CardContent className="p-3">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {label}
        </div>
        <div className={`text-xl font-bold mt-0.5 ${className || ""}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

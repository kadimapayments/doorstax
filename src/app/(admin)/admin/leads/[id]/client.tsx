"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Clock,
  FileText,
  ExternalLink,
  User,
  Pencil,
  Save,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUS_CLASS: Record<string, string> = {
  NEW: "bg-blue-500/15 text-blue-500",
  CONTACTED: "bg-purple-500/15 text-purple-500",
  QUALIFIED: "bg-emerald-500/15 text-emerald-500",
  PROPOSAL_SENT: "bg-amber-500/15 text-amber-500",
  APPLIED: "bg-cyan-500/15 text-cyan-500",
  UNDERWRITING: "bg-indigo-500/15 text-indigo-500",
  ONBOARDING: "bg-teal-500/15 text-teal-500",
  CONVERTED: "bg-green-500/15 text-green-500",
  LOST: "bg-red-500/15 text-red-500",
};

const PROPOSAL_STATUS_CLASS: Record<string, string> = {
  DRAFT: "bg-zinc-500/15 text-zinc-400",
  SENT: "bg-blue-500/15 text-blue-500",
  OPENED: "bg-purple-500/15 text-purple-500",
  CLICKED: "bg-amber-500/15 text-amber-500",
  CONVERTED: "bg-emerald-500/15 text-emerald-500",
  EXPIRED: "bg-red-500/15 text-red-500",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtTime(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LeadDetailClient({ lead }: { lead: any }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(lead.notes || "");
  const [saving, setSaving] = useState(false);

  async function saveNotes() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/leads/" + lead.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        toast.success("Notes saved");
        setEditing(false);
      } else {
        toast.error("Failed to save notes");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/admin/leads")}
          className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <PageHeader
          title={lead.name}
          description={lead.email}
        />
        <Badge
          variant="outline"
          className={STATUS_CLASS[lead.status] || STATUS_CLASS.NEW}
        >
          {lead.status?.replace(/_/g, " ")}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Lead Info */}
        <div className="space-y-4">
          {/* Contact Info */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold">Contact Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{lead.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <a href={"mailto:" + lead.email} className="text-primary hover:underline">{lead.email}</a>
              </div>
              {lead.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{lead.phone}</span>
                </div>
              )}
              {lead.company && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{lead.company}</span>
                </div>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold">Details</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Source</span>
                <p className="font-medium">{lead.source}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Created</span>
                <p className="font-medium">{fmtDate(lead.createdAt)}</p>
              </div>
              {lead.units && (
                <div>
                  <span className="text-muted-foreground">Units</span>
                  <p className="font-medium">{lead.units}</p>
                </div>
              )}
              {lead.buildings && (
                <div>
                  <span className="text-muted-foreground">Buildings</span>
                  <p className="font-medium">{lead.buildings}</p>
                </div>
              )}
              {lead.assignedTo && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Assigned To</span>
                  <p className="font-medium">{lead.assignedTo.name}</p>
                </div>
              )}
              {lead.lastContactedAt && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Last Contacted</span>
                  <p className="font-medium">{fmtDate(lead.lastContactedAt)}</p>
                </div>
              )}
              {lead.convertedPmId && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Converted</span>
                  <p className="font-medium text-emerald-600">
                    {fmtDate(lead.convertedAt)} —{" "}
                    <Link href={"/admin/merchants/" + lead.convertedPmId} className="text-primary hover:underline">
                      View PM Profile
                    </Link>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Notes</h3>
              {!editing ? (
                <button onClick={() => setEditing(true)} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              ) : (
                <button onClick={saveNotes} disabled={saving} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Save className="h-3 w-3" /> {saving ? "Saving..." : "Save"}
                </button>
              )}
            </div>
            {editing ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            ) : (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {lead.notes || "No notes yet."}
              </p>
            )}
          </div>
        </div>

        {/* CENTER+RIGHT: Proposals + Activity */}
        <div className="lg:col-span-2 space-y-4">
          {/* Proposals */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Proposals ({lead.proposals?.length || 0})</h3>
              <button
                onClick={() =>
                  router.push(
                    "/admin/calculator?leadId=" + lead.id +
                      "&name=" + encodeURIComponent(lead.name || "") +
                      "&email=" + encodeURIComponent(lead.email || "") +
                      "&company=" + encodeURIComponent(lead.company || "")
                  )
                }
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5"
              >
                <FileText className="h-3.5 w-3.5" />
                Create Proposal
              </button>
            </div>
            {lead.proposals?.length > 0 ? (
              <div className="space-y-0">
                {lead.proposals.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between py-3 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">Quote #{p.quoteId}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.unitCount} units · {formatCurrency(p.softwareCost)}/mo · Tier: {p.tierName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Sent {fmtDate(p.sentAt)} {p.agentUser?.name ? "by " + p.agentUser.name : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={PROPOSAL_STATUS_CLASS[p.status] || PROPOSAL_STATUS_CLASS.DRAFT}>
                        {p.status}
                      </Badge>
                      {p.openCount > 0 && (
                        <span className="text-[10px] text-muted-foreground">Opened {p.openCount}x</span>
                      )}
                      {p.clickedAt && (
                        <span className="text-[10px] text-amber-500">CTA Clicked</span>
                      )}
                      {p.pdfUrl && (
                        <a href={p.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                          PDF
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No proposals linked to this lead yet.
              </p>
            )}
          </div>

          {/* Activity Timeline */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold">Activity Timeline</h3>
            {lead.activities?.length > 0 ? (
              <div className="space-y-0">
                {lead.activities.map((a: any) => (
                  <div key={a.id} className="flex gap-3 py-2.5 border-b last:border-0">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-primary/50" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{a.content || a.type?.replace(/_/g, " ")}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <Clock className="h-3 w-3" />
                        <span>{fmtDate(a.createdAt)} {fmtTime(a.createdAt)}</span>
                        {a.user?.name && (
                          <span>· {a.user.name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No activity recorded yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

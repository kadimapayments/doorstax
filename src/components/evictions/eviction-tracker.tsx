"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertTriangle,
  FileText,
  Upload,
  Pencil,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Plus,
  Gavel,
  Shield,
  Ban,
} from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EvictionData = any;

const STATUS_STEPS = [
  { key: "NOTICE_PENDING", label: "Notice Pending", icon: Clock },
  { key: "NOTICE_SERVED", label: "Notice Served", icon: FileText },
  { key: "CURE_PERIOD", label: "Cure Period", icon: Shield },
  { key: "FILING_PENDING", label: "Filing Pending", icon: FileText },
  { key: "FILED", label: "Filed", icon: Gavel },
  { key: "HEARING_SCHEDULED", label: "Hearing", icon: Gavel },
  { key: "JUDGMENT", label: "Judgment", icon: Gavel },
  { key: "WRIT_ISSUED", label: "Writ Issued", icon: Ban },
  { key: "COMPLETED", label: "Completed", icon: CheckCircle2 },
];

const REASONS = [
  { value: "NON_PAYMENT", label: "Non-Payment of Rent" },
  { value: "LEASE_VIOLATION", label: "Lease Violation" },
  { value: "UNAUTHORIZED_OCCUPANT", label: "Unauthorized Occupant" },
  { value: "PROPERTY_DAMAGE", label: "Property Damage" },
  { value: "ILLEGAL_ACTIVITY", label: "Illegal Activity" },
  { value: "OTHER", label: "Other" },
];

const NOTICE_TYPES = [
  { value: "PAY_OR_QUIT", label: "Pay or Quit" },
  { value: "CURE_OR_QUIT", label: "Cure or Quit" },
  { value: "UNCONDITIONAL_QUIT", label: "Unconditional Quit" },
  { value: "CUSTOM", label: "Custom Notice" },
];

interface Props {
  tenantId: string;
  tenantName: string;
  propertyName: string;
  unitNumber: string;
}

export function EvictionTracker({ tenantId }: Props) {
  const [eviction, setEviction] = useState<EvictionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [saving, setSaving] = useState(false);

  const [reason, setReason] = useState("");
  const [reasonDetails, setReasonDetails] = useState("");
  const [noticeType, setNoticeType] = useState("");
  const [noticeDays, setNoticeDays] = useState("3");
  const [overrideBalance, setOverrideBalance] = useState("");
  const [noteText, setNoteText] = useState("");
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceValue, setBalanceValue] = useState("");

  useEffect(() => {
    fetch(`/api/evictions?tenantId=${tenantId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        const active = list.find((e: EvictionData) => !["COMPLETED", "CANCELLED"].includes(e.status));
        setEviction(active || list[0] || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tenantId]);

  async function handleCreate() {
    if (!reason) { toast.error("Select a reason"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/evictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          reason,
          reasonDetails: reasonDetails || undefined,
          noticeType: noticeType || undefined,
          noticeDays: noticeDays ? Number(noticeDays) : undefined,
          outstandingBalance: overrideBalance ? Number(overrideBalance) : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setEviction(data);
        setShowCreate(false);
        toast.success("Eviction case created");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to create");
      }
    } catch { toast.error("Something went wrong"); }
    finally { setSaving(false); }
  }

  async function handleStatusUpdate(newStatus: string, extra?: Record<string, unknown>) {
    if (!eviction) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/evictions/${eviction.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, ...extra }),
      });
      if (res.ok) {
        const detail = await fetch(`/api/evictions/${eviction.id}`).then((r) => r.json());
        setEviction(detail);
        toast.success("Status updated");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to update");
      }
    } catch { toast.error("Something went wrong"); }
    finally { setSaving(false); }
  }

  async function handleAddNote() {
    if (!eviction || !noteText.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/evictions/${eviction.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: noteText }),
      });
      setNoteText("");
      const detail = await fetch(`/api/evictions/${eviction.id}`).then((r) => r.json());
      setEviction(detail);
      toast.success("Note added");
    } catch { toast.error("Failed to add note"); }
    finally { setSaving(false); }
  }

  async function handleUploadDocument(file: File, docType: string) {
    if (!eviction) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "evictions");
    const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
    const uploadData = await uploadRes.json();
    if (!uploadData.url) { toast.error("Upload failed"); return; }

    await fetch(`/api/evictions/${eviction.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, url: uploadData.url, type: docType }),
    });

    const detail = await fetch(`/api/evictions/${eviction.id}`).then((r) => r.json());
    setEviction(detail);
    toast.success("Document uploaded");
  }

  if (loading) return null;

  // No active eviction — show start button
  if (!eviction || ["COMPLETED", "CANCELLED"].includes(eviction.status)) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            Eviction
          </CardTitle>
        </CardHeader>
        <CardContent>
          {eviction && (
            <div className="mb-4 rounded-lg bg-muted/50 p-3 text-sm">
              <p className="text-muted-foreground">
                Previous eviction: {eviction.resolutionType?.replace(/_/g, " ") || eviction.status}{" "}
                ({new Date(eviction.resolvedAt || eviction.createdAt).toLocaleDateString()})
              </p>
            </div>
          )}
          {showCreate ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Reason *</Label>
                <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Select reason</option>
                  {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Details</Label>
                <textarea value={reasonDetails} onChange={(e) => setReasonDetails(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[60px]" placeholder="Describe the situation..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Notice Type</Label>
                  <select value={noticeType} onChange={(e) => setNoticeType(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Select type</option>
                    {NOTICE_TYPES.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Notice Period (days)</Label>
                  <Input type="number" value={noticeDays} onChange={(e) => setNoticeDays(e.target.value)} min={1} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Outstanding Balance ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={overrideBalance}
                  onChange={(e) => setOverrideBalance(e.target.value)}
                  placeholder="Auto-calculated from unpaid payments"
                />
                <p className="text-xs text-muted-foreground">Leave blank to auto-calculate from unpaid rent and charges.</p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleCreate} disabled={saving} size="sm" variant="destructive">
                  {saving ? "Creating..." : "Start Eviction Case"}
                </Button>
                <Button onClick={() => setShowCreate(false)} size="sm" variant="outline">Cancel</Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setShowCreate(true)} variant="outline" size="sm" className="w-full">
              <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
              Start Eviction Process
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Active eviction — show tracker
  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === eviction.status);

  return (
    <Card className="border-red-500/30 bg-red-500/5">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-red-500">
          <AlertTriangle className="h-4 w-4" />
          Active Eviction — {REASONS.find((r) => r.value === eviction.reason)?.label || eviction.reason}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status progress bar */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {STATUS_STEPS.filter((s) => s.key !== "COMPLETED").map((step, idx) => {
            const isComplete = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            return (
              <div key={step.key} className="flex items-center gap-1">
                <div className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap",
                  isComplete ? "bg-emerald-500/10 text-emerald-500" :
                  isCurrent ? "bg-red-500/10 text-red-500 ring-1 ring-red-500/30" :
                  "bg-muted text-muted-foreground"
                )}>
                  <step.icon className="h-3 w-3" />
                  {step.label}
                </div>
                {idx < STATUS_STEPS.length - 2 && <span className="text-muted-foreground">→</span>}
              </div>
            );
          })}
        </div>

        {/* Key details */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {eviction.outstandingBalance != null && (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Outstanding:</span>
              {editingBalance ? (
                <div className="flex items-center gap-1">
                  <span className="text-sm">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={balanceValue}
                    onChange={(e) => setBalanceValue(e.target.value)}
                    className="h-6 w-28 text-sm"
                    autoFocus
                  />
                  <button
                    onClick={async () => {
                      await handleStatusUpdate(eviction.status, { outstandingBalance: Number(balanceValue) });
                      setEditingBalance(false);
                    }}
                    className="text-xs text-primary hover:underline"
                  >Save</button>
                  <button onClick={() => setEditingBalance(false)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => { setBalanceValue(String(eviction.outstandingBalance)); setEditingBalance(true); }}
                  className="font-medium text-red-500 hover:underline cursor-pointer inline-flex items-center gap-1 group"
                  title="Click to edit amount"
                >
                  {formatCurrency(eviction.outstandingBalance)}
                  <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
            </div>
          )}
          {eviction.noticeDeadline && (
            <div><span className="text-muted-foreground">Deadline:</span> <span className="font-medium">{new Date(eviction.noticeDeadline).toLocaleDateString()}</span></div>
          )}
          {eviction.caseNumber && (
            <div><span className="text-muted-foreground">Case #:</span> <span className="font-mono text-xs">{eviction.caseNumber}</span></div>
          )}
          {eviction.hearingDate && (
            <div><span className="text-muted-foreground">Hearing:</span> <span className="font-medium">{new Date(eviction.hearingDate).toLocaleDateString()}</span></div>
          )}
        </div>

        {/* Action buttons based on current status */}
        <div className="flex flex-wrap gap-2">
          {eviction.status === "NOTICE_PENDING" && (
            <Button size="sm" variant="destructive" onClick={() => handleStatusUpdate("NOTICE_SERVED", { noticeServedAt: new Date().toISOString() })} disabled={saving}>
              Mark Notice Served
            </Button>
          )}
          {eviction.status === "NOTICE_SERVED" && (
            <>
              <Button size="sm" variant="destructive" onClick={() => handleStatusUpdate("CURE_PERIOD")} disabled={saving}>Start Cure Period</Button>
              <Button size="sm" variant="outline" onClick={() => handleStatusUpdate("FILING_PENDING")} disabled={saving}>Skip to Filing</Button>
            </>
          )}
          {eviction.status === "CURE_PERIOD" && (
            <>
              <Button size="sm" variant="outline" onClick={() => handleStatusUpdate("CANCELLED", { resolutionType: "CURED", curedAt: new Date().toISOString() })} disabled={saving}>
                <CheckCircle2 className="mr-1 h-3 w-3" /> Tenant Cured
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleStatusUpdate("FILING_PENDING")} disabled={saving}>Cure Expired → File</Button>
            </>
          )}
          {eviction.status === "FILING_PENDING" && (
            <Button size="sm" variant="destructive" onClick={() => {
              const caseNum = prompt("Enter court case number:");
              const court = prompt("Court name:");
              if (caseNum) handleStatusUpdate("FILED", { filedAt: new Date().toISOString(), caseNumber: caseNum, courtName: court });
            }} disabled={saving}>
              <Gavel className="mr-1 h-3 w-3" /> Mark Filed
            </Button>
          )}
          {eviction.status === "FILED" && (
            <Button size="sm" variant="outline" onClick={() => {
              const date = prompt("Hearing date (YYYY-MM-DD):");
              if (date) handleStatusUpdate("HEARING_SCHEDULED", { hearingDate: new Date(date).toISOString() });
            }} disabled={saving}>Schedule Hearing</Button>
          )}
          {eviction.status === "HEARING_SCHEDULED" && (
            <>
              <Button size="sm" variant="destructive" onClick={() => handleStatusUpdate("JUDGMENT", { judgmentDate: new Date().toISOString(), judgmentResult: "FOR_LANDLORD" })} disabled={saving}>Judgment for Landlord</Button>
              <Button size="sm" variant="outline" onClick={() => handleStatusUpdate("CANCELLED", { judgmentResult: "FOR_TENANT", resolutionType: "DISMISSED" })} disabled={saving}>Judgment for Tenant</Button>
            </>
          )}
          {eviction.status === "JUDGMENT" && (
            <Button size="sm" variant="destructive" onClick={() => handleStatusUpdate("WRIT_ISSUED", { writIssuedAt: new Date().toISOString() })} disabled={saving}>Writ Issued</Button>
          )}
          {eviction.status === "WRIT_ISSUED" && (
            <Button size="sm" variant="destructive" onClick={() => {
              if (confirm("Finalize eviction? This will freeze the tenant account, cancel autopay, and vacate the unit.")) {
                handleStatusUpdate("COMPLETED", { resolutionType: "EVICTED" });
              }
            }} disabled={saving}>
              <Ban className="mr-1 h-3 w-3" /> Finalize Eviction
            </Button>
          )}
          {!["COMPLETED", "CANCELLED"].includes(eviction.status) && (
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => {
              if (confirm("Cancel this eviction case?")) handleStatusUpdate("CANCELLED", { resolutionType: "DISMISSED" });
            }} disabled={saving}>
              <XCircle className="mr-1 h-3 w-3" /> Cancel Case
            </Button>
          )}
        </div>

        {/* Add note */}
        <div className="flex gap-2">
          <Input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note..." className="text-sm" />
          <Button size="sm" variant="outline" onClick={handleAddNote} disabled={!noteText.trim() || saving}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        {/* Upload document */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            id="eviction-doc"
            className="hidden"
            accept="image/*,application/pdf,.doc,.docx"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                const docType = prompt("Document type (NOTICE, PROOF_OF_SERVICE, COURT_FILING, JUDGMENT, WRIT, PHOTO, OTHER):", "OTHER");
                await handleUploadDocument(file, docType || "OTHER");
              }
              e.target.value = "";
            }}
          />
          <Button size="sm" variant="outline" onClick={() => document.getElementById("eviction-doc")?.click()}>
            <Upload className="mr-1 h-3 w-3" /> Upload Document
          </Button>
          {eviction.documents?.length > 0 && (
            <span className="text-xs text-muted-foreground">{eviction.documents.length} document{eviction.documents.length !== 1 ? "s" : ""}</span>
          )}
        </div>

        {/* Documents list */}
        {eviction.documents?.length > 0 && (
          <div className="space-y-1">
            {eviction.documents.map((doc: { id: string; name: string; url: string; type: string }) => (
              <a key={doc.id} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline">
                <FileText className="h-3 w-3" />
                {doc.name} <span className="text-muted-foreground">({doc.type})</span>
              </a>
            ))}
          </div>
        )}

        {/* Timeline toggle */}
        <button onClick={() => setShowTimeline(!showTimeline)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          {showTimeline ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Timeline ({eviction.timeline?.length || 0} events)
        </button>

        {showTimeline && eviction.timeline && (
          <div className="space-y-2 pl-3 border-l-2 border-border">
            {eviction.timeline.map((event: { id: string; title: string; description: string | null; createdAt: string }) => (
              <div key={event.id} className="text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{event.title}</span>
                  <span className="text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</span>
                </div>
                {event.description && <p className="text-muted-foreground mt-0.5">{event.description}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  FileCheck2,
  Upload,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const DOC_TYPES: Array<{ value: string; label: string; description: string }> = [
  {
    value: "W9",
    label: "W-9",
    description: "IRS Form W-9 (Request for Taxpayer ID). Required for payouts over $600/year.",
  },
  { value: "ID", label: "Government ID", description: "Driver's license or passport." },
  { value: "CONTRACT", label: "Agent Contract", description: "Signed agent agreement." },
  { value: "TAX_FORM", label: "Tax Form", description: "Any other tax document." },
  { value: "OTHER", label: "Other", description: "Anything else DoorStax asked for." },
];

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function W9StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    NOT_REQUESTED: {
      label: "Not requested yet",
      cls: "bg-muted text-muted-foreground border-border",
      icon: Clock,
    },
    REQUESTED: {
      label: "Pending your upload",
      cls: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      icon: AlertCircle,
    },
    RECEIVED: {
      label: "Received — pending verification",
      cls: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      icon: FileCheck2,
    },
    VERIFIED: {
      label: "Verified",
      cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      icon: CheckCircle2,
    },
  };
  const m = map[status] || map.NOT_REQUESTED;
  const Icon = m.icon;
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium " +
        m.cls
      }
    >
      <Icon className="h-3 w-3" />
      {m.label}
    </span>
  );
}

export default function PartnerDocumentsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/partner/documents");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleUpload(type: string, file: File) {
    setUploadingType(type);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);
      fd.append("name", DOC_TYPES.find((d) => d.value === type)?.label || "Document");

      const res = await fetch("/api/partner/documents", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(
          type === "W9" ? "W-9 uploaded — thanks! We'll verify shortly." : "Document uploaded."
        );
        refresh();
      } else {
        toast.error(body.error || "Upload failed");
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingType(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 p-6">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-32 rounded-xl" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  const profile = data?.profile;
  const docs: any[] = data?.documents || [];

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6 page-enter">
      <div>
        <h1 className="text-2xl font-bold">Your Documents</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload your W-9 and other agent documents here.
          {profile?.agentId && (
            <>
              {" "}
              Agent ID:{" "}
              <span className="font-mono text-primary">{profile.agentId}</span>
            </>
          )}
        </p>
      </div>

      {/* W-9 status card */}
      <div className="rounded-xl border bg-card p-5 space-y-4 card-hover">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">W-9 Status</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Required for IRS reporting when your annual payouts exceed $600.
            </p>
          </div>
          <W9StatusBadge status={profile?.w9Status || "NOT_REQUESTED"} />
        </div>
        {profile?.w9RequestedAt && (
          <p className="text-xs text-muted-foreground">
            Requested on {fmtDate(profile.w9RequestedAt)}
          </p>
        )}
        {profile?.w9ReceivedAt && (
          <p className="text-xs text-muted-foreground">
            Received on {fmtDate(profile.w9ReceivedAt)}
          </p>
        )}
        {profile?.w9Status !== "VERIFIED" && (
          <a
            href="https://www.irs.gov/pub/irs-pdf/fw9.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Download a blank W-9 from the IRS
          </a>
        )}
      </div>

      {/* Upload grid */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold">Upload a document</h2>
        <div className="grid gap-3 sm:grid-cols-2 animate-stagger">
          {DOC_TYPES.map((dt) => {
            const isUploading = uploadingType === dt.value;
            return (
              <label
                key={dt.value}
                className={
                  "flex flex-col gap-2 rounded-lg border p-3 cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors " +
                  (isUploading ? "opacity-60 pointer-events-none" : "")
                }
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{dt.label}</span>
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{dt.description}</p>
                <input
                  ref={(el) => {
                    fileInputs.current[dt.value] = el;
                  }}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(dt.value, f);
                    e.target.value = "";
                  }}
                />
              </label>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          PDF, JPEG, PNG, or HEIC. Up to 10MB each. Your files are encrypted and
          only visible to DoorStax administrators.
        </p>
      </div>

      {/* Uploaded docs list */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <h2 className="font-semibold">
          Uploaded documents ({docs.length})
        </h2>
        {docs.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
            No documents uploaded yet.
          </div>
        ) : (
          <div className="space-y-0 divide-y">
            {docs.map((d: any) => (
              <div
                key={d.id}
                className="flex items-center justify-between py-3 gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.type} · {fmtDate(d.uploadedAt)} ·{" "}
                    {d.fileSizeMb ? d.fileSizeMb.toFixed(1) + " MB" : "—"}
                  </p>
                </div>
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 shrink-0"
                >
                  <ExternalLink className="h-3 w-3" />
                  View
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

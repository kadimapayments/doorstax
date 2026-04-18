"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  FileCheck2,
  Upload,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Loader2,
  Landmark,
  Info,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

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

export default function VendorDocumentsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [bank, setBank] = useState({
    bankName: "",
    routingNumber: "",
    accountNumber: "",
    accountType: "checking" as "checking" | "savings",
  });
  const [bankSaving, setBankSaving] = useState(false);
  const [bankFormOpen, setBankFormOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/vendor/documents");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleW9Upload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "W9");
      const res = await fetch("/api/vendor/documents", {
        method: "POST",
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("W-9 uploaded — thanks! We'll verify shortly.");
        refresh();
      } else {
        toast.error(body.error || "Upload failed");
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveBank() {
    if (!bank.routingNumber || !bank.accountNumber) {
      toast.error("Routing and account number are required");
      return;
    }
    setBankSaving(true);
    try {
      const res = await fetch("/api/vendor/bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bank),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Bank account linked — ready to receive payouts");
        setBankFormOpen(false);
        setBank({
          bankName: "",
          routingNumber: "",
          accountNumber: "",
          accountType: "checking",
        });
        refresh();
      } else {
        toast.error(body.detail || body.error || "Bank setup failed");
      }
    } finally {
      setBankSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-32 rounded-xl" />
        <div className="skeleton h-32 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6 page-enter">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Documents &amp; Bank</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload your W-9 and connect a bank account so property managers can
          pay you.
        </p>
      </div>

      {!data?.hasProfile && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3 text-sm">
          <Info className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">You haven&apos;t been added to a PM&apos;s network yet.</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Once a property manager adds you, you&apos;ll be able to upload your
              W-9 and link a bank account here.
            </p>
          </div>
        </div>
      )}

      {/* W-9 */}
      <div className="rounded-xl border bg-card p-5 space-y-4 card-hover">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">W-9 Form</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Required for IRS 1099-NEC reporting when your annual payouts exceed $600.
              Once uploaded, all your PMs will see it — you only need to do this once.
            </p>
          </div>
          <W9StatusBadge status={data?.w9Status || "NOT_REQUESTED"} />
        </div>
        {data?.w9RequestedAt && (
          <p className="text-xs text-muted-foreground">
            Requested on {fmtDate(data.w9RequestedAt)}
          </p>
        )}
        {data?.w9ReceivedAt && data?.w9DocumentUrl && (
          <div className="flex items-center gap-3 text-sm">
            <a
              href={data.w9DocumentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              View uploaded W-9
            </a>
            <span className="text-xs text-muted-foreground">
              · uploaded {fmtDate(data.w9ReceivedAt)}
            </span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInput.current?.click()}
            disabled={uploading || !data?.hasProfile}
            className="btn-press rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {data?.w9DocumentUrl ? "Replace W-9" : "Upload W-9"}
          </button>
          <a
            href="https://www.irs.gov/pub/irs-pdf/fw9.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            Download blank W-9 from IRS
          </a>
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleW9Upload(f);
              e.target.value = "";
            }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          PDF, JPEG, PNG, or HEIC. Up to 10MB. Your file is encrypted and only
          visible to admins and the PMs who added you.
        </p>
      </div>

      {/* Bank */}
      <div className="rounded-xl border bg-card p-5 space-y-4 card-hover">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary" />
              Bank Account for Payouts
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              PMs pay you via ACH credit. This is the account funds will land in.
              One bank serves all your PMs — set it up once.
            </p>
          </div>
          {data?.bank && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 px-2.5 py-1 text-xs font-medium">
              <CheckCircle2 className="h-3 w-3" />
              On file
            </span>
          )}
        </div>

        {data?.bank ? (
          <div className="rounded-lg border bg-muted/20 p-3 text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Bank:</span>{" "}
              <span className="font-medium">{data.bank.bankName || "On file"}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Account:</span>{" "}
              <span className="font-mono">•••• {data.bank.accountLast4}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Routing:</span>{" "}
              <span className="font-mono">•••• {data.bank.routingLast4}</span>
            </p>
            <button
              onClick={() => setBankFormOpen(true)}
              className="text-xs text-primary hover:underline mt-2"
            >
              Replace bank account
            </button>
          </div>
        ) : (
          !bankFormOpen && (
            <button
              onClick={() => setBankFormOpen(true)}
              disabled={!data?.hasProfile}
              className="btn-press rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              <Landmark className="h-4 w-4" />
              Add Bank Account
            </button>
          )
        )}

        {bankFormOpen && (
          <div className="rounded-lg border bg-muted/10 p-4 space-y-3">
            <div>
              <label className="text-xs font-medium">Bank name (optional)</label>
              <input
                type="text"
                value={bank.bankName}
                onChange={(e) =>
                  setBank((p) => ({ ...p, bankName: e.target.value }))
                }
                placeholder="e.g. Wells Fargo"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Routing number</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={9}
                value={bank.routingNumber}
                onChange={(e) =>
                  setBank((p) => ({
                    ...p,
                    routingNumber: e.target.value.replace(/\D/g, ""),
                  }))
                }
                placeholder="9 digits"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Account number</label>
              <input
                type="text"
                inputMode="numeric"
                value={bank.accountNumber}
                onChange={(e) =>
                  setBank((p) => ({
                    ...p,
                    accountNumber: e.target.value.replace(/\D/g, ""),
                  }))
                }
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Account type</label>
              <select
                value={bank.accountType}
                onChange={(e) =>
                  setBank((p) => ({
                    ...p,
                    accountType: e.target.value as "checking" | "savings",
                  }))
                }
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setBankFormOpen(false)}
                disabled={bankSaving}
                className="rounded-lg border px-3 py-2 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBank}
                disabled={
                  bankSaving || !bank.routingNumber || !bank.accountNumber
                }
                className="btn-press rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {bankSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          We use Kadima&apos;s vault to tokenize your bank info. Full account
          numbers never hit DoorStax servers — only the last 4 digits are shown.
        </p>
      </div>
    </div>
  );
}

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Receipt,
  Loader2,
  Send,
  FileText,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

type PM = {
  vendorId: string;
  landlordId: string;
  name: string;
  category: string;
};

type Ticket = {
  id: string;
  title: string;
  status: string;
  landlordId: string;
};

export default function NewVendorInvoicePage() {
  const router = useRouter();
  const search = useSearchParams();
  const preselectTicketId = search.get("ticketId");

  const [pms, setPms] = useState<PM[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [vendorId, setVendorId] = useState("");
  const [ticketId, setTicketId] = useState(preselectTicketId || "");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [pmsRes, ticketsRes] = await Promise.all([
          fetch("/api/vendor/pms"),
          fetch("/api/vendor/tickets"),
        ]);
        if (pmsRes.ok) {
          const body = await pmsRes.json();
          setPms(body.pms || []);
          if (body.pms?.length === 1) {
            setVendorId(body.pms[0].vendorId);
          }
        }
        if (ticketsRes.ok) {
          const body = await ticketsRes.json();
          const all: Ticket[] = (body.tickets || []).map((t: any) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            landlordId: t.landlordId,
          }));
          setTickets(all);

          // Pre-select ticket → also pick its PM
          if (preselectTicketId) {
            const t = all.find((x) => x.id === preselectTicketId);
            if (t) {
              const pmsBody = await fetch("/api/vendor/pms").then((r) =>
                r.json()
              );
              const pm = (pmsBody.pms || []).find(
                (p: PM) => p.landlordId === t.landlordId
              );
              if (pm) setVendorId(pm.vendorId);
            }
          }
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activePm = pms.find((p) => p.vendorId === vendorId);
  const ticketsForPm = activePm
    ? tickets.filter((t) => t.landlordId === activePm.landlordId)
    : [];

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "INVOICE");
      const res = await fetch("/api/vendor/documents", {
        method: "POST",
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.url) {
        setFileUrl(body.url);
        toast.success("Attachment uploaded");
      } else {
        toast.error(body.error || "Upload failed");
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vendorId) {
      toast.error("Select a property manager to invoice");
      return;
    }
    if (!invoiceNumber.trim() || !description.trim() || !amount) {
      toast.error("Invoice number, amount, and description are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/vendor/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          ticketId: ticketId || undefined,
          invoiceNumber: invoiceNumber.trim(),
          amount: Number(amount),
          description: description.trim(),
          fileUrl: fileUrl || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Invoice submitted — the PM will review it shortly");
        router.push("/vendor/invoices");
      } else {
        toast.error(body.error || "Failed to submit invoice");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-4">
        <div className="skeleton h-8 w-40" />
        <div className="skeleton h-96 rounded-xl" />
      </div>
    );
  }

  if (pms.length === 0) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <p className="text-sm text-muted-foreground">
          You&apos;re not linked to any PMs yet. A PM needs to add you to their
          vendor network before you can submit invoices.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6 page-enter">
      <Link
        href="/vendor/invoices"
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to invoices
      </Link>

      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          New invoice
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Submit a bill for review. The PM approves or rejects it; once
          approved, they can pay via ACH.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border bg-card p-5">
        {/* PM picker */}
        <div>
          <label className="text-xs font-medium">Property manager *</label>
          <select
            value={vendorId}
            onChange={(e) => {
              setVendorId(e.target.value);
              setTicketId(""); // reset ticket on PM change
            }}
            required
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Select a PM…</option>
            {pms.map((pm) => (
              <option key={pm.vendorId} value={pm.vendorId}>
                {pm.name} ({pm.category.replace(/_/g, " ")})
              </option>
            ))}
          </select>
        </div>

        {/* Ticket picker (optional) */}
        {activePm && ticketsForPm.length > 0 && (
          <div>
            <label className="text-xs font-medium">
              Linked service ticket{" "}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <select
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">No ticket — standalone bill</option>
              {ticketsForPm.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.status.replace("_", " ")})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium">Invoice # *</label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="INV-001"
              required
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Amount (USD) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium">Description *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            required
            placeholder="Describe the work completed, parts used, hours worked..."
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label className="text-xs font-medium">
            Invoice PDF/photo{" "}
            <span className="text-muted-foreground">(optional)</span>
          </label>
          {fileUrl ? (
            <div className="mt-1 flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Attachment uploaded
              </span>
              <button
                type="button"
                onClick={() => setFileUrl(null)}
                className="text-xs text-muted-foreground hover:text-red-500"
              >
                Remove
              </button>
            </div>
          ) : (
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={handleFileChange}
              disabled={uploading}
              className="mt-1 w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium"
            />
          )}
          {uploading && (
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
            </p>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn-press rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Submit for review
          </button>
        </div>
      </form>
    </div>
  );
}

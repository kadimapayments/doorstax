"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { ArrowLeft, Loader2, Percent, Send } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

function NewDiscountContent() {
  const router = useRouter();
  const search = useSearchParams();
  const initialPmId = search.get("pmId") || "";
  const initialInvoiceId = search.get("invoiceId") || "";

  const [type, setType] = useState<"ONE_TIME_INVOICE" | "RECURRING_SUBSCRIPTION">(
    initialInvoiceId ? "ONE_TIME_INVOICE" : "RECURRING_SUBSCRIPTION"
  );
  const [pmId, setPmId] = useState(initialPmId);
  const [pmLabel, setPmLabel] = useState("");
  const [invoiceId, setInvoiceId] = useState(initialInvoiceId);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load the PM label + invoices for the ONE_TIME picker
  useEffect(() => {
    if (!pmId) return;
    (async () => {
      try {
        // Basic PM info via merchants endpoint (admin-scoped)
        const [pmRes, billingRes] = await Promise.all([
          fetch(`/api/admin/merchants/${pmId}`).catch(() => null),
          fetch(`/api/admin/billing?pm=${pmId}`).catch(() => null),
        ]);
        if (pmRes?.ok) {
          const body = await pmRes.json();
          const u = body?.pm || body?.user || body;
          setPmLabel(u?.companyName || u?.name || u?.email || "PM");
        }
        if (billingRes?.ok) {
          const body = await billingRes.json();
          const list = body?.monthInvoices || body?.invoices || [];
          setInvoices(
            list.filter((i: any) => i.userId === pmId && i.status === "PENDING")
          );
        }
      } catch {
        /* ignore */
      }
    })();
  }, [pmId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pmId) {
      toast.error("Target PM is required");
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (type === "RECURRING_SUBSCRIPTION" && amt > 100) {
      toast.error("Recurring discount must be a percent 0–100");
      return;
    }
    if (type === "ONE_TIME_INVOICE" && !invoiceId) {
      toast.error("Pick an invoice");
      return;
    }
    if (!reason.trim()) {
      toast.error("Reason is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: pmId,
          type,
          invoiceId: type === "ONE_TIME_INVOICE" ? invoiceId : undefined,
          amount: amt,
          reason: reason.trim(),
          startsAt:
            type === "RECURRING_SUBSCRIPTION" && startsAt ? startsAt : undefined,
          endsAt: type === "RECURRING_SUBSCRIPTION" && endsAt ? endsAt : undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Drafted — waiting for admin approval");
        router.push("/admin/discounts");
      } else {
        toast.error(body.error || "Draft failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 page-enter">
      <Link
        href="/admin/discounts"
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to discounts
      </Link>

      <PageHeader
        title="Draft Discount"
        description="Submit for admin approval. Nothing is applied until an admin signs off."
      />

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-card p-5">
        <div>
          <label className="text-xs font-medium">Type *</label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType("ONE_TIME_INVOICE")}
              className={
                "rounded-lg border px-3 py-2 text-sm transition-colors " +
                (type === "ONE_TIME_INVOICE"
                  ? "border-primary bg-primary/5 text-primary"
                  : "hover:bg-muted")
              }
            >
              One-time credit
            </button>
            <button
              type="button"
              onClick={() => setType("RECURRING_SUBSCRIPTION")}
              className={
                "rounded-lg border px-3 py-2 text-sm transition-colors flex items-center justify-center gap-1 " +
                (type === "RECURRING_SUBSCRIPTION"
                  ? "border-primary bg-primary/5 text-primary"
                  : "hover:bg-muted")
              }
            >
              <Percent className="h-3 w-3" />
              Recurring %
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium">Target PM *</label>
          <input
            type="text"
            value={pmId}
            onChange={(e) => setPmId(e.target.value)}
            placeholder="PM user ID (cl...)"
            required
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {pmLabel && (
            <p className="text-[11px] text-muted-foreground mt-1">
              → {pmLabel}
            </p>
          )}
        </div>

        {type === "ONE_TIME_INVOICE" && (
          <div>
            <label className="text-xs font-medium">Invoice *</label>
            {invoices.length > 0 ? (
              <select
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select an invoice…</option>
                {invoices.map((i: any) => (
                  <option key={i.id} value={i.id}>
                    #{i.invoiceNumber} — {i.period} — ${i.netAmount}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
                placeholder="Invoice ID (cl...)"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            )}
          </div>
        )}

        <div>
          <label className="text-xs font-medium">
            {type === "ONE_TIME_INVOICE"
              ? "Credit amount (USD) *"
              : "Percent off *"}
          </label>
          <div className="relative mt-1">
            {type === "ONE_TIME_INVOICE" && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
            )}
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={type === "RECURRING_SUBSCRIPTION" ? "100" : undefined}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={
                "w-full rounded-lg border bg-background py-2 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary " +
                (type === "ONE_TIME_INVOICE" ? "pl-7" : "pl-3")
              }
              placeholder={type === "ONE_TIME_INVOICE" ? "50.00" : "10"}
              required
            />
            {type === "RECURRING_SUBSCRIPTION" && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                %
              </span>
            )}
          </div>
        </div>

        {type === "RECURRING_SUBSCRIPTION" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">
                Starts <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium">
                Ends <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-medium">Reason *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            placeholder="Why are we giving this discount?"
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="btn-press rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Submit for approval
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewDiscountPage() {
  return (
    <Suspense>
      <NewDiscountContent />
    </Suspense>
  );
}

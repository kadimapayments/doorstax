"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Loader2,
  CreditCard,
  X,
  AlertTriangle,
  Send,
  Building2,
  FileText,
  Mail,
} from "lucide-react";
import { PaymentSuccess } from "@/components/ui/payment-success";

/**
 * Admin VT — Bill PM/Landlord tab
 *
 * Replaces the old "Charge tenant" tab. This is for DoorStax operators
 * to settle the SaaS subscription invoices (BillingInvoice rows) that
 * DoorStax bills its own paying customers — PMs and landlords.
 *
 * Flow:
 *   1. Operator searches PMs by name / email / company. Results show
 *      saved card + open invoice count badge.
 *   2. Operator selects a PM → fetches their open BillingInvoice rows
 *      via /api/admin/billing?pm=<id>&status=PENDING.
 *   3. Per-row "Charge Now" button POSTs to
 *      /api/admin/billing/[invoiceId] with action=charge-now (existing
 *      endpoint — runs the charge against DoorStax's platform Kadima
 *      MID, NOT the PM's merchant account).
 *
 * V1 limitation: charges only work against an existing BillingInvoice.
 * To charge a PM ad-hoc with no invoice, an operator must first create
 * the invoice via /admin/billing then settle it from here. (V2 can add
 * an inline "create + charge ad-hoc" flow.)
 */

type PMResult = {
  id: string;
  name: string;
  email: string | null;
  companyName: string | null;
  role: "PM" | "LANDLORD";
  savedCard: { brand: string | null; last4: string } | null;
  openInvoiceCount: number;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  period: string;
  pmId: string;
  pmName: string;
  pmEmail: string;
  tierName: string;
  unitCount: number;
  amount: number;
  creditAmount: number;
  adjustmentAmount: number;
  netAmount: number;
  status: "PENDING" | "PAID" | "WAIVED" | "FAILED";
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
};

const formatUSD = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function AdminPmBillingTab() {
  // ── Search state ──
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PMResult[]>([]);
  const [selected, setSelected] = useState<PMResult | null>(null);

  // ── Invoice list for selected PM ──
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // ── Per-invoice charge state ──
  // Tracks which invoice is mid-charge so we can disable its button
  // independently from sibling invoices.
  const [chargingId, setChargingId] = useState<string | null>(null);
  const [successAmount, setSuccessAmount] = useState<string | null>(null);

  // ─── Debounced PM search ───
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/admin/pms/search?q=${encodeURIComponent(query.trim())}`
        );
        if (res.ok) {
          const body = await res.json();
          setResults(body.pms || []);
        }
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  // ─── Fetch invoices when a PM is selected ───
  useEffect(() => {
    if (!selected) {
      setInvoices([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingInvoices(true);
      try {
        // Pull both PENDING and FAILED — both are settle-eligible by
        // the underlying charge-now action. PAID/WAIVED are filtered
        // out client-side from the same response.
        const res = await fetch(
          `/api/admin/billing?pm=${encodeURIComponent(selected.id)}`
        );
        if (!cancelled && res.ok) {
          const body = await res.json();
          // The pm-mode response puts open invoices on `upcoming`.
          setInvoices(body.upcoming || []);
        }
      } finally {
        if (!cancelled) setLoadingInvoices(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  function reset() {
    setSelected(null);
    setInvoices([]);
    setQuery("");
    setResults([]);
  }

  async function handleChargeNow(invoice: Invoice) {
    if (!selected) return;
    if (!selected.savedCard) {
      toast.error("PM has no DoorStax billing card on file");
      return;
    }
    if (invoice.netAmount <= 0) {
      toast.error("Invoice net amount is zero — mark paid or waive instead");
      return;
    }

    const confirmed = window.confirm(
      `Charge ${formatUSD(invoice.netAmount)} to ${selected.companyName || selected.name}'s ${
        selected.savedCard.brand || "card"
      } ending ${selected.savedCard.last4}?\n\n` +
        `Invoice: ${invoice.invoiceNumber} (${invoice.period})\n` +
        `Tier: ${invoice.tierName} · ${invoice.unitCount} units\n\n` +
        `This is a live charge against DoorStax's platform merchant account. It cannot be reversed from this screen.`
    );
    if (!confirmed) return;

    setChargingId(invoice.id);
    try {
      const res = await fetch(`/api/admin/billing/${invoice.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "charge-now" }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok || !body.charged) {
        toast.error(body.error || "Charge failed");
        return;
      }

      setSuccessAmount(formatUSD(invoice.netAmount));
      // Refresh invoices in place — the just-charged one drops off
      // the open list, others stay visible for follow-up settles.
      const refreshed = await fetch(
        `/api/admin/billing?pm=${encodeURIComponent(selected.id)}`
      );
      if (refreshed.ok) {
        const refBody = await refreshed.json();
        setInvoices(refBody.upcoming || []);
      }
      // Refresh the selected PM's openInvoiceCount badge for the
      // search panel if the operator goes back.
      setSelected((prev) =>
        prev ? { ...prev, openInvoiceCount: Math.max(0, prev.openInvoiceCount - 1) } : prev
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Charge failed");
    } finally {
      setChargingId(null);
    }
  }

  return (
    <div className="space-y-5 animate-fade-scale-in">
      {successAmount && (
        <PaymentSuccess
          amount={successAmount}
          subtitle="DoorStax billing invoice settled — funds posted to the platform account."
          onDone={() => setSuccessAmount(null)}
        />
      )}

      {/* ── Step 1: PM search (visible when no PM selected) ── */}
      {!selected && (
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <label className="text-xs font-medium">
            Find PM or landlord
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, email, or company…"
              autoFocus
              className="w-full rounded-lg border bg-background pl-9 pr-9 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {query.trim().length >= 2 && !searching && results.length === 0 && (
            <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">
              No matching PMs or landlords.
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-1 animate-stagger max-h-[28rem] overflow-y-auto">
              {results.map((pm) => (
                <button
                  key={pm.id}
                  onClick={() => setSelected(pm)}
                  className="w-full text-left rounded-lg border bg-background p-3 hover:border-primary hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {pm.companyName || pm.name}
                      </p>
                      {pm.companyName && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {pm.name}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {pm.email}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {pm.openInvoiceCount > 0 ? (
                        <span className="text-[11px] rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2 py-0.5">
                          {pm.openInvoiceCount} open
                        </span>
                      ) : (
                        <span className="text-[11px] rounded-full bg-muted text-muted-foreground border px-2 py-0.5">
                          No open
                        </span>
                      )}
                      {pm.savedCard ? (
                        <span className="text-[11px] rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          {pm.savedCard.brand || "card"} ••{pm.savedCard.last4}
                        </span>
                      ) : (
                        <span className="text-[11px] rounded-full bg-muted text-muted-foreground border px-2 py-0.5">
                          No card
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Selected PM + invoice list ── */}
      {selected && (
        <div className="rounded-xl border bg-card p-5 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Billing</p>
              <p className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {selected.companyName || selected.name}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selected.email}
              </p>
              {selected.companyName && (
                <p className="text-[11px] text-muted-foreground">
                  Account holder: {selected.name}
                </p>
              )}
            </div>
            <button
              onClick={reset}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Change
            </button>
          </div>

          {/* Card status banner */}
          {selected.savedCard ? (
            <div className="rounded-lg border bg-muted/10 p-3 flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {selected.savedCard.brand || "Card"} ending{" "}
                  {selected.savedCard.last4}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Saved DoorStax billing card — used for platform invoices.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-600">
                  No DoorStax billing card on file
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ask the PM to add one from Settings → Billing in their
                  dashboard before charging.
                </p>
              </div>
            </div>
          )}

          {/* Open invoices list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Open invoices
              </h3>
              {invoices.length > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  Total{" "}
                  {formatUSD(invoices.reduce((s, i) => s + i.netAmount, 0))}
                </span>
              )}
            </div>

            {loadingInvoices ? (
              <div className="rounded-lg border border-dashed bg-muted/10 p-6 text-center">
                <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/10 p-6 text-center text-xs text-muted-foreground">
                No open invoices for this PM.
                <br />
                <span className="text-[11px]">
                  To charge ad-hoc, create an invoice via{" "}
                  <a
                    href="/admin/billing"
                    className="text-primary hover:underline"
                  >
                    /admin/billing
                  </a>{" "}
                  first.
                </span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {invoices.map((inv) => {
                  const isCharging = chargingId === inv.id;
                  const cantCharge = !selected.savedCard || inv.netAmount <= 0;
                  return (
                    <div
                      key={inv.id}
                      className="rounded-lg border bg-background p-3 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {inv.invoiceNumber}
                          </span>
                          <span className="text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-muted text-muted-foreground border">
                            {inv.status}
                          </span>
                          {inv.status === "FAILED" && (
                            <span className="text-[11px] text-amber-600">
                              ⚠ Previous attempt failed
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {inv.period} · {inv.tierName} · {inv.unitCount} units
                          {" · "}
                          due {new Date(inv.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-sm font-semibold tabular-nums">
                          {formatUSD(inv.netAmount)}
                        </span>
                        <button
                          onClick={() => handleChargeNow(inv)}
                          disabled={cantCharge || isCharging}
                          className="btn-press rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
                        >
                          {isCharging ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="h-3 w-3" />
                          )}
                          Charge Now
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

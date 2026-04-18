"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  Loader2,
  Wrench,
  X,
  AlertTriangle,
  Send,
  Banknote,
  Receipt,
} from "lucide-react";
import { PaymentSuccess } from "@/components/ui/payment-success";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Vendor = {
  id: string;
  name: string;
  company: string | null;
  category: string;
  email: string | null;
  kadimaCustomerId: string | null;
  kadimaAccountId: string | null;
  bankName: string | null;
  bankAccountLast4: string | null;
};

type OpenInvoice = {
  id: string;
  invoiceNumber: string;
  amount: string;
  description: string;
  status: string;
};

function fmtMoney(n: number | string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(n));
}

export function VendorPayoutTab() {
  const search = useSearchParams();
  const preselectInvoiceId = search.get("invoiceId") || null;

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [query, setQuery] = useState("");
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [selected, setSelected] = useState<Vendor | null>(null);

  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [mode, setMode] = useState<"invoice" | "adhoc">("invoice");
  const [invoiceId, setInvoiceId] = useState<string | null>(
    preselectInvoiceId
  );
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  const [sending, setSending] = useState(false);
  const [successAmount, setSuccessAmount] = useState<string | null>(null);

  // Load PM's vendors once
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/vendors");
        if (res.ok) {
          const body: Vendor[] = await res.json();
          setVendors(body || []);

          // If an invoice was pre-selected, find its vendor and auto-pick it
          if (preselectInvoiceId) {
            try {
              const invRes = await fetch(
                "/api/pm/vendor-invoices?status=APPROVED"
              );
              if (invRes.ok) {
                const invBody = await invRes.json();
                const match = (invBody.invoices || []).find(
                  (i: any) => i.id === preselectInvoiceId
                );
                if (match) {
                  const v = (body || []).find((x) => x.id === match.vendorId);
                  if (v) {
                    setSelected(v);
                    setAmount(String(match.amount));
                    setInvoiceId(match.id);
                    setMode("invoice");
                  }
                }
              }
            } catch {
              /* ignore */
            }
          }
        }
      } finally {
        setLoadingVendors(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the selected vendor's open (APPROVED) invoices
  useEffect(() => {
    if (!selected) {
      setOpenInvoices([]);
      return;
    }
    (async () => {
      const res = await fetch(
        `/api/pm/vendor-invoices?status=APPROVED&vendor=${selected.id}`
      );
      if (res.ok) {
        const body = await res.json();
        const list: OpenInvoice[] = (body.invoices || []).map((i: any) => ({
          id: i.id,
          invoiceNumber: i.invoiceNumber,
          amount: i.amount,
          description: i.description,
          status: i.status,
        }));
        setOpenInvoices(list);
        // If no invoice preselected and vendor has open invoices, default to invoice mode
        if (list.length > 0 && !invoiceId) {
          setMode("invoice");
          setInvoiceId(list[0].id);
          setAmount(String(list[0].amount));
        } else if (list.length === 0) {
          setMode("adhoc");
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const filtered = useMemo(() => {
    if (!query.trim()) return vendors;
    const q = query.toLowerCase();
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        (v.company || "").toLowerCase().includes(q) ||
        (v.email || "").toLowerCase().includes(q) ||
        (v.category || "").toLowerCase().includes(q)
    );
  }, [vendors, query]);

  function reset() {
    setSelected(null);
    setOpenInvoices([]);
    setInvoiceId(null);
    setAmount("");
    setMemo("");
    setMode("invoice");
  }

  function handlePickInvoice(id: string) {
    setInvoiceId(id);
    const inv = openInvoices.find((i) => i.id === id);
    if (inv) setAmount(String(inv.amount));
  }

  async function handleSend() {
    if (!selected) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!selected.kadimaCustomerId || !selected.kadimaAccountId) {
      toast.error("Vendor has no bank account on file");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/pm/vendor-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: selected.id,
          amount: amt,
          invoiceId: mode === "invoice" ? invoiceId : undefined,
          memo: memo || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Payout failed");
        return;
      }
      setSuccessAmount(fmtMoney(amt));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payout failed");
    } finally {
      setSending(false);
    }
  }

  if (loadingVendors) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <div className="skeleton h-24" />
      </div>
    );
  }

  if (vendors.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <Wrench className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium">No vendors yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Add a vendor from the Vendors page to start paying out.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-scale-in">
      {successAmount && (
        <PaymentSuccess
          amount={successAmount}
          subtitle="ACH credit initiated — funds arrive in 1–2 business days."
          onDone={() => {
            setSuccessAmount(null);
            reset();
          }}
        />
      )}

      {!selected && (
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <label className="text-xs font-medium">Find vendor</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, company, email, or category…"
              autoFocus
              className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1 animate-stagger max-h-96 overflow-y-auto">
            {filtered.map((v) => {
              const hasBank = !!(v.kadimaCustomerId && v.kadimaAccountId);
              return (
                <button
                  key={v.id}
                  onClick={() => setSelected(v)}
                  disabled={!hasBank}
                  className="w-full text-left rounded-lg border bg-background p-3 hover:border-primary hover:bg-muted/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {v.company || v.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {v.category.replace(/_/g, " ")}
                        {v.email && ` · ${v.email}`}
                      </p>
                    </div>
                    {hasBank ? (
                      <span className="text-[11px] rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 flex items-center gap-1">
                        <Banknote className="h-3 w-3" />
                        {v.bankName || "Bank"} ••{v.bankAccountLast4}
                      </span>
                    ) : (
                      <span className="text-[11px] rounded-full bg-muted text-muted-foreground border px-2 py-0.5">
                        No bank on file
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                No vendors match that query.
              </div>
            )}
          </div>
        </div>
      )}

      {selected && (
        <div className="rounded-xl border bg-card p-5 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Paying</p>
              <p className="text-base font-semibold">
                {selected.company || selected.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {selected.category.replace(/_/g, " ")}
              </p>
            </div>
            <button
              onClick={reset}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Change
            </button>
          </div>

          {selected.kadimaCustomerId && selected.kadimaAccountId ? (
            <div className="rounded-lg border bg-muted/10 p-3 flex items-center gap-3">
              <Banknote className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {selected.bankName || "Bank account"} ending in{" "}
                  {selected.bankAccountLast4}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  ACH credit · 1–2 business days
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-600">No bank on file</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ask the vendor to add a bank account in their portal, or add
                  it from their profile.
                </p>
              </div>
            </div>
          )}

          {/* Mode toggle */}
          <div className="flex gap-1 rounded-lg border bg-muted/30 p-1 text-xs">
            <button
              onClick={() => {
                setMode("invoice");
                if (openInvoices[0]) handlePickInvoice(openInvoices[0].id);
              }}
              disabled={openInvoices.length === 0}
              className={
                "flex-1 rounded-md px-3 py-1.5 font-medium transition-colors flex items-center justify-center gap-1.5 " +
                (mode === "invoice"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground disabled:opacity-50")
              }
            >
              <Receipt className="h-3 w-3" />
              Pay invoice ({openInvoices.length})
            </button>
            <button
              onClick={() => {
                setMode("adhoc");
                setInvoiceId(null);
                setAmount("");
              }}
              className={
                "flex-1 rounded-md px-3 py-1.5 font-medium transition-colors " +
                (mode === "adhoc"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground")
              }
            >
              Ad-hoc payment
            </button>
          </div>

          {mode === "invoice" ? (
            openInvoices.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                No approved invoices pending payment. Use ad-hoc mode for
                standalone payouts.
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-medium">
                  Which invoice to pay
                </label>
                <div className="space-y-1">
                  {openInvoices.map((i) => (
                    <button
                      key={i.id}
                      onClick={() => handlePickInvoice(i.id)}
                      className={
                        "w-full text-left rounded-lg border p-3 text-sm transition-colors " +
                        (invoiceId === i.id
                          ? "border-primary bg-primary/5"
                          : "bg-background hover:bg-muted/30")
                      }
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">#{i.invoiceNumber}</p>
                          <p className="text-[11px] text-muted-foreground line-clamp-1">
                            {i.description}
                          </p>
                        </div>
                        <span className="font-semibold text-sm">
                          {fmtMoney(i.amount)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Amount (USD) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={mode === "invoice" && !!invoiceId}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:bg-muted/20"
              />
              {mode === "invoice" && !!invoiceId && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Matches invoice total — can&apos;t be changed.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium">
                Memo{" "}
                <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="e.g. Kitchen sink repair"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSend}
              disabled={
                sending ||
                !selected.kadimaCustomerId ||
                (mode === "invoice" && !invoiceId)
              }
              className="btn-press rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send ACH credit
              {amount ? ` ${fmtMoney(amount)}` : ""}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

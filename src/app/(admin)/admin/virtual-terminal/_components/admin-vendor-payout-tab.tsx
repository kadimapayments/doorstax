"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Loader2,
  Wrench,
  X,
  AlertTriangle,
  Send,
  Banknote,
  Building2,
} from "lucide-react";
import { PaymentSuccess } from "@/components/ui/payment-success";

type Vendor = {
  id: string;
  name: string;
  company: string | null;
  category: string;
  email: string | null;
  landlordId: string;
  landlordName: string | null;
  kadimaCustomerId: string | null;
  kadimaAccountId: string | null;
  bankName: string | null;
  bankAccountLast4: string | null;
};

function fmtMoney(n: number | string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(n));
}

export function AdminVendorPayoutTab() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Vendor[]>([]);
  const [selected, setSelected] = useState<Vendor | null>(null);

  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  const [sending, setSending] = useState(false);
  const [successAmount, setSuccessAmount] = useState<string | null>(null);

  // Debounced global vendor search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/admin/vendors/search?q=${encodeURIComponent(query.trim())}`
        );
        if (res.ok) {
          const body = await res.json();
          setResults(body.vendors || []);
        }
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function reset() {
    setSelected(null);
    setAmount("");
    setMemo("");
    setQuery("");
    setResults([]);
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

    const confirmed = window.confirm(
      `Send ${fmtMoney(amt)} via ACH to ${
        selected.company || selected.name
      }'s ${selected.bankName || "bank"} ending in ${selected.bankAccountLast4}?\n\n` +
        `Merchant of record: ${selected.landlordName || "PM"}.\n\n` +
        `ACH credits typically arrive in 1–2 business days and cannot be pulled back.`
    );
    if (!confirmed) return;

    setSending(true);
    try {
      const res = await fetch("/api/admin/vendor-payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: selected.id,
          amount: amt,
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
          <label className="text-xs font-medium">Find vendor (any PM)</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Vendor name, company, email, or category…"
              autoFocus
              className="w-full rounded-lg border bg-background pl-9 pr-9 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {query.trim().length >= 2 && !searching && results.length === 0 && (
            <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">
              No matching vendors.
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-1 animate-stagger max-h-[28rem] overflow-y-auto">
              {results.map((v) => {
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
                        <p className="text-sm font-medium flex items-center gap-2">
                          <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                          {v.company || v.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {v.category.replace(/_/g, " ")}
                          {v.email && ` · ${v.email}`}
                        </p>
                        {v.landlordName && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {v.landlordName}
                          </p>
                        )}
                      </div>
                      {hasBank ? (
                        <span className="text-[11px] rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 flex items-center gap-1">
                          <Banknote className="h-3 w-3" />
                          {v.bankName || "Bank"} ••{v.bankAccountLast4}
                        </span>
                      ) : (
                        <span className="text-[11px] rounded-full bg-muted text-muted-foreground border px-2 py-0.5">
                          No bank
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
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
              {selected.landlordName && (
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Merchant of record:{" "}
                  <span className="font-medium">{selected.landlordName}</span>
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
                  Ask the PM (or the vendor) to add a bank account before
                  running the payout.
                </p>
              </div>
            </div>
          )}

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
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
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
              disabled={sending || !selected.kadimaCustomerId}
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

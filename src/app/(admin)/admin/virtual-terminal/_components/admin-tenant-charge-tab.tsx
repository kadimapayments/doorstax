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
  User as UserIcon,
  Building2,
} from "lucide-react";
import { PaymentSuccess } from "@/components/ui/payment-success";

type Tenant = {
  id: string;
  unitId: string | null;
  name: string;
  email: string | null;
  unitLabel: string | null;
  landlordId: string | null;
  landlordName: string | null;
  savedCard: { brand: string | null; last4: string } | null;
  savedBank: { last4: string } | null;
  defaultMethod: string | null;
};

const CHARGE_TYPES = [
  { value: "RENT", label: "Rent" },
  { value: "DEPOSIT", label: "Deposit" },
  { value: "FEE", label: "Fee / Misc" },
];

export function AdminTenantChargeTab() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Tenant[]>([]);
  const [selected, setSelected] = useState<Tenant | null>(null);

  const [amount, setAmount] = useState("");
  const [type, setType] = useState("RENT");
  const [description, setDescription] = useState("");

  const [charging, setCharging] = useState(false);
  const [successAmount, setSuccessAmount] = useState<string | null>(null);

  // Debounced global tenant search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/admin/tenants/search?q=${encodeURIComponent(query.trim())}`
        );
        if (res.ok) {
          const body = await res.json();
          setResults(body.tenants || []);
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
    setType("RENT");
    setDescription("");
    setQuery("");
    setResults([]);
  }

  async function handleCharge() {
    if (!selected) return;
    if (!selected.unitId) {
      toast.error("Tenant is not assigned to a unit");
      return;
    }
    if (!selected.savedCard) {
      toast.error("Tenant has no saved card on file");
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    const confirmed = window.confirm(
      `Charge ${new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amt)} to ${selected.name}'s ${
        selected.savedCard.brand || "card"
      } ending in ${selected.savedCard.last4}?\n\n` +
        `Merchant of record: ${selected.landlordName || "PM"}.\n\n` +
        `This is a live transaction — it cannot be reversed from this screen.`
    );
    if (!confirmed) return;

    setCharging(true);
    try {
      const res = await fetch("/api/admin/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: selected.id,
          unitId: selected.unitId,
          amount: amt,
          type,
          description: description || undefined,
          source: "admin-vt",
        }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok && !body.paymentId) {
        toast.error(body.error || "Charge failed");
        return;
      }
      if (body.charged) {
        setSuccessAmount(
          new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
          }).format(amt)
        );
      } else {
        toast.error(body.error || "Charge did not go through");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Charge failed");
    } finally {
      setCharging(false);
    }
  }

  return (
    <div className="space-y-5 animate-fade-scale-in">
      {successAmount && (
        <PaymentSuccess
          amount={successAmount}
          subtitle="Charge went through — it's now on the PM's deposit queue."
          onDone={() => {
            setSuccessAmount(null);
            reset();
          }}
        />
      )}

      {/* Step 1: Search */}
      {!selected && (
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <label className="text-xs font-medium">Find tenant (any PM)</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tenant name, email, property, or unit…"
              autoFocus
              className="w-full rounded-lg border bg-background pl-9 pr-9 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {query.trim().length >= 2 && !searching && results.length === 0 && (
            <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">
              No matching tenants.
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-1 animate-stagger max-h-[28rem] overflow-y-auto">
              {results.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className="w-full text-left rounded-lg border bg-background p-3 hover:border-primary hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        {t.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.unitLabel || "No unit assigned"}
                      </p>
                      {t.landlordName && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {t.landlordName}
                        </p>
                      )}
                    </div>
                    {t.savedCard ? (
                      <span className="text-[11px] rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        {t.savedCard.brand || "card"} ••{t.savedCard.last4}
                      </span>
                    ) : (
                      <span className="text-[11px] rounded-full bg-muted text-muted-foreground border px-2 py-0.5">
                        No card
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Selected tenant + charge form */}
      {selected && (
        <div className="rounded-xl border bg-card p-5 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Charging</p>
              <p className="text-base font-semibold">{selected.name}</p>
              <p className="text-xs text-muted-foreground">
                {selected.unitLabel || "—"}
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

          {selected.savedCard ? (
            <div className="rounded-lg border bg-muted/10 p-3 flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {selected.savedCard.brand || "Card"} ending in{" "}
                  {selected.savedCard.last4}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Saved to the tenant&apos;s payment vault
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-600">
                  No payment method on file
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  The tenant needs to save a card in their portal before this
                  can be charged.
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
              <label className="text-xs font-medium">Type *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {CHARGE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium">
              Description{" "}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Appears on the receipt"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleCharge}
              disabled={charging || !selected.savedCard}
              className="btn-press rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              {charging ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Charge{" "}
              {amount
                ? new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(Number(amount))
                : ""}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

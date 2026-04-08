"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { TrustBadges } from "@/components/ui/trust-badges";
import { CreditCard, Landmark, CheckCircle2, Check, Clock, ShieldCheck, Building2, AlertCircle, Loader2 } from "lucide-react";
import { KadimaCardFormModal } from "@/components/kadima-card-form-modal";
import { cn } from "@/lib/utils";
function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

interface RentInfo {
  rentAmount: number;
  splitPercent: number;
  myRent: number;
  hasSavedCard: boolean;
  savedCardBrand: string | null;
  savedCardLast4: string | null;
  kadimaCustomerId: string | null;
  kadimaCardTokenId: string | null;
  achFeeMode: "OWNER" | "TENANT" | "PM";
  achFeeAmount: number;
  hasSavedAch?: boolean;
  savedBankLast4?: string | null;
  savedBankAccountType?: string | null;
  kadimaAccountId?: string | null;
}

export default function PayRentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<"ach" | "card">("card");
  const [achAuthorized, setAchAuthorized] = useState(false);
  const [cardDisputeAck, setCardDisputeAck] = useState(false);
  const [amount, setAmount] = useState("");
  const [rentInfo, setRentInfo] = useState<RentInfo | null>(null);
  const [cardFormLoading, setCardFormLoading] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [showAchForm, setShowAchForm] = useState(false);
  const [outstandingCharges, setOutstandingCharges] = useState<Array<{
    id: string;
    amount: number;
    type: string;
    status: string;
    description: string;
    dueDate: string;
    createdAt: string;
    isOverdue: boolean;
  }>>([]);
  const [chargesLoading, setChargesLoading] = useState(true);
  const [payingChargeId, setPayingChargeId] = useState<string | null>(null);
  const [activeChargeId, setActiveChargeId] = useState<string | null>(null);
  const [chargeMethod, setChargeMethod] = useState<"card" | "ach">("card");
  const [confirmingCharge, setConfirmingCharge] = useState<{ id: string; amount: number; description: string; method: "card" | "ach" } | null>(null);
  const [chargeAcknowledged, setChargeAcknowledged] = useState(false);

  useEffect(() => {
    fetch("/api/tenants/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          const myRent = data.rentAmount * data.splitPercent / 100;
          setRentInfo({
            rentAmount: data.rentAmount,
            splitPercent: data.splitPercent,
            myRent,
            hasSavedCard: data.hasSavedCard ?? false,
            savedCardBrand: data.savedCardBrand ?? null,
            savedCardLast4: data.savedCardLast4 ?? null,
            kadimaCustomerId: data.kadimaCustomerId ?? null,
            kadimaCardTokenId: data.kadimaCardTokenId ?? null,
            achFeeMode: data.achFeeMode ?? "OWNER",
            achFeeAmount: data.achFeeAmount ?? 0,
            hasSavedAch: data.hasSavedAch ?? false,
            savedBankLast4: data.savedBankLast4 ?? null,
            savedBankAccountType: data.savedBankAccountType ?? null,
            kadimaAccountId: data.kadimaAccountId ?? null,
          });
          setAmount(myRent.toFixed(2));
        }
      })
      .catch(() => {/* ignore */});
  }, []);

  // Fetch outstanding charges (non-rent)
  useEffect(() => {
    fetch("/api/tenant/outstanding-charges")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setOutstandingCharges(Array.isArray(data) ? data : []))
      .catch(() => setOutstandingCharges([]))
      .finally(() => setChargesLoading(false));
  }, []);

  // Check for card saved callback (redirect from Kadima hosted card form)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("cardSaved") === "true") {
      // Refresh rent info to get updated card details
      fetch("/api/tenants/me")
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data) {
            const myRent = data.rentAmount * data.splitPercent / 100;
            setRentInfo({
              rentAmount: data.rentAmount,
              splitPercent: data.splitPercent,
              myRent,
              hasSavedCard: data.hasSavedCard ?? false,
              savedCardBrand: data.savedCardBrand ?? null,
              savedCardLast4: data.savedCardLast4 ?? null,
              kadimaCustomerId: data.kadimaCustomerId ?? null,
              kadimaCardTokenId: data.kadimaCardTokenId ?? null,
              achFeeMode: data.achFeeMode ?? "OWNER",
              achFeeAmount: data.achFeeAmount ?? 0,
            });
            setAmount(myRent.toFixed(2));
          }
        });
      toast.success("Card saved successfully!");
      const url = new URL(window.location.href);
      url.searchParams.delete("cardSaved");
      window.history.replaceState({}, "", url.toString());
    }
    if (params.get("cardError")) {
      toast.error("Card could not be saved. Please try again.");
      const url = new URL(window.location.href);
      url.searchParams.delete("cardError");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  /** Open embedded Kadima vault card form modal */
  async function openVaultCardForm() {
    setCardModalOpen(true);
  }

  async function handleCardFormSuccess(_data: { customerId: string; cardId: string }) {
    toast.success("Card saved successfully!");
    // Refresh rent info to pick up the new card
    try {
      const r = await fetch("/api/tenants/me");
      if (r.ok) {
        const d = await r.json();
        const myRent = d.rentAmount * d.splitPercent / 100;
        setRentInfo({
          rentAmount: d.rentAmount,
          splitPercent: d.splitPercent,
          myRent,
          hasSavedCard: d.hasSavedCard ?? false,
          savedCardBrand: d.savedCardBrand ?? null,
          savedCardLast4: d.savedCardLast4 ?? null,
          kadimaCustomerId: d.kadimaCustomerId ?? null,
          kadimaCardTokenId: d.kadimaCardTokenId ?? null,
          achFeeMode: d.achFeeMode ?? "OWNER",
          achFeeAmount: d.achFeeAmount ?? 0,
        });
        setAmount(myRent.toFixed(2));
      }
    } catch { /* ignore */ }
  }

  const numAmount = parseFloat(amount) || 0;
  const surcharge = method === "card" ? Math.round(numAmount * 0.0325 * 100) / 100 : 0;
  const achFee = method === "ach" && rentInfo?.achFeeMode === "TENANT" ? rentInfo.achFeeAmount : 0;
  const totalCharge = numAmount + surcharge + achFee;

  async function handlePayCharge(
    chargeId: string,
    _chargeAmount: number,
    chargeDescription: string,
    method: "card" | "ach"
  ) {
    const useCard = method === "card";

    if (useCard && !rentInfo?.kadimaCardTokenId) {
      toast.error("Please add a card first");
      return;
    }
    if (!useCard && !rentInfo?.kadimaAccountId) {
      toast.error("Please add a bank account first");
      return;
    }

    setChargeMethod(method);
    setPayingChargeId(chargeId);

    try {
      const res = await fetch(`/api/tenant/outstanding-charges/${chargeId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: method }),
      });

      if (res.ok) {
        toast.success(`Payment submitted for ${chargeDescription}`);
        setOutstandingCharges((prev) => prev.filter((c) => c.id !== chargeId));
        setActiveChargeId(null);
        // Refresh from server to ensure consistency
        fetch("/api/tenant/outstanding-charges")
          .then((r) => r.ok ? r.json() : [])
          .then((data) => setOutstandingCharges(Array.isArray(data) ? data : []))
          .catch(() => {});
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Payment failed");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setPayingChargeId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    const payload: Record<string, unknown> = {
      amount: numAmount,
      paymentMethod: method,
      unitId: "current",
    };

    if (method === "ach") {
      payload.achAuthorized = true;
      if (rentInfo?.hasSavedAch && !showAchForm) {
        // Use saved vault ACH account
        payload.useVault = true;
      } else {
        // Manual ACH entry
        payload.routingNumber = formData.get("routingNumber");
        payload.accountNumber = formData.get("accountNumber");
        payload.accountType = formData.get("accountType");
      }
    }

    if (method === "card" && (rentInfo?.hasSavedCard) && rentInfo?.kadimaCustomerId && rentInfo?.kadimaCardTokenId) {
      payload.useVault = true;
      payload.cardId = rentInfo.kadimaCardTokenId;
    }

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Payment failed");
        setLoading(false);
        return;
      }

      // Save ACH to vault for future use if entered manually
      if (method === "ach" && !rentInfo?.hasSavedAch && formData.get("routingNumber")) {
        try {
          await fetch("/api/tenant/onboarding/payment-method", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "ach",
              routingNumber: formData.get("routingNumber"),
              accountNumber: formData.get("accountNumber"),
              accountType: formData.get("accountType") || "checking",
              accountHolderName: "Account Holder",
            }),
          });
        } catch {
          // Non-blocking — payment already succeeded
          console.warn("Failed to save ACH to vault for future use");
        }
      }

      toast.success("Payment submitted!");
      router.push("/tenant");
    } catch {
      toast.error("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Manage your rent and outstanding charges." />

      {/* Outstanding Charges */}
      {!chargesLoading && outstandingCharges.length > 0 && (
        <div className="w-full max-w-lg rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <h2 className="font-semibold text-sm">Outstanding Charges</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              {outstandingCharges.length} unpaid charge{outstandingCharges.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-2">
            {outstandingCharges.map((charge) => (
              <div
                key={charge.id}
                className={cn(
                  "rounded-lg border bg-card p-4 space-y-3 transition-opacity",
                  payingChargeId && payingChargeId !== charge.id ? "opacity-40 pointer-events-none" : "",
                  payingChargeId === charge.id ? "ring-2 ring-primary/30" : ""
                )}
              >
                {/* Row 1: Info + buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{charge.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="capitalize">{charge.type.toLowerCase()}</span>
                      <span> · Due {new Date(charge.dueDate).toLocaleDateString()}</span>
                      {charge.isOverdue && <span className="text-red-500 font-medium ml-1">Overdue</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("font-semibold text-base", charge.isOverdue ? "text-red-500" : "")}>
                      {formatMoney(charge.amount)}
                    </span>
                    {activeChargeId === charge.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => { setConfirmingCharge({ id: charge.id, amount: charge.amount, description: charge.description, method: "card" }); setChargeMethod("card"); setChargeAcknowledged(false); }}
                          disabled={!!payingChargeId || !rentInfo?.hasSavedCard}
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1 min-h-[36px]"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          Card
                        </button>
                        <button
                          onClick={() => { setConfirmingCharge({ id: charge.id, amount: charge.amount, description: charge.description, method: "ach" }); setChargeMethod("ach"); setChargeAcknowledged(false); }}
                          disabled={!!payingChargeId || !rentInfo?.hasSavedAch}
                          className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50 flex items-center gap-1 min-h-[36px]"
                        >
                          <Landmark className="h-3.5 w-3.5" />
                          ACH
                        </button>
                        <button
                          onClick={() => { setActiveChargeId(null); setConfirmingCharge(null); setChargeAcknowledged(false); }}
                          disabled={!!payingChargeId}
                          className="text-xs text-muted-foreground hover:text-foreground px-1"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setActiveChargeId(charge.id)}
                        disabled={!!payingChargeId}
                        className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 min-h-[36px]"
                      >
                        Pay
                      </button>
                    )}
                  </div>
                </div>

                {/* Row 2: Inline confirmation */}
                {confirmingCharge && confirmingCharge.id === charge.id && (
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                    <h4 className="text-sm font-semibold">Confirm Payment</h4>
                    <div className="text-sm space-y-1.5">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground shrink-0">Charge</span>
                        <span className="text-right font-medium">{confirmingCharge.description}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Amount</span>
                        <span>{formatMoney(confirmingCharge.amount)}</span>
                      </div>
                      {confirmingCharge.method === "card" && (
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Convenience Fee (3.25%)</span>
                          <span>+{formatMoney(Math.round(confirmingCharge.amount * 0.0325 * 100) / 100)}</span>
                        </div>
                      )}
                      <div className="flex justify-between gap-4 border-t pt-1.5 font-semibold">
                        <span>Total</span>
                        <span>{formatMoney(confirmingCharge.method === "card" ? confirmingCharge.amount + Math.round(confirmingCharge.amount * 0.0325 * 100) / 100 : confirmingCharge.amount)}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        id={`ack-${charge.id}`}
                        className="mt-1 h-4 w-4 rounded border-input"
                        checked={chargeAcknowledged}
                        onChange={(e) => setChargeAcknowledged(e.target.checked)}
                      />
                      <label htmlFor={`ack-${charge.id}`} className="text-xs text-muted-foreground leading-tight">
                        I acknowledge that I am paying {formatMoney(confirmingCharge.method === "card" ? confirmingCharge.amount + Math.round(confirmingCharge.amount * 0.0325 * 100) / 100 : confirmingCharge.amount)} for {confirmingCharge.description}.{" "}
                        {confirmingCharge.method === "card" ? "A 3.25% card convenience fee has been added." : "No additional fees apply for ACH payments."}
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          handlePayCharge(confirmingCharge.id, confirmingCharge.amount, confirmingCharge.description, confirmingCharge.method);
                          setConfirmingCharge(null);
                          setChargeAcknowledged(false);
                        }}
                        disabled={!chargeAcknowledged || payingChargeId === charge.id}
                        className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 min-h-[44px]"
                      >
                        {payingChargeId === charge.id ? "Processing..." : "Confirm & Pay"}
                      </button>
                      <button
                        onClick={() => { setConfirmingCharge(null); setChargeAcknowledged(false); }}
                        className="rounded-lg border px-4 py-2.5 text-sm hover:bg-muted min-h-[44px]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-amber-500/20 pt-3">
            <span className="text-sm font-medium">Total Outstanding</span>
            <span className="text-sm font-semibold">
              {formatMoney(outstandingCharges.reduce((sum, c) => sum + c.amount, 0))}
            </span>
          </div>
        </div>
      )}

      {!chargesLoading && outstandingCharges.length > 0 && (
        <div className="max-w-lg flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Monthly Rent</span>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}

      <Card className="max-w-lg border-border">
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ($)</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              {rentInfo && rentInfo.splitPercent < 100 && (
                <p className="text-xs text-muted-foreground">
                  Your split: {rentInfo.splitPercent}% of {formatMoney(rentInfo.rentAmount)}
                </p>
              )}
            </div>

            {/* ── Payment Method Selection — Card-First Layout ──────── */}
            <div className="space-y-3">
              <Label>Payment Method</Label>

              {/* PRIMARY: Card option */}
              <button
                type="button"
                onClick={() => {
                  setMethod("card");
                  setAchAuthorized(false);
                }}
                className={cn(
                  "w-full rounded-lg border-2 p-4 text-left transition-all",
                  method === "card"
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border hover:border-primary/30"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">
                        {rentInfo?.hasSavedCard && rentInfo?.savedCardLast4
                          ? <>Pay with saved card •••• {rentInfo.savedCardLast4}</>
                          : "Pay Instantly with Card"}
                        {rentInfo?.hasSavedCard && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openVaultCardForm(); }}
                            className="text-xs text-primary underline ml-2 font-normal"
                            disabled={cardFormLoading}
                          >
                            {cardFormLoading ? "Loading..." : "Change"}
                          </button>
                        )}
                      </p>
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                        <CheckCircle2 className="h-3 w-3" />
                        Instant confirmation
                      </span>
                    </div>
                  </div>
                  {method === "card" && (
                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </div>
                <p className="mt-2 ml-[52px] text-xs text-muted-foreground">
                  Earn credit card rewards or cashback on your rent payment
                </p>
                {method === "card" && numAmount > 0 && (
                  <p className="mt-1 ml-[52px] text-xs text-muted-foreground">
                    Processing fee: {formatMoney(surcharge)} (3.25%)
                  </p>
                )}
              </button>

              {/* SECONDARY: ACH option */}
              <button
                type="button"
                onClick={() => {
                  setMethod("ach");
                  setCardDisputeAck(false);
                }}
                className={cn(
                  "w-full rounded-lg border-2 p-4 text-left transition-all",
                  method === "ach"
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border hover:border-primary/30"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted shrink-0">
                      <Landmark className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">Pay by Bank Transfer (ACH)</p>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Clock className="h-3 w-3" />
                        1–3 business day processing
                      </span>
                    </div>
                  </div>
                  {method === "ach" && (
                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </div>
                <p className="mt-1 ml-[52px] text-xs text-muted-foreground">
                  {rentInfo?.achFeeMode === "TENANT"
                    ? `ACH Processing Fee: ${formatMoney(rentInfo.achFeeAmount)}`
                    : "No processing fee"}
                </p>
              </button>
            </div>

            {/* Fee breakdown */}
            {numAmount > 0 && (
              <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Rent Amount</span>
                  <span>{formatMoney(numAmount)}</span>
                </div>
                {method === "card" && surcharge > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Card Convenience Fee (3.25%)</span>
                    <span>+{formatMoney(surcharge)}</span>
                  </div>
                )}
                {method === "ach" && achFee > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>ACH Processing Fee</span>
                    <span>+{formatMoney(achFee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-medium border-t border-border pt-1 mt-1">
                  <span>Total</span>
                  <span>{formatMoney(totalCharge)}</span>
                </div>
              </div>
            )}

            {method === "ach" && (
              <>
                {rentInfo?.hasSavedAch && !showAchForm ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-emerald-500" />
                        <span className="font-medium">
                          {rentInfo.savedBankAccountType === "savings" ? "Savings" : "Checking"} Account
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Bank account ending in {rentInfo.savedBankLast4}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAchForm(true)}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Use a different bank account
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="routingNumber">Routing Number</Label>
                      <Input
                        id="routingNumber"
                        name="routingNumber"
                        placeholder="9 digits"
                        maxLength={9}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="accountNumber">Account Number</Label>
                      <Input
                        id="accountNumber"
                        name="accountNumber"
                        placeholder="Account number"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Account Type</Label>
                      <Select name="accountType" defaultValue="checking">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="checking">Checking</SelectItem>
                          <SelectItem value="savings">Savings</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </>
            )}

            {method === "card" && !rentInfo?.hasSavedCard && (
              <div className="rounded-lg border border-border p-6 text-center space-y-3">
                <CreditCard className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Add a card to pay rent instantly.
                </p>
                <p className="text-xs text-muted-foreground">
                  You&apos;ll be redirected to our secure payment partner to enter your card details.
                </p>
                <Button
                  type="button"
                  onClick={openVaultCardForm}
                  disabled={cardFormLoading}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  {cardFormLoading ? "Loading..." : "Add Card"}
                </Button>
              </div>
            )}

            {method === "card" && (
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="cardDisputeAck"
                  checked={cardDisputeAck}
                  onChange={(e) => setCardDisputeAck(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-border"
                />
                <label htmlFor="cardDisputeAck" className="text-sm text-muted-foreground">
                  I acknowledge that I am paying rent with a credit card. By proceeding,
                  I agree that this transaction is a legitimate rent payment and that any
                  and all disputes, chargebacks, or payment reversals are strictly
                  prohibited. Filing a fraudulent dispute may result in additional fees,
                  account suspension, and legal action.
                </label>
              </div>
            )}

            {method === "ach" && (
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="achAuth"
                  checked={achAuthorized}
                  onChange={(e) => setAchAuthorized(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-border"
                />
                <label htmlFor="achAuth" className="text-sm text-muted-foreground">
                  I authorize the debiting of my bank account for the amount of{" "}
                  {formatMoney(totalCharge)} via ACH electronic transfer.
                </label>
              </div>
            )}

            <Button
              type="submit"
              className={cn(
                "w-full",
                method === "card" && "gradient-bg text-white hover:opacity-90"
              )}
              disabled={loading || (method === "ach" && !achAuthorized) || (method === "card" && !cardDisputeAck) || (method === "card" && !rentInfo?.hasSavedCard)}
            >
              {loading
                ? "Processing..."
                : method === "card"
                ? `Pay ${formatMoney(totalCharge)} Instantly`
                : `Pay ${formatMoney(totalCharge)} via Bank Transfer`}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Trust & Security */}
      <div className="max-w-lg rounded-xl border border-border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-accent-lavender" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Secure Payment
          </span>
        </div>
        <TrustBadges variant="full" showPci={true} />
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Your payment is protected with 256-bit SSL encryption. Card data is
          tokenized through Kadima Gateway and never stored on DoorStax servers.
        </p>
      </div>

      <KadimaCardFormModal
        open={cardModalOpen}
        onOpenChange={setCardModalOpen}
        onSuccess={handleCardFormSuccess}
        onError={(msg) => toast.error(msg)}
      />
    </div>
  );
}

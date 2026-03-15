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
import { CreditCard, Landmark, CheckCircle2, Check, Clock, ShieldCheck } from "lucide-react";
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
          });
          setAmount(myRent.toFixed(2));
        }
      })
      .catch(() => {/* ignore */});
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

  /** Redirect to Kadima's vault hosted card form */
  async function openVaultCardForm() {
    setCardFormLoading(true);
    try {
      const callbackUrl = `${window.location.origin}/api/payments/vault-card-callback?redirect=/tenant/pay`;
      const res = await fetch("/api/payments/vault-card-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl: callbackUrl }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to load payment form");
        return;
      }
      const formData = await res.json();
      if (formData.url) {
        window.location.href = formData.url;
      } else {
        toast.error("Failed to generate payment form URL");
      }
    } catch {
      toast.error("Failed to initialize payment form");
    } finally {
      setCardFormLoading(false);
    }
  }

  const numAmount = parseFloat(amount) || 0;
  const surcharge = method === "card" ? Math.round(numAmount * 0.0325 * 100) / 100 : 0;
  const achFee = method === "ach" && rentInfo?.achFeeMode === "TENANT" ? rentInfo.achFeeAmount : 0;
  const totalCharge = numAmount + surcharge + achFee;

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
      payload.routingNumber = formData.get("routingNumber");
      payload.accountNumber = formData.get("accountNumber");
      payload.accountType = formData.get("accountType");
      payload.achAuthorized = true;
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

      toast.success("Payment submitted!");
      router.push("/tenant");
    } catch {
      toast.error("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Pay Rent" description="Make a one-time rent payment." />

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
    </div>
  );
}

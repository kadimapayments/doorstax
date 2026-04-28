"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import {
  CreditCard,
  Building2,
  Shield,
  CheckCircle2,
  Trash2,
  Loader2,
  Plus,
  AlertTriangle,
  Star,
} from "lucide-react";

/**
 * /tenant/payment-methods
 *
 * Canonical surface for tenants to manage saved cards + bank accounts.
 * Replaces:
 *   - The (card-only) section that used to live on /tenant/settings
 *     (the settings page now links here for payment-method actions).
 *   - The inline routing/account form on /tenant/pay (which silently
 *     failed to save banks for some tenants — exactly what trapped
 *     Cindy on a never-vaulted ACH path).
 *
 * Always renders two cards: Card and Bank Account. Each card has one
 * of three states:
 *
 *   1. Saved (healthy) — brand/last4 + Remove + Set-as-default buttons
 *   2. Saved (needs re-link, bank only) — pre-fix tenants whose
 *      kadimaAchCustomerId is null. Treat as broken; force re-add.
 *   3. Not saved — empty state with an Add button
 */

const brandImages: Record<string, { src: string; alt: string; width: number; height: number }> = {
  visa: { src: "/trust/visa.webp", alt: "Visa", width: 40, height: 14 },
  mastercard: { src: "/trust/mastercard.webp", alt: "Mastercard", width: 28, height: 18 },
  amex: { src: "/trust/amex.webp", alt: "Amex", width: 32, height: 14 },
  discover: { src: "/trust/discover.webp", alt: "Discover", width: 40, height: 14 },
};

function formatCardBrand(brand: string | null | undefined): string {
  if (!brand) return "Card";
  const brands: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "American Express",
    discover: "Discover",
  };
  return brands[brand.toLowerCase()] || brand;
}

interface PaymentMethodsState {
  card: { brand: string | null; last4: string } | null;
  bank: { last4: string; accountType: string | null; needsRelink: boolean } | null;
  defaultMethod: "card" | "ach" | null;
}

export default function TenantPaymentMethodsPage() {
  const router = useRouter();
  const [state, setState] = useState<PaymentMethodsState | null>(null);
  const [loading, setLoading] = useState(true);

  // Per-action busy flags so removing a card doesn't blank out the
  // bank section's button while the request is in flight.
  const [cardFormLoading, setCardFormLoading] = useState(false);
  const [removingCard, setRemovingCard] = useState(false);
  const [removingBank, setRemovingBank] = useState(false);
  const [settingDefault, setSettingDefault] = useState<"card" | "ach" | null>(null);

  // Bank inline form state (only visible when adding/replacing).
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankFormSubmitting, setBankFormSubmitting] = useState(false);
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState<"checking" | "savings">("checking");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [achAuthorized, setAchAuthorized] = useState(false);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/tenant/payment-methods");
      if (res.ok) {
        const json: PaymentMethodsState = await res.json();
        setState(json);
      }
    } catch {
      // Silent fail — UI shows empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // ─── Card-saved callback ───────────────────────────────────
  // The Kadima hosted card form redirects to
  // /api/payments/vault-card-callback which then redirects back here
  // with ?cardSaved=1 (or ?cardError=...) appended. Surface a toast
  // and refresh state. Mirrors the pattern from /tenant/settings.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("cardSaved")) {
      toast.success("Card saved");
      const url = new URL(window.location.href);
      url.searchParams.delete("cardSaved");
      window.history.replaceState({}, "", url.toString());
      fetchState();
    }
    if (params.get("cardError")) {
      toast.error("Card could not be saved. Please try again.");
      const url = new URL(window.location.href);
      url.searchParams.delete("cardError");
      window.history.replaceState({}, "", url.toString());
    }
  }, [fetchState]);

  // ─── Card actions ──────────────────────────────────────────

  async function handleAddCard() {
    setCardFormLoading(true);
    try {
      const callbackUrl = `${window.location.origin}/api/payments/vault-card-callback?redirect=/tenant/payment-methods`;
      const res = await fetch("/api/payments/vault-card-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl: callbackUrl }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to load card form");
        return;
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error("Failed to generate card form URL");
      }
    } catch {
      toast.error("Failed to initialize card form");
    } finally {
      setCardFormLoading(false);
    }
  }

  async function handleRemoveCard() {
    if (!confirm("Remove your saved card? You can add it back any time.")) return;
    setRemovingCard(true);
    try {
      const res = await fetch("/api/tenant/payment-methods/card", { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to remove card");
        return;
      }
      toast.success("Card removed");
      fetchState();
    } catch {
      toast.error("Failed to remove card");
    } finally {
      setRemovingCard(false);
    }
  }

  // ─── Bank actions ──────────────────────────────────────────

  async function handleSubmitBank(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!achAuthorized) {
      toast.error("Please confirm you authorize ACH debits");
      return;
    }
    setBankFormSubmitting(true);
    try {
      const res = await fetch("/api/tenant/payment-methods/bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routingNumber,
          accountNumber,
          accountType,
          accountHolderName,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Failed to save bank");
        return;
      }
      toast.success("Bank account saved");
      setShowBankForm(false);
      setRoutingNumber("");
      setAccountNumber("");
      setAccountType("checking");
      setAccountHolderName("");
      setAchAuthorized(false);
      fetchState();
    } catch {
      toast.error("Failed to save bank");
    } finally {
      setBankFormSubmitting(false);
    }
  }

  async function handleRemoveBank() {
    if (
      !confirm(
        "Remove your saved bank account? You can add it back any time."
      )
    ) return;
    setRemovingBank(true);
    try {
      const res = await fetch("/api/tenant/payment-methods/bank", { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to remove bank");
        return;
      }
      toast.success("Bank removed");
      fetchState();
    } catch {
      toast.error("Failed to remove bank");
    } finally {
      setRemovingBank(false);
    }
  }

  // ─── Set default ───────────────────────────────────────────

  async function handleSetDefault(method: "card" | "ach") {
    setSettingDefault(method);
    try {
      const res = await fetch("/api/tenant/payment-methods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultMethod: method }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to set default");
        return;
      }
      toast.success(`Default set to ${method === "card" ? "card" : "bank account"}`);
      fetchState();
    } catch {
      toast.error("Failed to set default");
    } finally {
      setSettingDefault(null);
    }
  }

  // ─── Render ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Payment methods"
          description="Manage how you pay rent and other charges."
        />
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const card = state?.card;
  const bank = state?.bank;
  const defaultMethod = state?.defaultMethod;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment methods"
        description="Manage how you pay rent and other charges. Saved methods can be used on the Pay page or for autopay."
      />

      {/* ─── CARD ───────────────────────────────────────────── */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle>Credit or debit card</CardTitle>
            </div>
            {defaultMethod === "card" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                <Star className="h-3 w-3" />
                Default
              </span>
            )}
          </div>
          <CardDescription>
            Charged instantly. A processing fee is added at payment time.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {card ? (
            <>
              <div className="flex items-center justify-between rounded-lg border bg-muted/10 p-4">
                <div className="flex items-center gap-3">
                  {card.brand && brandImages[card.brand.toLowerCase()] ? (
                    <Image
                      src={brandImages[card.brand.toLowerCase()].src}
                      alt={brandImages[card.brand.toLowerCase()].alt}
                      width={brandImages[card.brand.toLowerCase()].width}
                      height={brandImages[card.brand.toLowerCase()].height}
                    />
                  ) : (
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {formatCardBrand(card.brand)} ending {card.last4}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      <Shield className="inline h-3 w-3 mr-0.5" />
                      Stored securely with Kadima Payments
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {defaultMethod !== "card" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDefault("card")}
                      disabled={settingDefault !== null}
                    >
                      {settingDefault === "card" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Star className="h-3 w-3 mr-1" />
                      )}
                      Set as default
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveCard}
                    disabled={removingCard}
                    className="text-destructive hover:text-destructive"
                  >
                    {removingCard ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
              <CreditCard className="h-8 w-8 mx-auto text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">No card on file</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Add a card for instant rent payments and convenience.
                </p>
              </div>
              <Button onClick={handleAddCard} disabled={cardFormLoading} size="sm">
                {cardFormLoading ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3 mr-1" />
                )}
                Add card
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── BANK ───────────────────────────────────────────── */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle>Bank account (ACH)</CardTitle>
            </div>
            {defaultMethod === "ach" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                <Star className="h-3 w-3" />
                Default
              </span>
            )}
          </div>
          <CardDescription>
            Settles in 1–3 business days. No processing fee.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {bank && !showBankForm ? (
            <>
              {bank.needsRelink && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-medium text-amber-600">
                      Action needed: re-link this account
                    </p>
                    <p className="text-muted-foreground mt-0.5">
                      Your bank account was saved before our payment system
                      update and can&apos;t be used to pay until you re-add
                      it. Click <span className="font-medium">Replace</span>{" "}
                      below to fix it (takes about 30 seconds).
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between rounded-lg border bg-muted/10 p-4">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {bank.accountType === "savings" ? "Savings" : "Checking"} ending{" "}
                      {bank.last4}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      <Shield className="inline h-3 w-3 mr-0.5" />
                      Stored securely with Kadima Payments
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!bank.needsRelink && defaultMethod !== "ach" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDefault("ach")}
                      disabled={settingDefault !== null}
                    >
                      {settingDefault === "ach" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Star className="h-3 w-3 mr-1" />
                      )}
                      Set as default
                    </Button>
                  )}
                  <Button
                    variant={bank.needsRelink ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowBankForm(true)}
                  >
                    {bank.needsRelink ? "Replace" : "Replace"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveBank}
                    disabled={removingBank}
                    className="text-destructive hover:text-destructive"
                  >
                    {removingBank ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : !bank && !showBankForm ? (
            <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
              <Building2 className="h-8 w-8 mx-auto text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">No bank account on file</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Add a bank account to pay via ACH with no processing fee.
                </p>
              </div>
              <Button onClick={() => setShowBankForm(true)} size="sm">
                <Plus className="h-3 w-3 mr-1" />
                Add bank account
              </Button>
            </div>
          ) : null}

          {/* ── Inline add/replace form ── */}
          {showBankForm && (
            <form
              onSubmit={handleSubmitBank}
              className="space-y-4 rounded-lg border bg-muted/10 p-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="accountHolderName">Account holder name</Label>
                  <Input
                    id="accountHolderName"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    placeholder="As it appears on the account"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="accountType">Account type</Label>
                  <select
                    id="accountType"
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as "checking" | "savings")}
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="routingNumber">Routing number</Label>
                  <Input
                    id="routingNumber"
                    value={routingNumber}
                    onChange={(e) =>
                      setRoutingNumber(e.target.value.replace(/\D/g, "").slice(0, 9))
                    }
                    placeholder="9 digits"
                    inputMode="numeric"
                    pattern="\d{9}"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="accountNumber">Account number</Label>
                  <Input
                    id="accountNumber"
                    value={accountNumber}
                    onChange={(e) =>
                      setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 17))
                    }
                    placeholder="4–17 digits"
                    inputMode="numeric"
                    required
                  />
                </div>
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={achAuthorized}
                  onChange={(e) => setAchAuthorized(e.target.checked)}
                  className="mt-1"
                  required
                />
                <span className="text-xs text-muted-foreground">
                  I authorize DoorStax to debit the account above for rent and
                  related charges. I can revoke this authorization at any time
                  by removing the saved bank account.
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowBankForm(false);
                    setRoutingNumber("");
                    setAccountNumber("");
                    setAccountHolderName("");
                    setAchAuthorized(false);
                  }}
                  disabled={bankFormSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={bankFormSubmitting}>
                  {bankFormSubmitting ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                  )}
                  Save bank account
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* ─── Footer note ────────────────────────────────────── */}
      <div className="rounded-lg border bg-muted/10 p-3 flex items-start gap-2">
        <Shield className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Bank and card details are tokenized and stored with Kadima Payments
          (PCI DSS Level 1). DoorStax never sees your full account or card
          number.
        </p>
      </div>

      {/* Back to pay */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => router.push("/tenant/pay")}>
          Back to Pay
        </Button>
      </div>
    </div>
  );
}

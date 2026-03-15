"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { MetricCard } from "@/components/ui/metric-card";
import { DataTable, Column } from "@/components/ui/data-table";
import { KadimaCardForm, type CardFormResult } from "@/components/payments/kadima-card-form";
import { toast } from "sonner";
import { Building2, CreditCard, Calendar, ArrowLeft, Shield, CheckCircle2, Trash2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const brandImages: Record<string, { src: string; alt: string; width: number; height: number }> = {
  visa: { src: "/trust/visa.webp", alt: "Visa", width: 40, height: 14 },
  mastercard: { src: "/trust/mastercard.webp", alt: "Mastercard", width: 28, height: 18 },
  amex: { src: "/trust/amex.webp", alt: "Amex", width: 32, height: 14 },
  discover: { src: "/trust/discover.webp", alt: "Discover", width: 40, height: 14 },
};

interface SubscriptionPayment {
  id: string;
  amount: string;
  status: string;
  billingPeriod: string;
  paidAt: string;
}

interface SubscriptionData {
  id?: string;
  status?: string;
  basePrice?: string;
  perBuildingPrice?: string;
  buildingCount?: number;
  currentAmount?: string;
  nextBillingDate?: string;
  lastBillingDate?: string;
  trialEndsAt?: string;
  payments?: SubscriptionPayment[];
  // When no subscription exists:
  active?: boolean;
  estimatedPrice?: number;
}

interface CardInfo {
  hasCard: boolean;
  cardBrand: string | null;
  cardLast4: string | null;
  customerId: string | null;
}

export default function BillingPage() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [cardInfo, setCardInfo] = useState<CardInfo | null>(null);
  const [cardLoading, setCardLoading] = useState(true);
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardSaving, setCardSaving] = useState(false);
  const [hostedToken, setHostedToken] = useState<string | null>(null);

  async function fetchSubscription() {
    try {
      const res = await fetch("/api/subscription");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      toast.error("Failed to load subscription data");
    } finally {
      setLoading(false);
    }
  }

  async function fetchCardInfo() {
    try {
      const res = await fetch("/api/pm-card");
      if (res.ok) {
        const json = await res.json();
        setCardInfo(json);
      }
    } catch {
      // Silent fail
    } finally {
      setCardLoading(false);
    }
  }

  useEffect(() => {
    fetchSubscription();
    fetchCardInfo();
  }, []);

  async function handleStartSubscription() {
    setActionLoading(true);
    try {
      const res = await fetch("/api/subscription", { method: "POST" });
      if (res.ok) {
        toast.success("Subscription started with 14-day trial!");
        await fetchSubscription();
      } else {
        const json = await res.json();
        toast.error(json.error || "Failed to start subscription");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancelSubscription() {
    setActionLoading(true);
    try {
      const res = await fetch("/api/subscription", { method: "PUT" });
      if (res.ok) {
        toast.success("Subscription cancelled");
        await fetchSubscription();
      } else {
        const json = await res.json();
        toast.error(json.error || "Failed to cancel subscription");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAddCard() {
    setShowCardForm(true);
    try {
      // Step 1: Ensure PM has a Kadima customer
      const custRes = await fetch("/api/pm-card", { method: "PUT" });
      if (!custRes.ok) {
        toast.error("Failed to initialize payment setup");
        setShowCardForm(false);
        return;
      }

      // Step 2: Get hosted token
      const tokenRes = await fetch("/api/payments/hosted-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: window.location.origin, saveCard: "required" }),
      });
      if (!tokenRes.ok) {
        toast.error("Failed to generate secure form");
        setShowCardForm(false);
        return;
      }
      const tokenData = await tokenRes.json();
      setHostedToken(tokenData.token);
    } catch {
      toast.error("Failed to initialize card form");
      setShowCardForm(false);
    }
  }

  async function handleRemoveCard() {
    setCardSaving(true);
    try {
      const res = await fetch("/api/pm-card", { method: "DELETE" });
      if (res.ok) {
        toast.success("Card removed");
        await fetchCardInfo();
      } else {
        toast.error("Failed to remove card");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setCardSaving(false);
    }
  }

  // Handle Kadima hosted fields card save result
  const handleCardSuccess = useCallback(
    async (data: CardFormResult) => {
      setCardSaving(true);
      try {
        const cardToken = data.cardToken || data.cardId;
        if (!cardToken) {
          toast.error("Card tokenization failed. Please try again.");
          setCardSaving(false);
          return;
        }
        const res = await fetch("/api/pm-card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: data.customerId,
            cardId: cardToken,
            cardBrand: data.cardBrand || null,
            cardLast4: data.lastFour || null,
          }),
        });

        if (res.ok) {
          toast.success("Payment method saved!");
          await fetchCardInfo();
          setShowCardForm(false);
          setHostedToken(null);
        } else {
          toast.error("Failed to save card");
        }
      } catch {
        toast.error("Something went wrong");
      } finally {
        setCardSaving(false);
      }
    },
    []
  );

  function handleCardError(message: string) {
    toast.error(message || "Card tokenization failed");
    setShowCardForm(false);
    setHostedToken(null);
  }

  const hasSubscription = data && data.active !== false && data.id;
  const buildingCount = hasSubscription
    ? data.buildingCount ?? 1
    : data?.buildingCount ?? 0;
  const currentAmount = hasSubscription
    ? parseFloat(String(data.currentAmount ?? "0"))
    : data?.estimatedPrice ?? 150;
  const status = hasSubscription ? data.status ?? "ACTIVE" : null;

  const paymentColumns: Column<SubscriptionPayment>[] = [
    {
      key: "paidAt",
      header: "Date",
      cell: (row) => new Date(row.paidAt).toLocaleDateString(),
    },
    {
      key: "amount",
      header: "Amount",
      cell: (row) => `$${parseFloat(row.amount).toFixed(2)}`,
    },
    {
      key: "billingPeriod",
      header: "Period",
      cell: (row) => row.billingPeriod,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
  ];

  // Card brand display name
  function formatCardBrand(brand: string | null): string {
    if (!brand) return "Card";
    const brands: Record<string, string> = {
      visa: "Visa",
      mastercard: "Mastercard",
      amex: "American Express",
      discover: "Discover",
    };
    return brands[brand.toLowerCase()] || brand;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Billing" description="Manage your subscription and billing" />
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Manage your subscription and billing"
        actions={
          <Link href="/dashboard/settings">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Settings
            </Button>
          </Link>
        }
      />

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Monthly Price"
          value={`$${currentAmount.toFixed(2)}`}
          icon={<CreditCard className="h-4 w-4" />}
        />
        <MetricCard
          label="Units"
          value={buildingCount}
          icon={<Building2 className="h-4 w-4" />}
        />
        <MetricCard
          label="Next Billing"
          value={
            hasSubscription && data.nextBillingDate
              ? new Date(data.nextBillingDate).toLocaleDateString()
              : "N/A"
          }
          icon={<Calendar className="h-4 w-4" />}
        />
      </div>

      {/* Payment Method Card */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Payment Method</CardTitle>
              <CardDescription>
                Card on file for subscription billing
              </CardDescription>
            </div>
            <Shield className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {cardLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : cardInfo?.hasCard ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-14 items-center justify-center rounded-md border border-border bg-muted/50">
                  {cardInfo.cardBrand && brandImages[cardInfo.cardBrand.toLowerCase()] ? (
                    <Image
                      src={brandImages[cardInfo.cardBrand.toLowerCase()].src}
                      alt={brandImages[cardInfo.cardBrand.toLowerCase()].alt}
                      width={brandImages[cardInfo.cardBrand.toLowerCase()].width}
                      height={brandImages[cardInfo.cardBrand.toLowerCase()].height}
                      className="object-contain"
                    />
                  ) : (
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {formatCardBrand(cardInfo.cardBrand)} ending in {cardInfo.cardLast4}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    Active payment method
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddCard}
                  disabled={cardSaving}
                >
                  Update Card
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveCard}
                  disabled={cardSaving}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                <p className="text-sm font-medium text-amber-500">
                  No payment method on file
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add a credit card to ensure uninterrupted service after your free trial ends.
                </p>
              </div>
              {!showCardForm && (
                <Button onClick={handleAddCard} size="sm">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Add Payment Method
                </Button>
              )}
            </div>
          )}

          {/* Kadima Hosted Fields */}
          {showCardForm && hostedToken && (
            <div className="space-y-3">
              <KadimaCardForm
                token={hostedToken}
                onSuccess={handleCardSuccess}
                onError={handleCardError}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCardForm(false);
                  setHostedToken(null);
                }}
              >
                Cancel
              </Button>
            </div>
          )}

          {showCardForm && !hostedToken && (
            <div className="text-sm text-muted-foreground py-4 text-center">
              Loading secure payment form...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Plan Card */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Current Plan</CardTitle>
              <CardDescription>DoorStax Property Management</CardDescription>
            </div>
            {status && <StatusBadge status={status} />}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Trial Info */}
          {status === "TRIALING" && data?.trialEndsAt && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
              <p className="text-sm font-medium text-amber-500">
                Trial ends on{" "}
                {new Date(data.trialEndsAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Your subscription will begin billing automatically after the trial period.
              </p>
            </div>
          )}

          {/* Pricing Breakdown */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Pricing Breakdown</p>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Base fee (includes up to 50 units)</span>
                <span>$150.00</span>
              </div>
              {buildingCount > 50 && (() => {
                const additional = buildingCount - 50;
                const b1 = Math.min(additional, 449);
                const b2 = Math.min(Math.max(0, additional - 449), 500);
                const b3 = Math.max(0, additional - 949);
                return (
                  <>
                    {b1 > 0 && (
                      <div className="flex justify-between">
                        <span>{b1} unit{b1 !== 1 ? "s" : ""} @ $3.00 (51-499)</span>
                        <span>${(b1 * 3).toFixed(2)}</span>
                      </div>
                    )}
                    {b2 > 0 && (
                      <div className="flex justify-between">
                        <span>{b2} unit{b2 !== 1 ? "s" : ""} @ $2.50 (500-999)</span>
                        <span>${(b2 * 2.5).toFixed(2)}</span>
                      </div>
                    )}
                    {b3 > 0 && (
                      <div className="flex justify-between">
                        <span>{b3} unit{b3 !== 1 ? "s" : ""} @ $2.00 (1000+)</span>
                        <span>${(b3 * 2).toFixed(2)}</span>
                      </div>
                    )}
                  </>
                );
              })()}
              <div className="flex justify-between border-t border-border pt-2 font-medium text-foreground">
                <span>Total per month</span>
                <span>${currentAmount.toFixed(2)}/mo</span>
              </div>
              <div className="pt-2 text-xs text-muted-foreground">
                <p>50 units = $150 | 100 units = $300 | 500 units = $1,500 | 1,000 units = $2,749</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {!hasSubscription && (
              <Button onClick={handleStartSubscription} disabled={actionLoading}>
                {actionLoading ? "Starting..." : "Start Subscription (14-day trial)"}
              </Button>
            )}
            {hasSubscription && status !== "CANCELLED" && (
              <Button
                variant="outline"
                onClick={handleCancelSubscription}
                disabled={actionLoading}
                className="text-destructive hover:text-destructive"
              >
                {actionLoading ? "Cancelling..." : "Cancel Subscription"}
              </Button>
            )}
            {status === "CANCELLED" && (
              <p className="text-sm text-muted-foreground">
                Your subscription has been cancelled. Contact support to reactivate.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      {hasSubscription && data.payments && data.payments.length > 0 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Payment History</CardTitle>
            <CardDescription>Your recent subscription payments</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={paymentColumns}
              data={data.payments}
              emptyMessage="No payments yet."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

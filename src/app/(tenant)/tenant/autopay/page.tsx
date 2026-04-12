"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { RefreshCw, CreditCard, Landmark, CheckCircle2, Clock, Check } from "lucide-react";
import { cn } from "@/lib/utils";

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

interface ProfileInfo {
  hasSavedCard: boolean;
  savedCardLast4: string | null;
  savedCardBrand: string | null;
  autopayEnabled: boolean;
  kadimaCustomerId: string | null;
  kadimaCardTokenId: string | null;
  achFeeMode: "OWNER" | "TENANT" | "PM";
  achFeeAmount: number;
}

export default function AutopayPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [autopayMethod, setAutopayMethod] = useState<"card" | "ach">("card");
  const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null);

  useEffect(() => {
    fetch("/api/tenants/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setProfileInfo({
            hasSavedCard: data.hasSavedCard ?? false,
            savedCardLast4: data.savedCardLast4 ?? null,
            savedCardBrand: data.savedCardBrand ?? null,
            autopayEnabled: data.autopayEnabled ?? false,
            kadimaCustomerId: data.kadimaCustomerId ?? null,
            kadimaCardTokenId: data.kadimaCardTokenId ?? null,
            achFeeMode: data.achFeeMode ?? "OWNER",
            achFeeAmount: data.achFeeAmount ?? 0,
          });
        }
      })
      .catch(() => {});
  }, []);

  async function enableAutopay() {
    setLoading(true);
    try {
      const body: Record<string, unknown> = {};
      if (autopayMethod === "card" && profileInfo?.kadimaCardTokenId) {
        body.cardId = profileInfo.kadimaCardTokenId;
      }
      const res = await fetch("/api/payments/autopay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to enable autopay");
        return;
      }
      toast.success("Autopay enabled!");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function cancelAutopay() {
    setLoading(true);
    try {
      const res = await fetch("/api/payments/autopay", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to cancel autopay");
        return;
      }
      toast.success("Autopay cancelled");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Autopay"
        description="Never miss a rent payment again."
      />

      <Card className="max-w-lg border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4" />
            Set Up Automatic Payments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Your rent will be automatically charged on your due date each month.
            Choose your preferred payment method below.
          </p>

          {/* ── Autopay Method Selection ──────────────────── */}
          <div className="space-y-3">
            {/* PRIMARY: Card option */}
            <button
              type="button"
              onClick={() => setAutopayMethod("card")}
              className={cn(
                "w-full rounded-lg border-2 p-4 text-left transition-all",
                autopayMethod === "card"
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
                    <p className="font-semibold text-sm">AutoPay with Card</p>
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                      <CheckCircle2 className="h-3 w-3" />
                      Instant payment confirmation
                    </span>
                  </div>
                </div>
                {autopayMethod === "card" && (
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </div>
              {profileInfo?.hasSavedCard && profileInfo.savedCardLast4 && (
                <p className="mt-2 ml-[52px] text-xs text-muted-foreground">
                  Using saved card •••• {profileInfo.savedCardLast4}
                </p>
              )}
              <p className="mt-1 ml-[52px] text-xs text-muted-foreground">
                Earn rewards on every rent payment
              </p>
            </button>

            {/* SECONDARY: Bank Transfer option */}
            <button
              type="button"
              onClick={() => setAutopayMethod("ach")}
              className={cn(
                "w-full rounded-lg border-2 p-4 text-left transition-all",
                autopayMethod === "ach"
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
                    <p className="font-medium text-sm">AutoPay via Bank Transfer</p>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Clock className="h-3 w-3" />
                      1–3 business day processing
                    </span>
                  </div>
                </div>
                {autopayMethod === "ach" && (
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </div>
              <p className="mt-1 ml-[52px] text-xs text-muted-foreground">
                {profileInfo?.achFeeMode === "TENANT"
                  ? `ACH Processing Fee: ${formatMoney(profileInfo.achFeeAmount)}`
                  : "No processing fee"}
              </p>
            </button>
          </div>

          {/* Status indicator */}
          {profileInfo?.autopayEnabled && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Autopay is currently active
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={enableAutopay}
              disabled={loading}
              className={cn(
                autopayMethod === "card" && "gradient-bg text-white hover:opacity-90"
              )}
            >
              {loading ? "Setting up..." : "Enable Autopay"}
            </Button>
            <Button
              variant="outline"
              onClick={cancelAutopay}
              disabled={loading}
            >
              Cancel Autopay
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            You must have a payment method saved to your account before enabling
            autopay. Payment methods are tokenized and stored securely.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

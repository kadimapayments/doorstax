"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
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
import { KadimaCardForm, type CardFormResult } from "@/components/payments/kadima-card-form";
import { toast } from "sonner";
import { CreditCard, Shield, CheckCircle2, Trash2 } from "lucide-react";

const brandImages: Record<string, { src: string; alt: string; width: number; height: number }> = {
  visa: { src: "/trust/visa.webp", alt: "Visa", width: 40, height: 14 },
  mastercard: { src: "/trust/mastercard.webp", alt: "Mastercard", width: 28, height: 18 },
  amex: { src: "/trust/amex.webp", alt: "Amex", width: 32, height: 14 },
  discover: { src: "/trust/discover.webp", alt: "Discover", width: 40, height: 14 },
};

interface CardInfo {
  hasCard: boolean;
  cardBrand: string | null;
  cardLast4: string | null;
  customerId: string | null;
}

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

export default function TenantSettingsPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const user = session?.user;

  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Payment method state
  const [cardInfo, setCardInfo] = useState<CardInfo | null>(null);
  const [cardLoading, setCardLoading] = useState(true);
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardSaving, setCardSaving] = useState(false);
  const [hostedToken, setHostedToken] = useState<string | null>(null);

  async function fetchCardInfo() {
    try {
      const res = await fetch("/api/tenant/card");
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
    fetchCardInfo();
  }, []);

  async function handleAddCard() {
    setShowCardForm(true);
    try {
      // Ensure vault customer exists before loading hosted fields
      const vaultRes = await fetch("/api/tenant/vault-status");
      if (vaultRes.ok) {
        const vaultData = await vaultRes.json();
        if (!vaultData.hasVaultCustomer) {
          // Provision vault customer on-demand
          const provisionRes = await fetch("/api/tenant/vault-status", { method: "POST" });
          if (!provisionRes.ok) {
            toast.error("Unable to set up payment vault. Please try again.");
            setShowCardForm(false);
            return;
          }
        }
      }

      const tokenRes = await fetch("/api/payments/hosted-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: window.location.origin, saveCard: "required" }),
      });
      if (!tokenRes.ok) {
        toast.error("Failed to load secure payment form");
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
      const res = await fetch("/api/tenant/card", { method: "DELETE" });
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

  const handleCardSuccess = useCallback(
    async (data: CardFormResult) => {
      setCardSaving(true);
      try {
        const cardToken = data.cardToken || data.cardId || data.customerId;
        if (!cardToken) {
          toast.error("Card tokenization failed. Please try again.");
          setCardSaving(false);
          return;
        }
        const res = await fetch("/api/tenant/card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cardToken,
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

  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProfileLoading(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone") || undefined,
    };

    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to update profile");
        setProfileLoading(false);
        return;
      }

      await update();
      toast.success("Profile updated");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordLoading(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword"),
    };

    try {
      const res = await fetch("/api/user/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to change password");
        setPasswordLoading(false);
        return;
      }

      toast.success("Password changed");
      (e.target as HTMLFormElement).reset();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account settings"
      />

      <div className="max-w-2xl space-y-6">
        {/* Profile */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>
              Update your personal information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={user?.name || ""}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={user?.email || ""}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                />
              </div>
              <Button type="submit" disabled={profileLoading}>
                {profileLoading ? "Saving..." : "Save Profile"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Payment Method</CardTitle>
                <CardDescription>
                  Card on file for rent payments
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
                    Add a credit or debit card to pay rent and enable autopay.
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

        {/* Password */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Change Password</CardTitle>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    minLength={8}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    minLength={8}
                    required
                  />
                </div>
              </div>
              <Button type="submit" disabled={passwordLoading}>
                {passwordLoading ? "Changing..." : "Change Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

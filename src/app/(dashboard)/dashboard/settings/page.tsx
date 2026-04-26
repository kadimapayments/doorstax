"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { Users, Plug, ArrowRight, Upload, X, DollarSign, ShieldCheck } from "lucide-react";
import { ScreeningConfigPanel } from "@/components/rentspree/screening-config-panel";
import { MerchantApplicationCard } from "@/components/settings/merchant-application-card";
import { ReceiptSettingsCard } from "@/components/settings/receipt-settings-card";

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const user = session?.user;

  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Company branding state
  const [brandingLoading, setBrandingLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyLogo, setCompanyLogo] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Screening defaults state
  const [screeningDefaults, setScreeningDefaults] = useState({
    screeningCreditReport: true,
    screeningCriminal: true,
    screeningEviction: true,
    screeningApplication: true,
    screeningPayerType: "landlord",
  });
  const [screeningLoading, setScreeningLoading] = useState(false);

  // Fetch current profile data (including company branding) on mount
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/user/profile");
        if (res.ok) {
          const data = await res.json();
          setCompanyName(data.companyName || "");
          setCompanyLogo(data.companyLogo || "");
        }
      } catch {
        // silently fail — fields will just be empty
      }
    }
    fetchProfile();
  }, []);

  // Fetch screening defaults
  useEffect(() => {
    fetch("/api/rentspree/screening-defaults")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setScreeningDefaults(data);
      })
      .catch(() => {});
  }, []);

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

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate it's an image
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "logos");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Upload failed");
        return;
      }

      const data = await res.json();
      setCompanyLogo(data.url);
      toast.success("Logo uploaded");
    } catch {
      toast.error("Failed to upload logo");
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleBrandingSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBrandingLoading(true);

    // We need to send all profile fields since the PUT endpoint expects them
    const payload = {
      name: user?.name || "",
      email: user?.email || "",
      companyName: companyName || undefined,
      companyLogo: companyLogo || undefined,
    };

    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to update branding");
        setBrandingLoading(false);
        return;
      }

      toast.success("Company branding updated");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setBrandingLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your account settings" />

      <div className="max-w-2xl space-y-6">
        {/* Merchant Application — only renders if user has an in-progress app */}
        {user?.role === "PM" && <MerchantApplicationCard />}

        {/* Receipt prefix + sequence for cash/check receipts */}
        {user?.role === "PM" && <ReceiptSettingsCard />}

        {/* Profile */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>Update your personal information</CardDescription>
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

        {/* Company Branding */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Company Branding</CardTitle>
            <CardDescription>
              Add your company logo and name to appear on PDF reports and payment receipts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBrandingSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your Company LLC"
                />
              </div>

              <div className="space-y-2">
                <Label>Company Logo</Label>
                <div className="flex items-start gap-4">
                  {companyLogo ? (
                    <div className="relative h-20 w-20 rounded-lg border border-border overflow-hidden bg-muted">
                      <Image
                        src={companyLogo}
                        alt="Company logo"
                        fill
                        className="object-contain p-1"
                      />
                      <button
                        type="button"
                        onClick={() => setCompanyLogo("")}
                        className="absolute -top-1 -right-1 rounded-full bg-destructive text-destructive-foreground h-5 w-5 flex items-center justify-center text-xs hover:bg-destructive/90"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-20 w-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/50">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={logoUploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {logoUploading ? "Uploading..." : "Upload Logo"}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG or SVG. Max 5MB.
                    </p>
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={brandingLoading}>
                {brandingLoading ? "Saving..." : "Save Branding"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Screening Defaults */}
        {user?.role === "PM" && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Screening Defaults
              </CardTitle>
              <CardDescription>
                Default screening package for all units. Individual units can override these settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScreeningConfigPanel
                creditReport={screeningDefaults.screeningCreditReport}
                criminal={screeningDefaults.screeningCriminal}
                eviction={screeningDefaults.screeningEviction}
                application={screeningDefaults.screeningApplication}
                payerType={screeningDefaults.screeningPayerType}
                disabled={screeningLoading}
                onChange={async (newConfig) => {
                  const updated = {
                    screeningCreditReport: newConfig.creditReport,
                    screeningCriminal: newConfig.criminal,
                    screeningEviction: newConfig.eviction,
                    screeningApplication: newConfig.application,
                    screeningPayerType: newConfig.payerType,
                  };
                  setScreeningDefaults(updated);
                  setScreeningLoading(true);
                  try {
                    const res = await fetch("/api/rentspree/screening-defaults", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(updated),
                    });
                    if (res.ok) {
                      toast.success("Screening defaults updated");
                    } else {
                      toast.error("Failed to save screening defaults");
                    }
                  } catch {
                    toast.error("Something went wrong");
                  } finally {
                    setScreeningLoading(false);
                  }
                }}
              />
            </CardContent>
          </Card>
        )}

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

        {/* Billing */}
        <Link href="/dashboard/settings/billing">
          <Card className="border-border hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Billing</p>
                  <p className="text-sm text-muted-foreground">
                    Manage your subscription and payment history
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        {/* Team */}
        <Link href="/dashboard/settings/team">
          <Card className="border-border hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Team Members</p>
                  <p className="text-sm text-muted-foreground">
                    Invite and manage team roles
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        {/* Integrations */}
        <Link href="/dashboard/settings/integrations">
          <Card className="border-border hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Plug className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Integrations</p>
                  <p className="text-sm text-muted-foreground">
                    Connect with QuickBooks and other tools
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

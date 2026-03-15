"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Phone, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function SecuritySettingsPage() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"idle" | "verify">("idle");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((data) => {
      setTwoFactorEnabled(data.twoFactorEnabled || false);
      setPhone(data.twoFactorPhone || data.phone || "");
    }).catch(() => {});
  }, []);

  async function handleSendCode() {
    if (!phone) {
      toast.error("Please enter a phone number");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/2fa/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    if (res.ok) {
      setStep("verify");
      toast.success("Verification code sent (check console in dev)");
    } else {
      toast.error("Failed to send code");
    }
    setLoading(false);
  }

  async function handleVerify() {
    setLoading(true);
    const res = await fetch("/api/2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, phone }),
    });
    if (res.ok) {
      setTwoFactorEnabled(true);
      setStep("idle");
      setCode("");
      toast.success("Two-factor authentication enabled!");
    } else {
      toast.error("Invalid or expired code");
    }
    setLoading(false);
  }

  async function handleDisable() {
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ twoFactorEnabled: false, twoFactorPhone: null }),
    });
    if (res.ok) {
      setTwoFactorEnabled(false);
      toast.success("Two-factor authentication disabled");
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <PageHeader
        title="Security"
        description="Manage your account security settings."
      />

      <div className="rounded-lg border border-border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Two-Factor Authentication</h3>
            <p className="text-sm text-muted-foreground">
              Add an extra layer of security with SMS verification.
            </p>
          </div>
        </div>

        {twoFactorEnabled ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle className="h-4 w-4" />
              2FA is enabled
            </div>
            <p className="text-xs text-muted-foreground">
              Verification codes are sent to your phone when you log in.
            </p>
            <Button variant="outline" size="sm" onClick={handleDisable}>
              Disable 2FA
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="flex gap-2">
                <div className="flex items-center gap-1.5">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </div>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            {step === "verify" ? (
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                />
                <Button onClick={handleVerify} disabled={loading || !code} className="w-full">
                  {loading ? "Verifying..." : "Verify & Enable"}
                </Button>
              </div>
            ) : (
              <Button onClick={handleSendCode} disabled={loading || !phone}>
                {loading ? "Sending..." : "Enable 2FA"}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

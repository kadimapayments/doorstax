"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Loader2, Building2 } from "lucide-react";

export interface AchFormResult {
  accountId?: string;
  bankLast4?: string;
  accountType?: string;
  customerId?: string;
}

interface AchBankFormProps {
  onSuccess: (data: AchFormResult) => void;
  onError: (message: string) => void;
}

export function AchBankForm({ onSuccess, onError }: AchBankFormProps) {
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [accountType, setAccountType] = useState<"checking" | "savings">(
    "checking"
  );
  const [accountHolderName, setAccountHolderName] = useState("");
  const [saving, setSaving] = useState(false);

  const isValid =
    routingNumber.length === 9 &&
    accountNumber.length >= 4 &&
    accountNumber === confirmAccountNumber &&
    accountHolderName.trim().length > 0;

  async function handleSubmit() {
    if (!isValid) return;

    setSaving(true);
    try {
      // First ensure vault customer exists
      const vaultRes = await fetch("/api/tenant/vault-status");
      if (vaultRes.ok) {
        const vaultData = await vaultRes.json();
        if (!vaultData.hasVaultCustomer) {
          const provisionRes = await fetch("/api/tenant/vault-status", {
            method: "POST",
          });
          if (!provisionRes.ok) {
            onError("Unable to set up payment vault. Please try again.");
            setSaving(false);
            return;
          }
        }
      }

      // Save bank account via our API
      const res = await fetch("/api/tenant/onboarding/payment-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "ach",
          routingNumber,
          accountNumber,
          accountType,
          accountHolderName,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onSuccess({
          accountId: data.accountId,
          bankLast4: data.bankLast4,
          accountType: data.accountType,
          customerId: data.customerId,
        });
      } else {
        const err = await res.json();
        onError(err.error || "Failed to save bank account");
      }
    } catch {
      onError("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Account Holder Name</Label>
          <Input
            placeholder="John Doe"
            value={accountHolderName}
            onChange={(e) => setAccountHolderName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Routing Number</Label>
          <Input
            placeholder="9 digits"
            value={routingNumber}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 9);
              setRoutingNumber(v);
            }}
            maxLength={9}
            inputMode="numeric"
          />
          {routingNumber.length > 0 && routingNumber.length !== 9 && (
            <p className="text-xs text-destructive">
              Routing number must be 9 digits
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Account Number</Label>
          <Input
            placeholder="Account number"
            value={accountNumber}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 17);
              setAccountNumber(v);
            }}
            inputMode="numeric"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Confirm Account Number</Label>
          <Input
            placeholder="Re-enter account number"
            value={confirmAccountNumber}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 17);
              setConfirmAccountNumber(v);
            }}
            inputMode="numeric"
          />
          {confirmAccountNumber.length > 0 &&
            accountNumber !== confirmAccountNumber && (
              <p className="text-xs text-destructive">
                Account numbers do not match
              </p>
            )}
        </div>

        <div className="space-y-1.5">
          <Label>Account Type</Label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setAccountType("checking")}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                accountType === "checking"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-background text-muted-foreground hover:bg-accent"
              }`}
            >
              Checking
            </button>
            <button
              type="button"
              onClick={() => setAccountType("savings")}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                accountType === "savings"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-background text-muted-foreground hover:bg-accent"
              }`}
            >
              Savings
            </button>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!isValid || saving}
          className="w-full"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Building2 className="mr-2 h-4 w-4" />
              Save Bank Account
            </>
          )}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Your bank details are securely stored in an encrypted vault. DoorStax
          never stores your full account number.
        </p>
      </div>
    </div>
  );
}

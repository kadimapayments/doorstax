"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import type { WizardState } from "../_lib/wizard-state";

interface StepOwnerProps {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  errors: Record<string, string>;
}

interface OwnerRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  managementFeePercent: number | null;
}

export function StepOwner({ state, update, errors }: StepOwnerProps) {
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  async function fetchOwners() {
    try {
      const res = await fetch("/api/owners");
      if (res.ok) {
        const body = await res.json();
        setOwners(Array.isArray(body) ? body : []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOwners();
  }, []);

  return (
    <div className="space-y-5 rounded-xl border bg-card p-6">
      <div>
        <h2 className="text-lg font-semibold">Owner &amp; finance</h2>
        <p className="text-sm text-muted-foreground">
          Who owns this property, and what are the financial basics?
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="ownerId">Property owner *</Label>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Plus className="h-3 w-3" />
            Add new owner
          </button>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading owners…
          </div>
        ) : (
          <select
            id="ownerId"
            value={state.ownerId}
            onChange={(e) => update({ ownerId: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select an owner…</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.email ? ` — ${o.email}` : ""}
              </option>
            ))}
          </select>
        )}
        {errors.ownerId && (
          <p className="text-xs text-destructive">{errors.ownerId}</p>
        )}
        {!loading && owners.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No owners yet. Click <span className="font-medium">Add new owner</span>{" "}
            to create one, or head to{" "}
            <a
              href="/dashboard/owners/new"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              the full owner page
            </a>{" "}
            for advanced fee configuration.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="expectedMonthlyRentRoll">Expected monthly rent roll</Label>
        <Input
          id="expectedMonthlyRentRoll"
          type="number"
          step="0.01"
          min="0"
          value={state.expectedMonthlyRentRoll}
          onChange={(e) =>
            update({ expectedMonthlyRentRoll: e.target.value })
          }
          placeholder="e.g. 24000"
        />
        <p className="text-[11px] text-muted-foreground">
          Helps the underwriter sanity-check expected monthly processing
          volume for this property.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="mortgageHolder">Mortgage / lien holder</Label>
        <Input
          id="mortgageHolder"
          value={state.mortgageHolder}
          onChange={(e) => update({ mortgageHolder: e.target.value })}
          placeholder="e.g. Chase, Wells Fargo, private lender"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="insuranceCarrier">Insurance carrier</Label>
          <Input
            id="insuranceCarrier"
            value={state.insuranceCarrier}
            onChange={(e) => update({ insuranceCarrier: e.target.value })}
            placeholder="e.g. Travelers, Chubb"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="insurancePolicyNumber">Insurance policy #</Label>
          <Input
            id="insurancePolicyNumber"
            value={state.insurancePolicyNumber}
            onChange={(e) => update({ insurancePolicyNumber: e.target.value })}
            placeholder="Policy number"
          />
        </div>
      </div>

      <InlineOwnerModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCreated={(newOwnerId) => {
          setModalOpen(false);
          update({ ownerId: newOwnerId });
          fetchOwners();
        }}
      />
    </div>
  );
}

// ─── Inline owner modal ──────────────────────────────
// Minimal form — name + contact + mgmt fee %. For advanced fee config
// (ACH rate, payout frequency, custom fees, bulk property assignment,
// etc.) the user is pointed at /dashboard/owners/new.

interface InlineOwnerModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (ownerId: string) => void;
}

function InlineOwnerModal({
  open,
  onOpenChange,
  onCreated,
}: InlineOwnerModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [mgmtFee, setMgmtFee] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setName("");
    setEmail("");
    setPhone("");
    setMgmtFee("");
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Owner name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/owners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          managementFeePercent: mgmtFee ? Number(mgmtFee) : 0,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Failed to create owner");
        return;
      }
      toast.success("Owner created");
      onCreated(body.id);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create owner");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add new owner</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="owner-name">Name *</Label>
            <Input
              id="owner-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Owner full name or entity name"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="owner-email">Email</Label>
            <Input
              id="owner-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@example.com"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="owner-phone">Phone</Label>
            <Input
              id="owner-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="owner-mgmt-fee">Management fee %</Label>
            <Input
              id="owner-mgmt-fee"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={mgmtFee}
              onChange={(e) => setMgmtFee(e.target.value)}
              placeholder="e.g. 7.5"
            />
            <p className="text-[11px] text-muted-foreground">
              Advanced fee config (ACH rate, custom fees, payout frequency) is
              on the{" "}
              <a
                href="/dashboard/owners/new"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                full owner page
              </a>
              .
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Create owner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Shield } from "lucide-react";
import type { RecoveryPlanStatus } from "./progress-bar";

interface PlanShape {
  id: string;
  status: RecoveryPlanStatus;
  requiredPayments: number;
  completedPayments: number;
  forgivenessAmount: number | string;
  originalBalance: number | string;
  forgivenessLedgerEntryId: string | null;
  notes: string | null;
}

interface ManualOverrideDialogProps {
  plan: PlanShape;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const ALLOWED_NEXT: Record<RecoveryPlanStatus, RecoveryPlanStatus[]> = {
  PLAN_OFFERED: ["PLAN_ACTIVE", "PLAN_CANCELLED"],
  PLAN_ACTIVE: ["PLAN_AT_RISK", "PLAN_FAILED", "PLAN_COMPLETED"],
  PLAN_AT_RISK: ["PLAN_ACTIVE", "PLAN_FAILED", "PLAN_COMPLETED"],
  PLAN_FAILED: [],
  PLAN_COMPLETED: [],
  PLAN_CANCELLED: [],
};

/**
 * Privileged manual override. Mirrors the service-layer contract: every
 * submission requires a `note` that lands in the audit log verbatim,
 * and only legal status transitions are offered (the state machine
 * will reject the rest).
 */
export function ManualOverrideDialog({
  plan,
  open,
  onOpenChange,
  onSaved,
}: ManualOverrideDialogProps) {
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string>("");
  const [completedPayments, setCompletedPayments] = useState<string>("");
  const [forgivenessAmount, setForgivenessAmount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (open) {
      setNote("");
      setStatus("");
      setCompletedPayments("");
      setForgivenessAmount("");
      setNotes(plan.notes || "");
    }
  }, [open, plan.notes]);

  const nextStatusOptions = ALLOWED_NEXT[plan.status] || [];
  const forgivenessLocked = !!plan.forgivenessLedgerEntryId;

  async function handleSubmit() {
    if (!note.trim()) {
      toast.error("An explanatory note is required");
      return;
    }
    const overrides: Record<string, unknown> = {};
    if (status && status !== plan.status) overrides.status = status;
    if (completedPayments !== "") {
      const n = Number(completedPayments);
      if (!Number.isInteger(n) || n < 0 || n > plan.requiredPayments) {
        toast.error(`completedPayments must be 0–${plan.requiredPayments}`);
        return;
      }
      overrides.completedPayments = n;
    }
    if (forgivenessAmount !== "" && !forgivenessLocked) {
      const n = Number(forgivenessAmount);
      if (!Number.isFinite(n) || n < 0 || n > Number(plan.originalBalance)) {
        toast.error(
          `forgivenessAmount must be 0–${Number(plan.originalBalance)}`
        );
        return;
      }
      overrides.forgivenessAmount = n;
    }
    if (notes !== plan.notes) overrides.notes = notes;

    if (Object.keys(overrides).length === 0) {
      toast.error("Nothing to change — adjust at least one field");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/recovery-plans/${plan.id}/manual-update`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: note.trim(), overrides }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Override failed");
        return;
      }
      toast.success("Plan updated");
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Override failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-600" />
            Manual override
          </DialogTitle>
          <DialogDescription>
            Every change is logged with your user id and the note below.
            Used for corrections, back-dated payments, or admin escalations.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="note">Note (required)</Label>
            <textarea
              id="note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why are you making this change? This goes into the audit log verbatim."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {nextStatusOptions.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">— leave as {plan.status} —</option>
                {nextStatusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Illegal transitions are rejected by the state machine.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="completed">Completed payments</Label>
              <Input
                id="completed"
                type="number"
                min="0"
                max={plan.requiredPayments}
                value={completedPayments}
                onChange={(e) => setCompletedPayments(e.target.value)}
                placeholder={String(plan.completedPayments)}
                className="tabular-nums"
              />
              <p className="text-[11px] text-muted-foreground">
                Currently {plan.completedPayments} / {plan.requiredPayments}.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="forgiveness">Forgiveness amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="forgiveness"
                  type="number"
                  step="0.01"
                  min="0"
                  max={Number(plan.originalBalance)}
                  value={forgivenessAmount}
                  onChange={(e) => setForgivenessAmount(e.target.value)}
                  placeholder={Number(plan.forgivenessAmount).toFixed(2)}
                  className="pl-7 tabular-nums"
                  disabled={forgivenessLocked}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {forgivenessLocked
                  ? "Locked — forgiveness already applied to ledger."
                  : `Current: $${Number(plan.forgivenessAmount).toFixed(2)}`}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Plan notes (PM-visible)</Label>
            <textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Shield className="mr-2 h-4 w-4" />
            )}
            Save override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

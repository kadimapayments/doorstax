"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { LifeBuoy, Loader2 } from "lucide-react";

interface CreatePlanDialogProps {
  tenantId: string;
  tenantName: string;
  unitLabel: string;
  suggestedBalance: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the created planId after a successful submit. */
  onCreated?: (planId: string) => void;
  /** When true (default), redirects to the plan detail page on success. */
  redirectOnSuccess?: boolean;
}

function defaultNextMonthFirst(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Offer a recovery plan dialog. Fields are tuned for the most common
 * deal shape: "make 3 on-time payments and forgive $X". Anything more
 * exotic (policy=RESET, long grace windows, customized periods) is
 * adjustable from the same form.
 */
export function CreateRecoveryPlanDialog({
  tenantId,
  tenantName,
  unitLabel,
  suggestedBalance,
  open,
  onOpenChange,
  onCreated,
  redirectOnSuccess = true,
}: CreatePlanDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [originalBalance, setOriginalBalance] = useState("");
  const [forgivenessAmount, setForgivenessAmount] = useState("");
  const [requiredPayments, setRequiredPayments] = useState(3);
  const [startDate, setStartDate] = useState(defaultNextMonthFirst());
  const [graceDays, setGraceDays] = useState("5");
  const [failurePolicy, setFailurePolicy] = useState<"FAIL" | "RESET">("FAIL");
  const [notes, setNotes] = useState("");
  const [activateImmediately, setActivateImmediately] = useState(true);

  // Rehydrate the suggested balance whenever we re-open with a different tenant.
  useEffect(() => {
    if (open) {
      setOriginalBalance(
        suggestedBalance > 0 ? suggestedBalance.toFixed(2) : ""
      );
      setForgivenessAmount("");
      setRequiredPayments(3);
      setStartDate(defaultNextMonthFirst());
      setGraceDays("5");
      setFailurePolicy("FAIL");
      setNotes("");
      setActivateImmediately(true);
    }
  }, [open, suggestedBalance]);

  async function handleSubmit() {
    const origNum = Number(originalBalance);
    const forgNum = Number(forgivenessAmount);
    if (!Number.isFinite(origNum) || origNum <= 0) {
      toast.error("Original balance must be greater than 0");
      return;
    }
    if (!Number.isFinite(forgNum) || forgNum < 0) {
      toast.error("Forgiveness amount must be 0 or more");
      return;
    }
    if (forgNum > origNum) {
      toast.error("Forgiveness cannot exceed original balance");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/recovery-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          originalBalance: origNum,
          forgivenessAmount: forgNum,
          requiredPayments,
          startDate,
          graceDays: Number(graceDays) || 0,
          failurePolicy,
          notes: notes.trim() || undefined,
          activateImmediately,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Failed to create plan");
        return;
      }
      toast.success(
        activateImmediately
          ? "Plan created and activated"
          : "Plan offered to tenant"
      );
      onOpenChange(false);
      const planId = body.plan?.id;
      if (planId && onCreated) onCreated(planId);
      if (planId && redirectOnSuccess) {
        router.push(`/dashboard/delinquency/${planId}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create plan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-primary" />
            Offer recovery plan
          </DialogTitle>
          <DialogDescription>
            {tenantName} — {unitLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="origBal">Original balance</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="origBal"
                  type="number"
                  step="0.01"
                  min="0"
                  value={originalBalance}
                  onChange={(e) => setOriginalBalance(e.target.value)}
                  className="pl-7 tabular-nums"
                  placeholder="0.00"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Pre-filled from current ledger balance.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="forgAmt">Forgive on completion</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="forgAmt"
                  type="number"
                  step="0.01"
                  min="0"
                  value={forgivenessAmount}
                  onChange={(e) => setForgivenessAmount(e.target.value)}
                  className="pl-7 tabular-nums"
                  placeholder="0.00"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                ≤ original balance. Credited via a ledger entry on completion.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Required consecutive on-time payments</Label>
            <div className="flex gap-1.5">
              {[2, 3, 4, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRequiredPayments(n)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${
                    requiredPayments === n
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start (first required period)</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="graceDays">Grace days</Label>
              <Input
                id="graceDays"
                type="number"
                min="0"
                max="30"
                value={graceDays}
                onChange={(e) => setGraceDays(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Payments received within N days past due still count.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>On a late payment past grace</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFailurePolicy("FAIL")}
                className={`rounded-md border p-3 text-left text-sm transition ${
                  failurePolicy === "FAIL"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className="font-medium">End the plan</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  One miss = PLAN_FAILED (stricter, recommended)
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFailurePolicy("RESET")}
                className={`rounded-md border p-3 text-left text-sm transition ${
                  failurePolicy === "RESET"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className="font-medium">Reset the count</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Miss zeros progress, plan stays active (forgiving)
                </div>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (PM-visible)</Label>
            <textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional — context for the PM record."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={activateImmediately}
              onChange={(e) => setActivateImmediately(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span>
              Activate immediately (skip the OFFERED step)
              <span className="block text-[11px] text-muted-foreground">
                Uncheck to send the tenant an offer first and activate once they accept.
              </span>
            </span>
          </label>
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
              <LifeBuoy className="mr-2 h-4 w-4" />
            )}
            {activateImmediately ? "Create & activate" : "Offer plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

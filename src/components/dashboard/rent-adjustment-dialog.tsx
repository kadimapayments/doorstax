"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  DollarSign,
  AlertTriangle,
  Loader2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

export interface RentAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaseId: string;
  currentRent: number;
  propertyName: string;
  unitNumber: string;
  tenantName: string;
  /** One of the values used by `rentControlJurisdiction` on Property —
   *  the dialog uses it to surface jurisdiction-specific warnings. */
  jurisdiction?: string | null;
  onSuccess?: () => void;
}

// Matches the advisory caps in /api/leases/[id]/adjust-rent/route.ts.
// Keep the two lists in sync — duplicated client-side purely to render
// the warning before submission.
const JURISDICTION_CAPS: Record<string, { cap: number; label: string }> = {
  CA_AB1482: {
    cap: 10,
    label: "California AB 1482 caps increases at 5% + CPI (max 10%).",
  },
  LA_RSO: {
    cap: 3,
    label: "Los Angeles RSO limits increases to 3% annually as of 2026.",
  },
  NY_RENT_STABILIZED: {
    cap: 5.25,
    label:
      "NYC rent stabilization typically allows 2.75%–5.25% depending on lease term.",
  },
  OR_STATEWIDE: {
    cap: 10,
    label: "Oregon caps increases at 7% + CPI (max ~10%).",
  },
  DC: {
    cap: 12,
    label: "DC caps increases at CPI + 2% (varies annually, ~12%).",
  },
};

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function RentAdjustmentDialog({
  open,
  onOpenChange,
  leaseId,
  currentRent,
  propertyName,
  unitNumber,
  tenantName,
  jurisdiction,
  onSuccess,
}: RentAdjustmentDialogProps) {
  const [newAmount, setNewAmount] = useState(String(currentRent));
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reason, setReason] = useState("");
  const [noticePeriodDays, setNoticePeriodDays] = useState(30);
  const [complianceAck, setComplianceAck] = useState(false);
  const [complianceNote, setComplianceNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset form whenever the dialog opens for a new lease.
  useEffect(() => {
    if (open) {
      setNewAmount(String(currentRent));
      setEffectiveDate("");
      setReason("");
      setNoticePeriodDays(30);
      setComplianceAck(false);
      setComplianceNote("");
    }
  }, [open, currentRent]);

  const newRent = parseFloat(newAmount) || 0;
  const changeAmount = newRent - currentRent;
  const changePercent =
    currentRent > 0 ? ((newRent - currentRent) / currentRent) * 100 : 0;
  const isIncrease = changeAmount > 0;
  const isDecrease = changeAmount < 0;

  const jurisdictionWarning = useMemo(() => {
    if (!jurisdiction || jurisdiction === "NONE") return null;
    const entry = JURISDICTION_CAPS[jurisdiction];
    if (!entry) return null;
    if (!isIncrease || changePercent <= entry.cap) return null;
    return entry.label;
  }, [jurisdiction, changePercent, isIncrease]);

  const noticeCopy = useMemo(() => {
    if (noticePeriodDays === 30) return "Standard for most jurisdictions";
    if (noticePeriodDays === 60)
      return "Often required in CA for increases over 10%";
    return "Extended notice — check your local requirements";
  }, [noticePeriodDays]);

  function validate(): string | null {
    if (!newAmount || newRent <= 0) return "Enter a valid rent amount";
    if (!effectiveDate) return "Set an effective date";
    if (new Date(effectiveDate).getTime() <= Date.now())
      return "Effective date must be in the future";
    if (!complianceAck)
      return "You must acknowledge compliance with local rent control laws";
    return null;
  }

  async function handleSubmit() {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/leases/${leaseId}/adjust-rent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newAmount: newRent,
          effectiveDate,
          reason: reason || null,
          noticePeriodDays,
          complianceAck: true,
          complianceNote: complianceNote || null,
          jurisdiction: jurisdiction || "NONE",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Failed to adjust rent");
        return;
      }
      toast.success(
        `Rent adjusted to $${newRent.toFixed(2)} — notice emailed to tenant`
      );
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Adjust rent
          </DialogTitle>
          <DialogDescription>
            {tenantName} · {propertyName} Unit {unitNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Current → new */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">
                Current rent
              </Label>
              <div className="text-lg font-semibold mt-1 tabular-nums">
                ${currentRent.toFixed(2)}
              </div>
            </div>
            <div>
              <Label htmlFor="newRent" className="text-xs text-muted-foreground">
                New rent
              </Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="newRent"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="pl-7 text-lg font-semibold tabular-nums"
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          {/* Change preview */}
          {changeAmount !== 0 && (
            <div
              className={
                "rounded-lg p-3 text-sm flex items-center gap-2 " +
                (isIncrease
                  ? "bg-amber-500/10 text-amber-600"
                  : "bg-emerald-500/10 text-emerald-600")
              }
            >
              {isIncrease ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span className="font-medium tabular-nums">
                {isIncrease ? "+" : ""}
                {changePercent.toFixed(1)}%
              </span>
              <span className="text-xs opacity-80 tabular-nums">
                ({isIncrease ? "+" : ""}${changeAmount.toFixed(2)}/month)
              </span>
              {isIncrease && changePercent > 5 && (
                <span className="text-xs ml-auto">
                  Significant increase — confirm compliance
                </span>
              )}
            </div>
          )}

          {/* Jurisdiction warning */}
          {jurisdictionWarning && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-700">
                    Rent-control warning
                  </p>
                  <p className="text-xs text-red-600/80 mt-0.5">
                    {jurisdictionWarning}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Effective date */}
          <div>
            <Label htmlFor="effectiveDate">Effective date</Label>
            <Input
              id="effectiveDate"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              min={tomorrowISO()}
              disabled={submitting}
              className="mt-1"
            />
          </div>

          {/* Notice period */}
          <div>
            <Label htmlFor="notice">Notice period</Label>
            <select
              id="notice"
              value={noticePeriodDays}
              onChange={(e) => setNoticePeriodDays(Number(e.target.value))}
              disabled={submitting}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">
              {noticeCopy}
            </p>
          </div>

          {/* Reason */}
          <div>
            <Label htmlFor="reason">Reason</Label>
            <select
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">Select a reason…</option>
              <option value="Lease renewal">Lease renewal</option>
              <option value="Market adjustment">Market adjustment</option>
              <option value="Capital improvement">Capital improvement</option>
              <option value="Tax/insurance increase">
                Tax / insurance increase
              </option>
              <option value="CPI adjustment">CPI adjustment</option>
              <option value="Correction">Correction</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Compliance ack */}
          <div className="rounded-lg border p-3 space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={complianceAck}
                onChange={(e) => setComplianceAck(e.target.checked)}
                disabled={submitting}
                className="mt-1 rounded"
              />
              <span className="text-xs text-muted-foreground">
                I confirm this rent adjustment complies with all applicable
                local, state, and federal rent-control and tenant-protection
                laws. I have provided the required notice period and
                documentation.
              </span>
            </label>
            {complianceAck && (
              <textarea
                value={complianceNote}
                onChange={(e) => setComplianceNote(e.target.value)}
                placeholder="Optional: compliance context (e.g. property exempt, vacancy decontrol, signed renewal)"
                disabled={submitting}
                className="w-full rounded-md border bg-background px-3 py-2 text-xs h-16 resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={
              submitting ||
              !complianceAck ||
              newRent <= 0 ||
              !effectiveDate ||
              (isDecrease === false && isIncrease === false) // no change
            }
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <DollarSign className="mr-2 h-4 w-4" />
            )}
            Confirm adjustment
          </Button>
        </DialogFooter>

        <p className="text-[11px] text-center text-muted-foreground mt-2">
          A rent-adjustment notice will be emailed to the tenant on submit.
        </p>
      </DialogContent>
    </Dialog>
  );
}

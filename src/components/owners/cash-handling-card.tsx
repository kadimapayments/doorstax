"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { HandCoins, FileCheck, Wallet } from "lucide-react";

export type CashHandlingMode = "HOLD" | "DEPOSIT_TO_OWNER" | "PASS_THROUGH";

export interface CashHandlingValue {
  acceptsCash: boolean;
  acceptsChecks: boolean;
  cashHandlingMode: CashHandlingMode;
}

interface CashHandlingCardProps {
  value: CashHandlingValue;
  onChange: (next: CashHandlingValue) => void;
  disabled?: boolean;
}

const MODE_LABELS: Record<CashHandlingMode, { label: string; help: string }> = {
  HOLD: {
    label: "Hold (PM keeps physical custody)",
    help: "PM keeps the cash until reconciled at month-end. Default for most workflows.",
  },
  DEPOSIT_TO_OWNER: {
    label: "Deposit to owner bank",
    help: "PM is expected to deposit the funds directly into the owner's bank account.",
  },
  PASS_THROUGH: {
    label: "Pass through to next payout",
    help: "Cash is rolled into the owner's next scheduled payout cycle.",
  },
};

/**
 * Reusable card for editing an owner's offline-payment policy.
 * Used on the owner detail page (existing owners) and on the owner-new
 * page (creation). Pure controlled-component — no fetching or state of
 * its own; the parent owns persistence.
 */
export function CashHandlingCard({
  value,
  onChange,
  disabled,
}: CashHandlingCardProps) {
  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          Cash & check handling
        </CardTitle>
        <CardDescription>
          Whether PMs may record cash or check receipts on properties belonging
          to this owner, and what the workflow is once they do.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cash toggle */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={value.acceptsCash}
            onChange={(e) =>
              onChange({ ...value, acceptsCash: e.target.checked })
            }
            disabled={disabled}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <HandCoins className="h-3.5 w-3.5 text-emerald-600" />
              Accept cash
            </div>
            <p className="text-[11px] text-muted-foreground">
              When on, PMs see this owner&apos;s properties as eligible for cash
              receipts on the Record Payment page.
            </p>
          </div>
        </label>

        {/* Check toggle */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={value.acceptsChecks}
            onChange={(e) =>
              onChange({ ...value, acceptsChecks: e.target.checked })
            }
            disabled={disabled}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <FileCheck className="h-3.5 w-3.5 text-slate-500" />
              Accept checks
            </div>
            <p className="text-[11px] text-muted-foreground">
              When on, PMs may record check receipts. Bounce / NSF returns are
              handled in Phase 2 via a REVERSAL ledger entry.
            </p>
          </div>
        </label>

        {/* Handling mode */}
        <div className="space-y-2">
          <Label htmlFor="cashHandlingMode" className="text-sm">
            Cash-handling mode
          </Label>
          <select
            id="cashHandlingMode"
            value={value.cashHandlingMode}
            onChange={(e) =>
              onChange({
                ...value,
                cashHandlingMode: e.target.value as CashHandlingMode,
              })
            }
            disabled={disabled}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {(["HOLD", "DEPOSIT_TO_OWNER", "PASS_THROUGH"] as const).map((m) => (
              <option key={m} value={m}>
                {MODE_LABELS[m].label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            {MODE_LABELS[value.cashHandlingMode].help}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

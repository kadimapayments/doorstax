"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Receipt, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Receipt-prefix configuration for offline payments. Renders inside the
 * main settings page. Shows the current prefix + the next sequence
 * number, lets the PM update the prefix, and exposes a "reset starting
 * number" affordance for migrations from another platform.
 *
 * The reset is forward-only — the API rejects any attempt to lower the
 * sequence (would risk colliding with previously-issued numbers via the
 * `@@unique([landlordId, receiptNumber])` constraint).
 */
export function ReceiptSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [prefix, setPrefix] = useState("");
  const [nextSequence, setNextSequence] = useState<number | null>(null);
  const [resetValue, setResetValue] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/receipt");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setPrefix(data.receiptPrefix || "");
        setNextSequence(data.nextReceiptSequence ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSavePrefix() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/receipt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptPrefix: prefix }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Failed to save prefix");
        return;
      }
      setPrefix(body.receiptPrefix || "");
      toast.success("Receipt prefix saved");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetSequence() {
    const num = Number(resetValue);
    if (!Number.isInteger(num) || num < 1) {
      toast.error("Enter a positive whole number");
      return;
    }
    if (
      !window.confirm(
        `Set the next receipt number to ${num}? This can only move forward.`
      )
    ) {
      return;
    }
    setResetting(true);
    try {
      const res = await fetch("/api/settings/receipt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startSequence: num }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Failed to reset sequence");
        return;
      }
      setNextSequence(body.nextReceiptSequence ?? null);
      setResetValue("");
      toast.success("Next receipt number updated");
    } finally {
      setResetting(false);
    }
  }

  const previewNumber =
    nextSequence !== null && prefix.trim()
      ? `${prefix.toUpperCase()}-${nextSequence}`
      : null;

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          Offline-payment receipts
        </CardTitle>
        <CardDescription>
          Receipt numbers for cash and check payments. Each PM has their own
          numbering — yours appears as <code className="text-[11px]">PREFIX-N</code> on
          every cash/check receipt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : (
          <>
            {/* Prefix */}
            <div className="space-y-2">
              <Label htmlFor="receiptPrefix">Receipt prefix</Label>
              <div className="flex gap-2">
                <Input
                  id="receiptPrefix"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder="e.g. MORRISON"
                  maxLength={20}
                  disabled={saving}
                />
                <Button
                  onClick={handleSavePrefix}
                  disabled={saving || !prefix.trim()}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Letters, digits, hyphens, and underscores. Must start with a
                letter. Stored uppercased.
              </p>
            </div>

            {/* Preview */}
            {previewNumber && (
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Next receipt number
                </div>
                <div className="font-mono text-sm font-semibold">
                  {previewNumber}
                </div>
              </div>
            )}
            {!prefix.trim() && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  No prefix set yet — receipts will fall back to{" "}
                  <code className="text-[10px]">RECEIPT-{nextSequence}</code>{" "}
                  until you save one.
                </p>
              </div>
            )}

            {/* Sequence reset (rare, forward-only) */}
            <details className="text-sm">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                Migrating from another platform? Set a starting number…
              </summary>
              <div className="mt-3 space-y-2">
                <Label htmlFor="resetSequence" className="text-xs">
                  New next-receipt sequence
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="resetSequence"
                    type="number"
                    min={nextSequence ?? 1}
                    value={resetValue}
                    onChange={(e) => setResetValue(e.target.value)}
                    placeholder={String(nextSequence ?? 1001)}
                    disabled={resetting}
                  />
                  <Button
                    variant="outline"
                    onClick={handleResetSequence}
                    disabled={resetting || !resetValue.trim()}
                  >
                    {resetting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Set"
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Forward-only. Cannot be moved backwards once issued numbers
                  exist.
                </p>
              </div>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  );
}

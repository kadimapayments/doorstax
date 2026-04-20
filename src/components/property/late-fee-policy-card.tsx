"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, Save } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
  propertyId: string;
}

export function LateFeePolicyCard({ propertyId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [graceDays, setGraceDays] = useState(5);
  const [dailyAmount, setDailyAmount] = useState(10);
  const [maxAmount, setMaxAmount] = useState(100);
  const [notifyTenant, setNotifyTenant] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `/api/properties/${propertyId}/late-fee-policy`
        );
        if (res.ok) {
          const body = await res.json();
          if (body.policy) {
            setEnabled(body.policy.enabled);
            setGraceDays(body.policy.graceDays);
            setDailyAmount(Number(body.policy.dailyAmount));
            setMaxAmount(Number(body.policy.maxAmount));
            setNotifyTenant(body.policy.notifyTenant);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [propertyId]);

  async function handleSave() {
    if (dailyAmount > maxAmount && maxAmount > 0) {
      toast.error("Daily amount can't exceed the maximum cap");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/properties/${propertyId}/late-fee-policy`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled,
            graceDays,
            dailyAmount,
            maxAmount,
            notifyTenant,
          }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Late fee policy saved");
      } else {
        toast.error(body.error || "Save failed");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="border-border">
        <CardContent className="p-5">
          <div className="skeleton h-6 w-48 mb-3" />
          <div className="skeleton h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border card-hover">
      <CardContent className="p-5 space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Late fee policy
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Accrues daily once rent is past due + grace period. Caps at the
              max amount. Applies to every unit on this property.
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-sm font-medium">
              {enabled ? "Enabled" : "Disabled"}
            </span>
          </label>
        </div>

        <div
          className={
            "grid gap-4 sm:grid-cols-3 " + (enabled ? "" : "opacity-50")
          }
        >
          <div>
            <label className="text-xs font-medium">Grace period (days)</label>
            <input
              type="number"
              min={0}
              max={30}
              value={graceDays}
              onChange={(e) => setGraceDays(Number(e.target.value) || 0)}
              disabled={!enabled}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Days after due date before fees start.
            </p>
          </div>
          <div>
            <label className="text-xs font-medium">Daily fee ($)</label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={dailyAmount}
                onChange={(e) => setDailyAmount(Number(e.target.value) || 0)}
                disabled={!enabled}
                className="w-full rounded-lg border bg-background pl-7 pr-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Added each day rent is late.
            </p>
          </div>
          <div>
            <label className="text-xs font-medium">Maximum cap ($)</label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={maxAmount}
                onChange={(e) => setMaxAmount(Number(e.target.value) || 0)}
                disabled={!enabled}
                className="w-full rounded-lg border bg-background pl-7 pr-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Total fees stop accruing once this is hit.
            </p>
          </div>
        </div>

        <label
          className={
            "flex items-start gap-2 cursor-pointer " +
            (enabled ? "" : "opacity-50 pointer-events-none")
          }
        >
          <input
            type="checkbox"
            checked={notifyTenant}
            onChange={(e) => setNotifyTenant(e.target.checked)}
            disabled={!enabled}
            className="mt-1 h-4 w-4 rounded border-border"
          />
          <span className="text-sm">
            <span className="font-medium">Notify the tenant</span>
            <span className="text-muted-foreground">
              {" "}
              — email + in-app notification each time a fee is accrued.
            </span>
          </span>
        </label>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save policy
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

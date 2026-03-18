"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, Save } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────

interface FeeScheduleData {
  id: string;
  interchangePlusRate: number | null;
  qualifiedRate: number | null;
  midQualSurcharge: number | null;
  nonQualSurcharge: number | null;
  rateType: string | null;
  visaMcDiscoverRate: number | null;
  offlineDebitRate: number | null;
  amexOptBlueRate: number | null;
  authorizationFee: number | null;
  transactionFee: number | null;
  monthlyDashboardFee: number | null;
  voiceAuthFee: number | null;
  monthlyMinimumFee: number | null;
  applicationFee: number | null;
  batchFee: number | null;
  chargebackFee: number | null;
  retrievalFee: number | null;
  avsTransactionFee: number | null;
  monthlyFee: number | null;
  annualFee: number | null;
  monthlyPciFee: number | null;
  specialNotes: string | null;
}

interface FeeScheduleFormProps {
  merchantApplicationId: string;
  initialData: FeeScheduleData | null;
}

// ─── Helpers ─────────────────────────────────────────────────────

function toStr(val: number | null | undefined): string {
  return val != null ? String(val) : "";
}

// ─── Component ───────────────────────────────────────────────────

export function FeeScheduleForm({
  merchantApplicationId,
  initialData,
}: FeeScheduleFormProps) {
  // Transaction Pricing - Interchange Plus
  const [interchangePlusRate, setInterchangePlusRate] = useState(
    toStr(initialData?.interchangePlusRate)
  );

  // Transaction Pricing - Tiered
  const [qualifiedRate, setQualifiedRate] = useState(
    toStr(initialData?.qualifiedRate)
  );
  const [midQualSurcharge, setMidQualSurcharge] = useState(
    toStr(initialData?.midQualSurcharge)
  );
  const [nonQualSurcharge, setNonQualSurcharge] = useState(
    toStr(initialData?.nonQualSurcharge)
  );

  // Rate Type
  const [rateType, setRateType] = useState(initialData?.rateType || "");

  // Card-specific rates
  const [visaMcDiscoverRate, setVisaMcDiscoverRate] = useState(
    toStr(initialData?.visaMcDiscoverRate)
  );
  const [offlineDebitRate, setOfflineDebitRate] = useState(
    toStr(initialData?.offlineDebitRate)
  );
  const [amexOptBlueRate, setAmexOptBlueRate] = useState(
    toStr(initialData?.amexOptBlueRate)
  );

  // Other Fees
  const [authorizationFee, setAuthorizationFee] = useState(
    toStr(initialData?.authorizationFee)
  );
  const [transactionFee, setTransactionFee] = useState(
    toStr(initialData?.transactionFee)
  );
  const [monthlyDashboardFee, setMonthlyDashboardFee] = useState(
    toStr(initialData?.monthlyDashboardFee)
  );
  const [voiceAuthFee, setVoiceAuthFee] = useState(
    toStr(initialData?.voiceAuthFee)
  );
  const [monthlyMinimumFee, setMonthlyMinimumFee] = useState(
    toStr(initialData?.monthlyMinimumFee)
  );
  const [applicationFee, setApplicationFee] = useState(
    toStr(initialData?.applicationFee)
  );
  const [batchFee, setBatchFee] = useState(toStr(initialData?.batchFee));
  const [chargebackFee, setChargebackFee] = useState(
    toStr(initialData?.chargebackFee)
  );
  const [retrievalFee, setRetrievalFee] = useState(
    toStr(initialData?.retrievalFee)
  );
  const [avsTransactionFee, setAvsTransactionFee] = useState(
    toStr(initialData?.avsTransactionFee)
  );
  const [monthlyFee, setMonthlyFee] = useState(
    toStr(initialData?.monthlyFee)
  );
  const [annualFee, setAnnualFee] = useState(toStr(initialData?.annualFee));
  const [monthlyPciFee, setMonthlyPciFee] = useState(
    toStr(initialData?.monthlyPciFee)
  );

  // Special Notes
  const [specialNotes, setSpecialNotes] = useState(
    initialData?.specialNotes || ""
  );

  // UI state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const res = await fetch(
        `/api/admin/merchants/${merchantApplicationId}/fee-schedule`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            interchangePlusRate,
            qualifiedRate,
            midQualSurcharge,
            nonQualSurcharge,
            rateType,
            visaMcDiscoverRate,
            offlineDebitRate,
            amexOptBlueRate,
            authorizationFee,
            transactionFee,
            monthlyDashboardFee,
            voiceAuthFee,
            monthlyMinimumFee,
            applicationFee,
            batchFee,
            chargebackFee,
            retrievalFee,
            avsTransactionFee,
            monthlyFee,
            annualFee,
            monthlyPciFee,
            specialNotes,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to save (${res.status})`);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // Rate type checkboxes
  const rateTypes = rateType
    ? rateType.split(",").map((s) => s.trim())
    : [];
  function toggleRateType(type: string) {
    const current = new Set(rateTypes);
    if (current.has(type)) {
      current.delete(type);
    } else {
      current.add(type);
    }
    setRateType(Array.from(current).join(","));
  }

  return (
    <div className="space-y-8">
      {/* ── Transaction Pricing ─────────────────────────────── */}
      <div className="rounded-lg border bg-card p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Transaction Pricing</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Interchange plus and tiered rate configuration.
          </p>
        </div>

        {/* Rate Type Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Rate Type</Label>
          <div className="flex flex-wrap gap-4">
            {["Interchange Plus", "Tiered", "Flat Rate", "ERR"].map(
              (type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={rateTypes.includes(type)}
                    onChange={() => toggleRateType(type)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm">{type}</span>
                </label>
              )
            )}
          </div>
        </div>

        {/* Interchange Plus */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">
            Interchange Plus
          </h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="interchangePlusRate">
                Interchange Plus Rate (%)
              </Label>
              <Input
                id="interchangePlusRate"
                type="number"
                step="0.0001"
                value={interchangePlusRate}
                onChange={(e) => setInterchangePlusRate(e.target.value)}
                placeholder="0.0000"
              />
            </div>
          </div>
        </div>

        {/* Tiered Rates */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">
            Tiered Rates
          </h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="qualifiedRate">Qualified Rate (%)</Label>
              <Input
                id="qualifiedRate"
                type="number"
                step="0.0001"
                value={qualifiedRate}
                onChange={(e) => setQualifiedRate(e.target.value)}
                placeholder="0.0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="midQualSurcharge">
                Mid-Qual Surcharge (%)
              </Label>
              <Input
                id="midQualSurcharge"
                type="number"
                step="0.0001"
                value={midQualSurcharge}
                onChange={(e) => setMidQualSurcharge(e.target.value)}
                placeholder="0.0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nonQualSurcharge">
                Non-Qual Surcharge (%)
              </Label>
              <Input
                id="nonQualSurcharge"
                type="number"
                step="0.0001"
                value={nonQualSurcharge}
                onChange={(e) => setNonQualSurcharge(e.target.value)}
                placeholder="0.0000"
              />
            </div>
          </div>
        </div>

        {/* Card-Specific Rates */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">
            Card-Specific Rates
          </h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="visaMcDiscoverRate">
                Visa / MC / Discover Rate (%)
              </Label>
              <Input
                id="visaMcDiscoverRate"
                type="number"
                step="0.0001"
                value={visaMcDiscoverRate}
                onChange={(e) => setVisaMcDiscoverRate(e.target.value)}
                placeholder="0.0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="offlineDebitRate">
                Offline Debit Rate (%)
              </Label>
              <Input
                id="offlineDebitRate"
                type="number"
                step="0.0001"
                value={offlineDebitRate}
                onChange={(e) => setOfflineDebitRate(e.target.value)}
                placeholder="0.0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amexOptBlueRate">
                Amex OptBlue Rate (%)
              </Label>
              <Input
                id="amexOptBlueRate"
                type="number"
                step="0.0001"
                value={amexOptBlueRate}
                onChange={(e) => setAmexOptBlueRate(e.target.value)}
                placeholder="0.0000"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Other Fees ──────────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Other Fees</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Per-transaction and recurring fee amounts.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="authorizationFee">Authorization Fee ($)</Label>
            <Input
              id="authorizationFee"
              type="number"
              step="0.01"
              value={authorizationFee}
              onChange={(e) => setAuthorizationFee(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="transactionFee">Transaction Fee ($)</Label>
            <Input
              id="transactionFee"
              type="number"
              step="0.01"
              value={transactionFee}
              onChange={(e) => setTransactionFee(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="batchFee">Batch Fee ($)</Label>
            <Input
              id="batchFee"
              type="number"
              step="0.01"
              value={batchFee}
              onChange={(e) => setBatchFee(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="voiceAuthFee">Voice Auth Fee ($)</Label>
            <Input
              id="voiceAuthFee"
              type="number"
              step="0.01"
              value={voiceAuthFee}
              onChange={(e) => setVoiceAuthFee(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avsTransactionFee">
              AVS Transaction Fee ($)
            </Label>
            <Input
              id="avsTransactionFee"
              type="number"
              step="0.01"
              value={avsTransactionFee}
              onChange={(e) => setAvsTransactionFee(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="chargebackFee">Chargeback Fee ($)</Label>
            <Input
              id="chargebackFee"
              type="number"
              step="0.01"
              value={chargebackFee}
              onChange={(e) => setChargebackFee(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="retrievalFee">Retrieval Fee ($)</Label>
            <Input
              id="retrievalFee"
              type="number"
              step="0.01"
              value={retrievalFee}
              onChange={(e) => setRetrievalFee(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="applicationFee">Application Fee ($)</Label>
            <Input
              id="applicationFee"
              type="number"
              step="0.01"
              value={applicationFee}
              onChange={(e) => setApplicationFee(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="monthlyFee">Monthly Fee ($)</Label>
            <Input
              id="monthlyFee"
              type="number"
              step="0.01"
              value={monthlyFee}
              onChange={(e) => setMonthlyFee(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="monthlyDashboardFee">
              Monthly Dashboard Fee ($)
            </Label>
            <Input
              id="monthlyDashboardFee"
              type="number"
              step="0.01"
              value={monthlyDashboardFee}
              onChange={(e) => setMonthlyDashboardFee(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="monthlyMinimumFee">
              Monthly Minimum Fee ($)
            </Label>
            <Input
              id="monthlyMinimumFee"
              type="number"
              step="0.01"
              value={monthlyMinimumFee}
              onChange={(e) => setMonthlyMinimumFee(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="monthlyPciFee">Monthly PCI Fee ($)</Label>
            <Input
              id="monthlyPciFee"
              type="number"
              step="0.01"
              value={monthlyPciFee}
              onChange={(e) => setMonthlyPciFee(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="annualFee">Annual Fee ($)</Label>
            <Input
              id="annualFee"
              type="number"
              step="0.01"
              value={annualFee}
              onChange={(e) => setAnnualFee(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      {/* ── Special Notes ───────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Special Notes</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Any additional notes or special pricing arrangements.
          </p>
        </div>
        <textarea
          id="specialNotes"
          value={specialNotes}
          onChange={(e) => setSpecialNotes(e.target.value)}
          rows={4}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Enter any special notes about this merchant's fee arrangement..."
        />
      </div>

      {/* ── Save Button ─────────────────────────────────────── */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="mr-2 h-4 w-4" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {saving ? "Saving..." : saved ? "Saved" : "Save Fee Schedule"}
        </Button>
      </div>
    </div>
  );
}

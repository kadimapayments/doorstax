"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ClipboardList, CreditCard, DollarSign, Info, Save, Trash2, Users, Lock, Zap } from "lucide-react";
import { toast } from "sonner";
import { getPerUnitCost, canCustomizePaymentFees, getTier } from "@/lib/residual-tiers";

interface CustomFee {
  type: string; amountType: "FLAT" | "PERCENTAGE";
  cost: number; resell: number;
  responsibility: "OWNER" | "TENANT"; enabled: boolean;
}

interface FeeScheduleDetail {
  id: string;
  name: string;
  managementFeePercent: number;
  achRate: number;
  payoutFeeRate: number;
  unitFeeRate: number;
  billMe: boolean;
  billMeIncludeManagement: boolean;
  payoutFrequency: string;
  deductProcessingFees: boolean;
  deductExpenses: boolean;
  deductPlatformFee: boolean;
  achFeeResponsibility: string;
  customFees: CustomFee[];
  owners: { id: string; name: string; email: string | null }[];
}

export default function EditFeeSchedulePage() {
  const { id } = useParams();
  const router = useRouter();
  const [schedule, setSchedule] = useState<FeeScheduleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unitCount, setUnitCount] = useState<number | null>(null);

  const [form, setForm] = useState({
    name: "",
    managementFeePercent: 0,
    achRate: 6,
    payoutFeeRate: 0.0015,
    unitFeeRate: 0,
    deductExpenses: true,
    billMe: false,
    billMeIncludeManagement: true,
    payoutFrequency: "MONTHLY",
    achFeeResponsibility: "OWNER" as "OWNER" | "TENANT" | "PM",
    customFees: [] as CustomFee[],
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/fee-schedules/${id}`).then((r) => r.json()),
      fetch("/api/subscription").then((r) => r.json()),
    ])
      .then(([data, subData]) => {
        setSchedule(data);
        setUnitCount(subData?.buildingCount ?? 0);
        setForm({
          name: data.name,
          managementFeePercent: data.managementFeePercent,
          achRate: data.achRate,
          payoutFeeRate: data.payoutFeeRate ?? 0.0015,
          unitFeeRate: data.unitFeeRate ?? 0,
          deductExpenses: data.deductExpenses,
          billMe: data.billMe ?? false,
          billMeIncludeManagement: data.billMeIncludeManagement ?? true,
          payoutFrequency: data.payoutFrequency ?? "MONTHLY",
          achFeeResponsibility: (data.achFeeResponsibility ?? "OWNER") as "OWNER" | "TENANT" | "PM",
          customFees: (data.customFees ?? []) as CustomFee[],
        });
      })
      .finally(() => setLoading(false));
  }, [id]);

  const perUnitCost = unitCount !== null ? getPerUnitCost(unitCount) : 3;

  const tier = unitCount !== null ? getTier(unitCount) : null;
  const paymentLocked = unitCount !== null && !canCustomizePaymentFees(unitCount);
  const platformAchCost = tier?.platformAchCost ?? 6;

  // Computed spreads
  const achSpread = Math.max(0, form.achRate - platformAchCost);
  const payoutSpread = (form.payoutFeeRate - 0.0015) * 100;
  const unitFeeSpread = form.unitFeeRate - perUnitCost;

  async function handleSave() {
    if (form.achFeeResponsibility === "TENANT" && form.achRate > 6) {
      toast.error("ACH rate cannot exceed $6 when tenant pays");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        deductProcessingFees: form.achRate > 0,
        deductPlatformFee: form.unitFeeRate > 0,
        customFees: form.customFees.filter((f) => f.enabled),
      };
      const res = await fetch(`/api/fee-schedules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success("Schedule updated");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this fee schedule? Assigned owners will be unlinked.")) return;
    const res = await fetch(`/api/fee-schedules/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Schedule deleted");
      router.push("/dashboard/fee-schedules");
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to delete");
    }
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  if (!schedule) return <div className="text-center py-12 text-muted-foreground">Schedule not found</div>;

  const isBillMeDisabled = form.billMe;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/fee-schedules" className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{schedule.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Edit fee schedule · {schedule.owners.length} owners assigned
          </p>
        </div>
        <button onClick={handleDelete} className="rounded-lg border border-destructive/30 p-2 text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Schedule Name */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          Schedule Info
        </h2>
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* 5-Row Pricing Table */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Pricing Structure
        </h2>

        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Fee Type</th>
                <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Your Cost</th>
                <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Fee You Set</th>
                <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Your Earnings</th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1 - Card Processing */}
              <tr className="border-b">
                <td className="px-4 py-3 font-medium">Card Convenience Fee</td>
                <td className="px-4 py-3 text-center text-muted-foreground">3%</td>
                <td className="px-4 py-3 text-center text-muted-foreground">3.25% (tenant pays)</td>
                <td className="px-4 py-3 text-center">
                  <span className="text-emerald-500 font-medium">0.25%</span>
                </td>
              </tr>

              {/* Row 2 - ACH Processing */}
              <tr className="border-b">
                <td className="px-4 py-3 font-medium">
                  ACH Processing
                  {form.achFeeResponsibility === "TENANT" && (
                    <span className="text-xs text-muted-foreground ml-1">(charged to tenant)</span>
                  )}
                  {form.achFeeResponsibility === "OWNER" && (
                    <span className="text-xs text-muted-foreground ml-1">(deducted from payout)</span>
                  )}
                  {form.achFeeResponsibility === "PM" && (
                    <span className="text-xs text-muted-foreground ml-1">(you absorb)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground">{`$${platformAchCost.toFixed(2)}/tx`}</td>
                <td className="px-4 py-3 text-center">
                  {form.achFeeResponsibility === "PM" ? (
                    <span className="text-muted-foreground">{`$${platformAchCost.toFixed(2)}/tx`}</span>
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-muted-foreground">$</span>
                      <input
                        type="number"
                        min="0"
                        {...(form.achFeeResponsibility === "TENANT" ? { max: 6 } : {})}
                        step="0.25"
                        value={form.achRate}
                        onChange={(e) => setForm({ ...form, achRate: parseFloat(e.target.value) || 0 })}
                        className="w-16 rounded border bg-background px-2 py-1 text-center text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isBillMeDisabled}
                      />
                      <span className="text-muted-foreground">/tx</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={achSpread > 0 && form.achFeeResponsibility !== "PM" ? "text-emerald-500 font-medium" : "text-muted-foreground"}>
                    {form.achFeeResponsibility === "PM" ? "$0.00/tx" : `$${achSpread.toFixed(2)}/tx`}
                  </span>
                </td>
              </tr>

              {/* Row 3 - Payout Fee */}
              <tr className="border-b">
                <td className="px-4 py-3 font-medium">Payout Fee</td>
                <td className="px-4 py-3 text-center text-muted-foreground">0.15%</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <input
                      type="number"
                      min="0.15"
                      max="0.50"
                      step="0.01"
                      value={parseFloat((form.payoutFeeRate * 100).toFixed(2))}
                      onChange={(e) =>
                        setForm({ ...form, payoutFeeRate: parseFloat(e.target.value) / 100 || 0.0015 })
                      }
                      className="w-16 rounded border bg-background px-2 py-1 text-center text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isBillMeDisabled}
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={payoutSpread > 0 ? "text-emerald-500 font-medium" : "text-muted-foreground"}>
                    {payoutSpread.toFixed(2)}%
                  </span>
                </td>
              </tr>

              {/* Row 4 - Platform Fee (per unit) */}
              <tr className="border-b">
                <td className="px-4 py-3 font-medium">Platform Fee (per unit)</td>
                <td className="px-4 py-3 text-center text-muted-foreground">${perUnitCost.toFixed(2)}/unit</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-muted-foreground">$</span>
                    <input
                      type="number"
                      min="0"
                      max="3"
                      step="0.25"
                      value={form.unitFeeRate}
                      onChange={(e) => setForm({ ...form, unitFeeRate: parseFloat(e.target.value) || 0 })}
                      className="w-16 rounded border bg-background px-2 py-1 text-center text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isBillMeDisabled}
                    />
                    <span className="text-muted-foreground">/unit</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={unitFeeSpread > 0 ? "text-emerald-500 font-medium" : "text-muted-foreground"}>
                    ${unitFeeSpread.toFixed(2)}/unit
                  </span>
                </td>
              </tr>

              {/* Row 5 - Management Fee */}
              <tr>
                <td className="px-4 py-3 font-medium">Management Fee</td>
                <td className="px-4 py-3 text-center text-muted-foreground">N/A</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={form.managementFeePercent}
                      onChange={(e) =>
                        setForm({ ...form, managementFeePercent: parseFloat(e.target.value) || 0 })
                      }
                      className="w-16 rounded border bg-background px-2 py-1 text-center text-sm"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-emerald-500 font-medium">{form.managementFeePercent}%</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex items-start gap-2 text-xs text-muted-foreground mt-2">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Your Cost is what DoorStax charges you. Fee You Set is what you charge the owner. You keep the earnings.
          </span>
        </div>
      </div>

      {/* ACH Fee Responsibility */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          ACH Fee Responsibility
        </h2>
        <p className="text-xs text-muted-foreground">
          Choose who pays the ACH processing fee for bank transfer payments.
        </p>
        <div className="space-y-3">
          {([
            { value: "OWNER" as const, label: "Owner Pays (Deduct From Payout)", desc: "Fee deducted from owner payout. You keep the earnings." },
            { value: "TENANT" as const, label: "Tenant Pays", desc: "Tenant sees and pays the ACH fee at checkout. You keep the earnings. Max $6." },
            { value: "PM" as const, label: "I Pay (Bill Me)", desc: "You absorb the $2 DoorStax ACH cost. No earnings on this." },
          ]).map((opt) => (
            <label key={opt.value} className={`flex items-start gap-3 cursor-pointer rounded-lg border p-3 transition-colors ${form.achFeeResponsibility === opt.value ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/50"}`}>
              <input
                type="radio"
                name="achFeeResponsibility"
                value={opt.value}
                checked={form.achFeeResponsibility === opt.value}
                onChange={() => {
                  const newRate = opt.value === "TENANT" && form.achRate > 6 ? 6 : form.achRate;
                  setForm({ ...form, achFeeResponsibility: opt.value, achRate: newRate });
                }}
                disabled={form.billMe}
                className="mt-0.5"
              />
              <div>
                <span className="text-sm font-medium">{opt.label}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
        {form.achFeeResponsibility === "TENANT" && form.achRate > 6 && (
          <p className="text-xs text-amber-500 font-medium flex items-center gap-1">
            <Info className="h-3.5 w-3.5" />
            ACH rate will be capped at $6 when tenant pays.
          </p>
        )}
        {form.billMe && (
          <p className="text-xs text-muted-foreground italic">
            Bill Me is enabled — ACH responsibility is automatically set to &ldquo;I Pay&rdquo;.
          </p>
        )}
      </div>

      {/* Custom / Additional Fees */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          Additional Fees
        </h2>
        <p className="text-xs text-muted-foreground">
          Configure additional fee types. These define your pricing template — actual fee charging is configured per lease/application.
        </p>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Fee Type</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">Type</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">Cost</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">Fee You Set</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">Earnings</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">Pays</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">On</th>
              </tr>
            </thead>
            <tbody>
              {[
                { type: "APPLICATION", label: "Application Fee" },
                { type: "LATE", label: "Late Fee" },
                { type: "MOVE_IN", label: "Move-in Fee" },
                { type: "MAINTENANCE", label: "Maintenance Fee" },
                { type: "UTILITY", label: "Utility Passthrough" },
                { type: "INSURANCE", label: "Insurance Fee" },
                { type: "HOA", label: "HOA Fee" },
              ].map((feeType) => {
                const existing = form.customFees.find((f) => f.type === feeType.type);
                const fee = existing || { type: feeType.type, amountType: "FLAT" as const, cost: 0, resell: 0, responsibility: "TENANT" as const, enabled: false };
                const earnings = fee.resell - fee.cost;

                const updateFee = (updates: Partial<typeof fee>) => {
                  const updated = { ...fee, ...updates };
                  const newFees = form.customFees.filter((f) => f.type !== feeType.type);
                  newFees.push(updated);
                  setForm({ ...form, customFees: newFees });
                };

                return (
                  <tr key={feeType.type} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium text-xs">{feeType.label}</td>
                    <td className="px-3 py-2 text-center">
                      <select
                        value={fee.amountType}
                        onChange={(e) => updateFee({ amountType: e.target.value as "FLAT" | "PERCENTAGE" })}
                        className="text-xs rounded border bg-background px-1.5 py-1 w-14"
                      >
                        <option value="FLAT">$</option>
                        <option value="PERCENTAGE">%</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        step={fee.amountType === "FLAT" ? "1" : "0.25"}
                        value={fee.cost || ""}
                        onChange={(e) => updateFee({ cost: parseFloat(e.target.value) || 0 })}
                        className="w-14 rounded border bg-background px-1.5 py-1 text-center text-xs"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        step={fee.amountType === "FLAT" ? "1" : "0.25"}
                        value={fee.resell || ""}
                        onChange={(e) => updateFee({ resell: parseFloat(e.target.value) || 0 })}
                        className="w-14 rounded border bg-background px-1.5 py-1 text-center text-xs"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={earnings > 0 ? "text-emerald-500 font-medium text-xs" : "text-muted-foreground text-xs"}>
                        {fee.amountType === "FLAT" ? `$${earnings.toFixed(0)}` : `${earnings.toFixed(2)}%`}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <select
                        value={fee.responsibility}
                        onChange={(e) => updateFee({ responsibility: e.target.value as "OWNER" | "TENANT" })}
                        className="text-xs rounded border bg-background px-1 py-1 w-16"
                      >
                        <option value="TENANT">Tenant</option>
                        <option value="OWNER">Owner</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={fee.enabled}
                        onChange={(e) => updateFee({ enabled: e.target.checked })}
                        className="rounded border-muted-foreground"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deductions & Payout Frequency */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Options
        </h2>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.deductExpenses}
              onChange={(e) => setForm({ ...form, deductExpenses: e.target.checked })}
              className="rounded border-muted-foreground"
            />
            <div>
              <span className="text-sm font-medium">Deduct Property Expenses</span>
              <p className="text-xs text-muted-foreground">Maintenance, taxes, insurance, etc.</p>
            </div>
          </label>

          <div>
            <label className="block text-sm font-medium mb-1.5">Payout Frequency</label>
            <select
              value={form.payoutFrequency}
              onChange={(e) => setForm({ ...form, payoutFrequency: e.target.value })}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="MONTHLY">Monthly</option>
              <option value="SEMI_MONTHLY">Twice Monthly (Semi-Monthly)</option>
            </select>
            {form.payoutFrequency === "SEMI_MONTHLY" && (
              <p className="text-xs text-muted-foreground mt-1.5">
                Semi-monthly: mid-month draw (1st-15th) + end-of-month reconciliation (16th-end).
                Helps with owner cash flow.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bill Me Section */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Bill Me
        </h2>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.billMe}
            onChange={(e) => {
              const checked = e.target.checked;
              setForm({ ...form, billMe: checked, ...(checked ? { achFeeResponsibility: "PM" as const } : {}) });
            }}
            className="rounded border-muted-foreground mt-0.5"
          />
          <div>
            <span className="text-sm font-medium">Bill Me &mdash; I&apos;ll cover all platform costs</span>
            <p className="text-xs text-muted-foreground mt-0.5">
              ACH fees, payout fees, and platform fees billed to your account. Nothing deducted from owner payouts.
            </p>
          </div>
        </label>

        {form.billMe && (
          <div className="ml-6 pl-3 border-l-2 border-muted space-y-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.billMeIncludeManagement}
                onChange={(e) => setForm({ ...form, billMeIncludeManagement: e.target.checked })}
                className="rounded border-muted-foreground mt-0.5"
              />
              <div>
                <span className="text-sm font-medium">Include Management Fee</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {form.billMeIncludeManagement
                    ? "Management fee still deducted \u2014 you keep your management cut"
                    : "Owner gets 100% minus real property expenses (solo landlord mode)"}
                </p>
              </div>
            </label>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Assigned Owners */}
      {schedule.owners.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3">
            <Users className="h-4 w-4" />
            Assigned Owners ({schedule.owners.length})
          </h3>
          <div className="space-y-2">
            {schedule.owners.map((o) => (
              <Link key={o.id} href={`/dashboard/owners/${o.id}`} className="block rounded-lg border p-2.5 hover:bg-muted/50 transition-colors">
                <p className="text-sm font-medium">{o.name}</p>
                {o.email && <p className="text-xs text-muted-foreground">{o.email}</p>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

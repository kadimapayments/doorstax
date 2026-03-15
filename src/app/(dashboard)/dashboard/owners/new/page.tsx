"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserCheck } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/components/ui/phone-input";

interface PropertyOption {
  id: string;
  name: string;
  address: string;
  ownerId: string | null;
}

export default function NewOwnerPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [feeSchedules, setFeeSchedules] = useState<{id: string; name: string; managementFeePercent: number; achRate: number; deductProcessingFees: boolean; deductExpenses: boolean; deductPlatformFee: boolean; payoutFeeRate: number; unitFeeRate: number; billMe: boolean; billMeIncludeManagement: boolean; payoutFrequency: string; achFeeResponsibility?: string; customFees?: unknown[]}[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    managementFeePercent: 0,
    deductExpenses: true,
    achRate: 6,
    feeScheduleId: "",
    propertyIds: [] as string[],
    payoutFeeRate: 0.0015,
    unitFeeRate: 0,
    billMe: false,
    billMeIncludeManagement: true,
    payoutFrequency: "MONTHLY",
    achFeeResponsibility: "OWNER" as "OWNER" | "TENANT" | "PM",
    customFees: [] as unknown[],
  });

  useEffect(() => {
    fetch("/api/properties")
      .then((r) => r.json())
      .then((data) => {
        // Show all properties; mark which ones already have an owner
        setProperties(Array.isArray(data) ? data : data.properties || []);
      });
  }, []);

  useEffect(() => {
    fetch("/api/fee-schedules").then(r => r.json()).then(data => setFeeSchedules(data.schedules || []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Owner name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/owners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success("Owner created successfully");
        router.push("/dashboard/owners");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create owner");
      }
    } finally {
      setSaving(false);
    }
  }

  function toggleProperty(id: string) {
    setForm((prev) => ({
      ...prev,
      propertyIds: prev.propertyIds.includes(id)
        ? prev.propertyIds.filter((p) => p !== id)
        : [...prev.propertyIds, id],
    }));
  }

  const unassignedProperties = properties.filter((p) => !p.ownerId);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/owners" className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add Owner</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create a new property owner and configure their fee structure
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Contact Info */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Contact Information
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                placeholder="Property owner name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                placeholder="owner@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: formatPhoneNumber(e.target.value) })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
        </div>

        {/* Fee Configuration */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Fee Configuration
          </h2>
          <div>
            <label className="block text-sm font-medium mb-1">Apply Fee Schedule</label>
            <select
              value={form.feeScheduleId}
              onChange={(e) => {
                const schedId = e.target.value;
                const sched = feeSchedules.find(s => s.id === schedId);
                if (sched) {
                  setForm({
                    ...form,
                    feeScheduleId: schedId,
                    managementFeePercent: sched.managementFeePercent,
                    achRate: sched.achRate,
                    deductExpenses: sched.deductExpenses,
                    payoutFeeRate: sched.payoutFeeRate ?? 0.0015,
                    unitFeeRate: sched.unitFeeRate ?? 0,
                    billMe: sched.billMe ?? false,
                    billMeIncludeManagement: sched.billMeIncludeManagement ?? true,
                    payoutFrequency: sched.payoutFrequency ?? "MONTHLY",
                    achFeeResponsibility: (sched.achFeeResponsibility ?? "OWNER") as "OWNER" | "TENANT" | "PM",
                    customFees: sched.customFees ?? [],
                  });
                } else {
                  setForm({ ...form, feeScheduleId: "" });
                }
              }}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="">— None (custom) —</option>
              {feeSchedules.map(s => (
                <option key={s.id} value={s.id}>{s.name} (Mgmt: {s.managementFeePercent}%, ACH: ${s.achRate})</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">Select a saved fee schedule to auto-fill settings, or configure manually below.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Management Fee (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={form.managementFeePercent}
              onChange={(e) => setForm({ ...form, managementFeePercent: parseFloat(e.target.value) || 0 })}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm max-w-[200px]"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Percentage of collected rent you keep as your management fee
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ACH Rate to Owner ($)</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.25"
                value={form.achRate}
                onChange={(e) => setForm({ ...form, achRate: parseFloat(e.target.value) || 0 })}
                disabled={form.billMe}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm max-w-[200px] disabled:opacity-50"
              />
              {form.billMe && (
                <span className="ml-3 text-xs text-muted-foreground italic">Covered by you</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Amount charged per ACH transaction. Your cost: $2.00</p>
          </div>

          {/* ACH Fee Responsibility - compact */}
          <div>
            <label className="block text-sm font-medium mb-1.5">ACH Fee Responsibility</label>
            <div className="flex gap-3">
              {([
                { value: "OWNER" as const, label: "Owner Pays" },
                { value: "TENANT" as const, label: "Tenant Pays" },
                { value: "PM" as const, label: "I Pay" },
              ]).map((opt) => (
                <label key={opt.value} className={`flex items-center gap-1.5 cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition-colors ${form.achFeeResponsibility === opt.value ? "border-primary bg-primary/5 font-medium" : "border-input hover:bg-muted/50"}`}>
                  <input
                    type="radio"
                    name="ownerAchFeeResponsibility"
                    value={opt.value}
                    checked={form.achFeeResponsibility === opt.value}
                    onChange={() => {
                      const newRate = opt.value === "TENANT" && form.achRate > 6 ? 6 : form.achRate;
                      setForm({ ...form, achFeeResponsibility: opt.value, achRate: newRate });
                    }}
                    disabled={form.billMe}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            {form.achFeeResponsibility === "TENANT" && form.achRate > 6 && (
              <p className="text-xs text-amber-500 font-medium mt-1">ACH rate capped at $6 when tenant pays.</p>
            )}
            {form.billMe && <p className="text-xs text-muted-foreground mt-1 italic">Bill Me is on — ACH set to &ldquo;I Pay&rdquo;.</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Payout Fee Rate (%)</label>
            <div className="relative">
              <input
                type="number"
                min="0.15"
                max="0.50"
                step="0.01"
                value={parseFloat((form.payoutFeeRate * 100).toFixed(2))}
                onChange={(e) => setForm({ ...form, payoutFeeRate: parseFloat(e.target.value) / 100 })}
                disabled={form.billMe}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm max-w-[200px] disabled:opacity-50"
              />
              {form.billMe && (
                <span className="ml-3 text-xs text-muted-foreground italic">Covered by you</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Deducted from owner payout. Your cost: 0.15%. You keep the earnings.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Per-Unit Fee ($/unit)</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="3"
                step="0.25"
                value={form.unitFeeRate}
                onChange={(e) => setForm({ ...form, unitFeeRate: parseFloat(e.target.value) || 0 })}
                disabled={form.billMe}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm max-w-[200px] disabled:opacity-50"
              />
              {form.billMe && (
                <span className="ml-3 text-xs text-muted-foreground italic">Covered by you</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Monthly platform fee charged per unit to owner.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Payout Frequency</label>
            <select
              value={form.payoutFrequency}
              onChange={(e) => setForm({ ...form, payoutFrequency: e.target.value })}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm max-w-[200px]"
            >
              <option value="MONTHLY">Monthly</option>
              <option value="SEMI_MONTHLY">Twice Monthly</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">Semi-monthly: mid-month draw + end-of-month reconciliation.</p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Deduct Before Payout:</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.deductExpenses}
                onChange={(e) => setForm({ ...form, deductExpenses: e.target.checked })}
                className="rounded border-muted-foreground"
              />
              <div>
                <span className="text-sm font-medium">Property Expenses</span>
                <p className="text-xs text-muted-foreground">Maintenance, taxes, insurance, etc.</p>
              </div>
            </label>
            <p className="text-xs text-muted-foreground mt-2 p-2 rounded bg-muted/50">
              Payout fee ({parseFloat((form.payoutFeeRate * 100).toFixed(2))}%) is deducted from owner payouts. Your cost is 0.15% — you keep the earnings.
            </p>
          </div>

          {/* Bill Me Section */}
          <div className="rounded-lg border p-4 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.billMe}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setForm({ ...form, billMe: checked, ...(checked ? { achFeeResponsibility: "PM" as const } : {}) });
                }}
                className="rounded"
              />
              <div>
                <span className="text-sm font-medium">Bill Me — I&apos;ll cover all platform costs for this owner</span>
                <p className="text-xs text-muted-foreground">ACH fees, payout fees, and platform fees billed to your account.</p>
              </div>
            </label>
            {form.billMe && (
              <div className="ml-6 pl-3 border-l-2 border-muted space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.billMeIncludeManagement}
                    onChange={(e) => setForm({ ...form, billMeIncludeManagement: e.target.checked })}
                    className="rounded"
                  />
                  <div>
                    <span className="text-sm font-medium">Include Management Fee</span>
                    <p className="text-xs text-muted-foreground">
                      {form.billMeIncludeManagement
                        ? "Management fee still deducted"
                        : "Owner gets 100% minus real expenses (solo landlord mode)"}
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Property Assignment */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Assign Properties
          </h2>
          {unassignedProperties.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              All properties are already assigned to owners, or no properties exist yet.
            </p>
          ) : (
            <div className="space-y-2">
              {unassignedProperties.map((prop) => (
                <label
                  key={prop.id}
                  className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={form.propertyIds.includes(prop.id)}
                    onChange={() => toggleProperty(prop.id)}
                    className="rounded border-muted-foreground"
                  />
                  <div>
                    <span className="text-sm font-medium">{prop.name}</span>
                    <p className="text-xs text-muted-foreground">{prop.address}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Owner"}
          </button>
          <Link
            href="/dashboard/owners"
            className="rounded-lg border px-6 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

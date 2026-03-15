"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  UserCheck,
  Building2,
  Percent,
  DollarSign,
  Save,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";

interface OwnerDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  managementFeePercent: number;
  deductProcessingFees: boolean;
  deductExpenses: boolean;
  deductPlatformFee: boolean;
  achRate: number;
  payoutFeeRate: number;
  unitFeeRate: number;
  billMe: boolean;
  billMeIncludeManagement: boolean;
  payoutFrequency: string;
  feeScheduleId: string | null;
  bankName: string | null;
  bankAccountLast4: string | null;
  properties: { id: string; name: string; address: string; city: string; state: string }[];
  payouts: {
    id: string;
    periodStart: string;
    periodEnd: string;
    grossRent: number;
    netPayout: number;
    status: string;
    paidAt: string | null;
  }[];
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  APPROVED: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  PROCESSING: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  PAID: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  FAILED: "bg-red-500/10 text-red-600 dark:text-red-400",
};

export default function OwnerDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [owner, setOwner] = useState<OwnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feeSchedules, setFeeSchedules] = useState<{id: string; name: string; managementFeePercent: number; achRate: number; deductProcessingFees: boolean; deductExpenses: boolean; deductPlatformFee: boolean; payoutFeeRate: number; unitFeeRate: number; billMe: boolean; billMeIncludeManagement: boolean; payoutFrequency: string; achFeeResponsibility?: string; customFees?: unknown[]}[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    managementFeePercent: 0,
    achRate: 6,
    feeScheduleId: "",
    deductExpenses: true,
    payoutFeeRate: 0.0015,
    unitFeeRate: 0,
    billMe: false,
    billMeIncludeManagement: true,
    payoutFrequency: "MONTHLY",
    achFeeResponsibility: "OWNER" as "OWNER" | "TENANT" | "PM",
    customFees: [] as unknown[],
  });

  useEffect(() => {
    fetch(`/api/owners/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setOwner(data);
        setForm({
          name: data.name,
          email: data.email || "",
          phone: data.phone || "",
          managementFeePercent: data.managementFeePercent,
          achRate: data.achRate ?? 6,
          feeScheduleId: data.feeScheduleId || "",
          deductExpenses: data.deductExpenses,
          payoutFeeRate: data.payoutFeeRate ?? 0.0015,
          unitFeeRate: data.unitFeeRate ?? 0,
          billMe: data.billMe ?? false,
          billMeIncludeManagement: data.billMeIncludeManagement ?? true,
          payoutFrequency: data.payoutFrequency ?? "MONTHLY",
          achFeeResponsibility: (data.achFeeResponsibility ?? "OWNER") as "OWNER" | "TENANT" | "PM",
          customFees: data.customFees ?? [],
        });
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetch("/api/fee-schedules").then(r => r.json()).then(data => setFeeSchedules(data.schedules || []));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/owners/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success("Owner updated");
        router.refresh();
      } else {
        toast.error("Failed to update");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  }

  if (!owner) {
    return <div className="text-center py-12 text-muted-foreground">Owner not found</div>;
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/owners" className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{owner.name}</h1>
          <p className="text-sm text-muted-foreground">
            {owner.properties.length} properties &middot; {owner.payouts.length} payouts
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Edit Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Owner Details
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Percent className="h-4 w-4" />
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
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.deductExpenses} onChange={(e) => setForm({ ...form, deductExpenses: e.target.checked })} className="rounded" />
                <span className="text-sm">Deduct property expenses</span>
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

            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Properties */}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4" />
              Assigned Properties
            </h3>
            {owner.properties.length === 0 ? (
              <p className="text-xs text-muted-foreground">No properties assigned</p>
            ) : (
              <div className="space-y-2">
                {owner.properties.map((p) => (
                  <Link
                    key={p.id}
                    href={`/dashboard/properties/${p.id}`}
                    className="block rounded-lg border p-2.5 hover:bg-muted/50 transition-colors"
                  >
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.city}, {p.state}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Bank Info */}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3">
              <DollarSign className="h-4 w-4" />
              Bank Account
            </h3>
            {owner.bankAccountLast4 ? (
              <>
                <p className="text-sm">
                  {owner.bankName} &middot; ****{owner.bankAccountLast4}
                </p>
                <button
                  onClick={async () => {
                    if (!confirm("Remove this bank account?")) return;
                    const res = await fetch(`/api/owners/${id}/bank-account`, { method: "DELETE" });
                    if (res.ok) {
                      toast.success("Bank account removed");
                      setOwner((prev) => prev ? { ...prev, bankName: null, bankAccountLast4: null } : prev);
                    } else {
                      const d = await res.json();
                      toast.error(d.error || "Failed to remove");
                    }
                  }}
                  className="mt-2 text-xs text-destructive hover:underline"
                >
                  Remove Bank Account
                </button>
              </>
            ) : (
              <BankAccountForm
                ownerId={id as string}
                onSuccess={(bankName, last4) =>
                  setOwner((prev) => prev ? { ...prev, bankName, bankAccountLast4: last4 } : prev)
                }
              />
            )}
          </div>
        </div>
      </div>

      {/* Payout History */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            Payout History
          </h3>
        </div>
        {owner.payouts.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No payouts yet. Generate one from the Payouts page.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2 font-medium">Period</th>
                <th className="px-4 py-2 font-medium text-right">Gross Rent</th>
                <th className="px-4 py-2 font-medium text-right">Net Payout</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {owner.payouts.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <Link href={`/dashboard/payouts/${p.id}`} className="hover:underline font-medium">
                      {formatDate(p.periodStart)}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right">${p.grossRent.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                    ${p.netPayout.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColors[p.status] || ""}`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ── Inline Bank Account Form ── */

function BankAccountForm({
  ownerId,
  onSuccess,
}: {
  ownerId: string;
  onSuccess: (bankName: string, last4: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [bankName, setBankName] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState<"checking" | "savings">("checking");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/owners/${ownerId}/bank-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankName, routingNumber, accountNumber, accountType }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Bank account added");
        onSuccess(data.bankName, data.bankAccountLast4);
      } else {
        toast.error(data.error || "Failed to add bank account");
      }
    } catch {
      toast.error("Failed to add bank account");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs text-muted-foreground mb-2">
        Add a bank account to enable ACH payouts.
      </p>
      <div>
        <label className="block text-xs font-medium mb-1">Bank Name</label>
        <input
          type="text"
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          required
          placeholder="Chase, Wells Fargo, etc."
          className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Routing Number</label>
        <input
          type="text"
          value={routingNumber}
          onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
          required
          pattern="\d{9}"
          placeholder="9 digits"
          className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Account Number</label>
        <input
          type="text"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
          required
          placeholder="Account number"
          className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Account Type</label>
        <select
          value={accountType}
          onChange={(e) => setAccountType(e.target.value as "checking" | "savings")}
          className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm"
        >
          <option value="checking">Checking</option>
          <option value="savings">Savings</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        <DollarSign className="h-3.5 w-3.5" />
        {submitting ? "Adding..." : "Add Bank Account"}
      </button>
    </form>
  );
}

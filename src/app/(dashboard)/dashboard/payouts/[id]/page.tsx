"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Receipt,
  DollarSign,
  Minus,
  Plus,
  Equal,
  CreditCard,
  Building2,
  CheckCircle2,
  XCircle,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { showPrompt, showConfirm } from "@/components/admin/dialog-prompt";

interface PayoutDetail {
  id: string;
  ownerId: string;
  periodStart: string;
  periodEnd: string;
  grossRent: number;
  processingFees: number;
  managementFee: number;
  expenses: number;
  platformFee: number;
  netPayout: number;
  achRate: number;
  payoutFee: number;
  payoutFeeRate: number | null;
  unitFee: number;
  achCount: number;
  status: string;
  paymentMethod: string | null;
  paidAt: string | null;
  notes: string | null;
  ownerHasBank?: boolean;
  owner: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    managementFeePercent: number;
    properties: { id: string; name: string }[];
  };
  paymentDetails: {
    id: string;
    amount: number;
    paymentMethod: string;
    paidAt: string;
    tenant: string;
    unit: string;
    property: string;
  }[];
  expenseDetails: {
    id: string;
    amount: number;
    category: string;
    description: string;
    vendor: string | null;
    date: string;
    property: string;
  }[];
}

const statusConfig: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
  DRAFT: { color: "bg-gray-500/10 text-gray-600 dark:text-gray-400", icon: Receipt },
  APPROVED: { color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", icon: CheckCircle2 },
  PROCESSING: { color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400", icon: CreditCard },
  PAID: { color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
  FAILED: { color: "bg-red-500/10 text-red-600 dark:text-red-400", icon: XCircle },
};

export default function PayoutDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [payout, setPayout] = useState<PayoutDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable draft fields
  const [draftMgmtPercent, setDraftMgmtPercent] = useState(0);
  const [draftAchRate, setDraftAchRate] = useState(0);
  const [draftExpenses, setDraftExpenses] = useState(0);
  const [draftPlatformFee, setDraftPlatformFee] = useState(0);
  const [draftPayoutFeeRate, setDraftPayoutFeeRate] = useState(0.15);

  useEffect(() => {
    fetch(`/api/payouts/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch payout");
        return r.json();
      })
      .then((data: PayoutDetail) => {
        setPayout(data);
        // Initialize draft editable fields from loaded payout
        setDraftMgmtPercent(data.owner.managementFeePercent);
        setDraftAchRate(data.achRate ?? 0);
        setDraftExpenses(data.expenses);
        setDraftPlatformFee(data.platformFee);
        setDraftPayoutFeeRate(data.payoutFeeRate ?? 0.15);
      })
      .catch(() => setPayout(null))
      .finally(() => setLoading(false));
  }, [id]);

  // Computed draft values
  const computeDraft = useCallback(() => {
    if (!payout) return { mgmtFee: 0, processingFees: 0, payoutFee: 0, unitFee: 0, netPayout: 0 };
    const grossRent = payout.grossRent;
    const mgmtFee = Math.round(grossRent * (draftMgmtPercent / 100) * 100) / 100;
    const achCount = payout.achCount ?? 0;
    const processingFees = Math.round(achCount * draftAchRate * 100) / 100;
    const payoutFee = Math.round(grossRent * (draftPayoutFeeRate / 100) * 100) / 100;
    const unitFee = payout.unitFee ?? 0;
    const netPayout = Math.round((grossRent - processingFees - mgmtFee - draftExpenses - draftPlatformFee - payoutFee - unitFee) * 100) / 100;
    return { mgmtFee, processingFees, payoutFee: payoutFee > 0 ? payoutFee : 0, unitFee, netPayout };
  }, [payout, draftMgmtPercent, draftAchRate, draftExpenses, draftPlatformFee, draftPayoutFeeRate]);

  const draft = computeDraft();

  async function handleSaveDraft() {
    if (!payout) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/payouts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          managementFeePercent: draftMgmtPercent,
          managementFee: draft.mgmtFee,
          achRate: draftAchRate,
          processingFees: draft.processingFees,
          expenses: draftExpenses,
          platformFee: draftPlatformFee,
          payoutFee: draft.payoutFee,
          payoutFeeRate: draftPayoutFeeRate,
          netPayout: draft.netPayout,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPayout((prev) => (prev ? { ...prev, ...updated } : prev));
        toast.success("Draft saved");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save draft");
      }
    } catch {
      toast.error("Failed to save draft");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    const res = await fetch(`/api/payouts/${id}/approve`, { method: "POST" });
    if (res.ok) {
      toast.success("Payout approved");
      const data = await res.json();
      setPayout((prev) => prev ? { ...prev, status: data.status } : prev);
    } else {
      const data = await res.json();
      toast.error(data.error);
    }
  }

  async function handleMarkPaid() {
    const method = await showPrompt({
      title: "Mark Payout as Paid",
      description: "Record the payment method used to send this payout.",
      label: "Payment method",
      placeholder: "manual, check, wire, or ach",
      defaultValue: "manual",
      instructions: "Enter one of: manual, check, wire, ach",
      submitLabel: "Mark Paid",
    });
    if (!method) return;
    const res = await fetch(`/api/payouts/${id}/mark-paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentMethod: method }),
    });
    if (res.ok) {
      toast.success("Payout marked as paid");
      const data = await res.json();
      setPayout((prev) => prev ? { ...prev, status: data.status, paidAt: data.paidAt, paymentMethod: data.paymentMethod } : prev);
    } else {
      const data = await res.json();
      toast.error(data.error);
    }
  }

  async function handleDelete() {
    if (!await showConfirm({ title: "Delete Draft Payout?", description: "This will permanently remove this draft. If you want to cancel an already-issued payout, use the Cancel option instead.", confirmLabel: "Delete Draft", destructive: true })) return;
    const res = await fetch(`/api/payouts/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Payout deleted");
      router.push("/dashboard/payouts");
    } else {
      const data = await res.json();
      toast.error(data.error);
    }
  }

  async function handleProcessAch() {
    if (!await showConfirm({ title: "Process Payout via ACH?", description: "This will initiate an ACH credit to the owner's bank account on file. The payout status will change to PROCESSING.", confirmLabel: "Process ACH Payout" })) return;
    try {
      const res = await fetch(`/api/payouts/${id}/process`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success("ACH payout initiated — status is now PROCESSING");
        setPayout((prev) => prev ? { ...prev, status: data.status, paymentMethod: data.paymentMethod } : prev);
      } else {
        toast.error(data.error || "Failed to process ACH payout");
      }
    } catch {
      toast.error("Failed to process ACH payout");
    }
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  if (!payout) return <div className="text-center py-12 text-muted-foreground">Payout not found</div>;

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // Semi-monthly period label
  const periodStart = new Date(payout.periodStart);
  const periodEnd = new Date(payout.periodEnd);
  const periodMonthYear = periodStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const periodLabel = (() => {
    if (periodStart.getDate() === 1 && periodEnd.getDate() <= 15) {
      return `${periodMonthYear} (1st–15th)`;
    }
    if (periodStart.getDate() >= 16) {
      return `${periodMonthYear} (16th–${periodEnd.getDate()}th)`;
    }
    return periodMonthYear;
  })();
  const sc = statusConfig[payout.status] || statusConfig.DRAFT;

  const isDraft = payout.status === "DRAFT";
  const achCount = payout.achCount ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/payouts" className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            Payout: {payout.owner.name}
          </h1>
          <p className="text-sm text-muted-foreground">{periodLabel}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${sc.color}`}>
          <sc.icon className="h-3.5 w-3.5" />
          {payout.status}
        </span>
      </div>

      {/* Summary Hero — Section A of the PDF. Three numbers, no editing.
          Appears above the detailed breakdown so the owner sees the punch
          line first, then scrolls for the math. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Total Rent Collected
          </p>
          <p className="mt-1 text-2xl font-bold">
            ${fmt(isDraft ? payout.grossRent : payout.grossRent)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Total Fees &amp; Expenses
          </p>
          <p className="mt-1 text-2xl font-bold text-orange-500">
            -$
            {fmt(
              isDraft
                ? draft.mgmtFee +
                    draft.processingFees +
                    draftExpenses +
                    (payout.platformFee ?? 0) +
                    (payout.unitFee ?? 0) -
                    (payout.payoutFee ?? 0)
                : (payout.managementFee ?? 0) +
                    (payout.processingFees ?? 0) +
                    (payout.expenses ?? 0) +
                    (payout.platformFee ?? 0) +
                    (payout.unitFee ?? 0) -
                    (payout.payoutFee ?? 0)
            )}
          </p>
        </div>
        <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 p-5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Net Owner Distribution
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            ${fmt(isDraft ? draft.netPayout : payout.netPayout)}
          </p>
        </div>
      </div>

      {/* Fee Breakdown Card */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Payout Breakdown
        </h2>

        {isDraft ? (
          /* ── DRAFT: Editable breakdown ── */
          <div className="space-y-4 text-sm">
            {/* Gross Rent (read-only) */}
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                Gross Rent Collected
              </span>
              <span className="font-semibold text-foreground">${fmt(payout.grossRent)}</span>
            </div>
            <div className="h-px bg-border" />

            {/* Management Fee % — editable */}
            <div className="flex justify-between items-center gap-4">
              <span className="flex items-center gap-2 text-muted-foreground shrink-0">
                <Minus className="h-4 w-4 text-orange-500" />
                Management Fee
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={draftMgmtPercent}
                  onChange={(e) => setDraftMgmtPercent(parseFloat(e.target.value) || 0)}
                  className="w-20 rounded-md border bg-background px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-muted-foreground">%</span>
                <span className="text-orange-500 font-medium ml-2">-${fmt(draft.mgmtFee)}</span>
              </div>
            </div>

            {/* ACH Rate — editable */}
            <div className="flex justify-between items-center gap-4">
              <span className="flex items-center gap-2 text-muted-foreground shrink-0">
                <Minus className="h-4 w-4 text-orange-500" />
                Payment Processing Expense
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Rate $</span>
                <input
                  type="number"
                  min={0}
                  step={0.25}
                  value={draftAchRate}
                  onChange={(e) => setDraftAchRate(parseFloat(e.target.value) || 0)}
                  className="w-20 rounded-md border bg-background px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">Your ACH Cost: $2.00</span>
              </div>
            </div>
            <div className="flex justify-end items-center text-xs text-muted-foreground pr-0">
              {achCount} payments &times; ${fmt(draftAchRate)} = <span className="text-orange-500 font-medium ml-1">-${fmt(draft.processingFees)}</span>
            </div>

            {/* Expenses — editable */}
            <div className="flex justify-between items-center gap-4">
              <span className="flex items-center gap-2 text-muted-foreground shrink-0">
                <Minus className="h-4 w-4 text-orange-500" />
                Property Expenses
              </span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={draftExpenses}
                  onChange={(e) => setDraftExpenses(parseFloat(e.target.value) || 0)}
                  className="w-28 rounded-md border bg-background px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Platform Fee — editable */}
            <div className="flex justify-between items-center gap-4">
              <span className="flex items-center gap-2 text-muted-foreground shrink-0">
                <Minus className="h-4 w-4 text-orange-500" />
                Platform Fee (pro-rated)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={draftPlatformFee}
                  onChange={(e) => setDraftPlatformFee(parseFloat(e.target.value) || 0)}
                  className="w-28 rounded-md border bg-background px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Payout Fee Rate — editable */}
            <div className="flex justify-between items-center gap-4">
              <span className="flex items-center gap-2 text-muted-foreground shrink-0">
                <Plus className="h-4 w-4 text-emerald-500" />
                Payout Fee
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0.15}
                  max={0.50}
                  step={0.01}
                  value={draftPayoutFeeRate}
                  onChange={(e) => setDraftPayoutFeeRate(parseFloat(e.target.value) || 0)}
                  className="w-20 rounded-md border bg-background px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-muted-foreground">%</span>
                <span className="text-emerald-500 font-medium ml-2">+${fmt(draft.payoutFee)}</span>
              </div>
            </div>

            {/* Unit Fee — read-only (server-calculated) */}
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Minus className="h-4 w-4 text-orange-500" />
                Per-Unit Fee
              </span>
              <span className="text-orange-500">-${fmt(draft.unitFee)}</span>
            </div>

            <div className="h-px bg-border" />

            {/* Net Payout — auto-calculated */}
            <div className="flex justify-between items-center pt-1">
              <span className="flex items-center gap-2 font-semibold">
                <Equal className="h-4 w-4 text-emerald-500" />
                Net Payout
              </span>
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                ${fmt(draft.netPayout)}
              </span>
            </div>
          </div>
        ) : (
          /* ── NON-DRAFT: Read-only breakdown (original) ── */
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                Gross Rent Collected
              </span>
              <span className="font-semibold text-foreground">${fmt(payout.grossRent)}</span>
            </div>
            <div className="h-px bg-border" />
            {payout.processingFees > 0 && (
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Minus className="h-4 w-4 text-orange-500" />
                  Payment Processing Expense
                </span>
                <span className="text-orange-500">-${fmt(payout.processingFees)}</span>
              </div>
            )}
            {payout.managementFee > 0 && (
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Minus className="h-4 w-4 text-orange-500" />
                  Management Fee ({payout.owner.managementFeePercent}%)
                </span>
                <span className="text-orange-500">-${fmt(payout.managementFee)}</span>
              </div>
            )}
            {payout.expenses > 0 && (
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Minus className="h-4 w-4 text-orange-500" />
                  Property Expenses
                </span>
                <span className="text-orange-500">-${fmt(payout.expenses)}</span>
              </div>
            )}
            {payout.platformFee > 0 && (
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Minus className="h-4 w-4 text-orange-500" />
                  Platform Fee (pro-rated)
                </span>
                <span className="text-orange-500">-${fmt(payout.platformFee)}</span>
              </div>
            )}
            {(payout.payoutFee ?? 0) > 0 && (
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Plus className="h-4 w-4 text-emerald-500" />
                  Payout Fee ({payout.payoutFeeRate != null ? (payout.payoutFeeRate * 100).toFixed(2) : "0.15"}%)
                </span>
                <span className="text-emerald-500">+${fmt(payout.payoutFee)}</span>
              </div>
            )}
            {(payout.unitFee ?? 0) > 0 && (
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Minus className="h-4 w-4 text-orange-500" />
                  Per-Unit Fee
                </span>
                <span className="text-orange-500">-${fmt(payout.unitFee)}</span>
              </div>
            )}
            <div className="h-px bg-border" />
            <div className="flex justify-between items-center pt-1">
              <span className="flex items-center gap-2 font-semibold">
                <Equal className="h-4 w-4 text-emerald-500" />
                Net Payout
              </span>
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                ${fmt(payout.netPayout)}
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex gap-3 flex-wrap">
          {isDraft && (
            <>
              <button
                onClick={handleSaveDraft}
                disabled={saving}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save Draft"}
              </button>
              <button onClick={handleApprove} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Approve Payout
              </button>
              <button onClick={handleDelete} className="rounded-lg border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10">
                Delete Draft
              </button>
            </>
          )}
          {payout.status === "APPROVED" && (
            <>
              {payout.ownerHasBank && (
                <button onClick={handleProcessAch} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  Process via ACH
                </button>
              )}
              <button onClick={handleMarkPaid} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                Mark as Paid
              </button>
            </>
          )}
          {payout.status === "PROCESSING" && (
            <p className="text-sm text-yellow-600 dark:text-yellow-400 self-center font-medium">
              ACH payout is being processed...
            </p>
          )}
          {payout.paidAt && (
            <p className="text-xs text-muted-foreground self-center">
              Paid {fmtDate(payout.paidAt)} via {payout.paymentMethod}
            </p>
          )}
        </div>
      </div>

      {/* Payment Details */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Payments Included ({payout.paymentDetails.length})
          </h3>
        </div>
        {payout.paymentDetails.length === 0 ? (
          <div className="px-5 py-6 text-center text-sm text-muted-foreground">
            No payments in this period.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Tenant</th>
                <th className="px-4 py-2 font-medium">Property / Unit</th>
                <th className="px-4 py-2 font-medium">Method</th>
                <th className="px-4 py-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payout.paymentDetails.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{p.paidAt ? fmtDate(p.paidAt) : "—"}</td>
                  <td className="px-4 py-2 font-medium">{p.tenant}</td>
                  <td className="px-4 py-2 text-muted-foreground">{p.property} / {p.unit}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase">
                      {p.paymentMethod}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-medium">${fmt(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Expense Details */}
      {payout.expenseDetails.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Expenses Deducted ({payout.expenseDetails.length})
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium">Property</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payout.expenseDetails.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{fmtDate(e.date)}</td>
                  <td className="px-4 py-2 font-medium">{e.description}</td>
                  <td className="px-4 py-2 text-muted-foreground">{e.property}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                      {e.category.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-orange-500">-${fmt(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

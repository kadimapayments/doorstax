"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  HandCoins,
  FileCheck,
  Loader2,
  CheckCircle2,
  Copy,
  DollarSign,
  Receipt,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export interface OfflinePaymentTenantOption {
  tenantId: string;
  unitId: string;
  name: string;
  email: string | null;
  unitNumber: string;
  propertyName: string;
  rentAmount: number;
}

interface RecordOfflinePaymentFormProps {
  tenants: OfflinePaymentTenantOption[];
}

// ─── Helper types (mirrored from charge-tenant-form.tsx) ───
// The /api/payments/charge route returns these shapes; we duplicate
// the interfaces locally instead of importing from the charge form
// to keep this component independently usable.
interface OutstandingCharge {
  id: string;
  amount: number;
  type: "RENT" | "DEPOSIT" | "FEE" | "APPLICATION";
  status: "PENDING" | "FAILED";
  description: string | null;
  dueDate: string;
  createdAt: string;
}

interface ActiveRecoveryPlan {
  id: string;
  status: "PLAN_OFFERED" | "PLAN_ACTIVE" | "PLAN_AT_RISK";
  requiredPayments: number;
  completedPayments: number;
}

interface ChargeResult {
  success: boolean;
  paymentId?: string;
  receiptNumber?: string;
  charged?: boolean;
  recovery?: {
    applied: boolean;
    plan?: { completedPayments: number; requiredPayments: number };
    reason?: string;
  };
  partialSettle?: {
    paidAmount: number;
    originalAmount: number;
    remainderAmount: number;
    remainderChargeId: string | null;
  };
  autoAllocated?: boolean;
  allocations?: Array<{
    chargeId: string;
    paymentId: string;
    receiptNumber: string;
    amount: number;
    originalAmount: number;
    partial: boolean;
    description: string | null;
  }>;
  remainderChargeId?: string | null;
  error?: string;
}

/**
 * PM-facing form to record a cash or check receipt — now with full
 * settle support. On tenant select we pull outstanding charges and
 * any active recovery plan so the PM can:
 *
 *   • Settle a specific PENDING charge in place (closes the original
 *     row instead of creating a duplicate).
 *   • Partial-settle when the cash/check covers less than the
 *     outstanding amount — original shrinks to the paid portion,
 *     remainder spawns as a new PENDING row.
 *   • Auto-allocate across multiple outstanding charges when the
 *     payment covers more than one (oldest-first walk).
 *   • Apply to active recovery plan when the tenant has one and
 *     the payment is RENT-typed.
 *
 * Submits to `/api/payments/charge` with paymentMethod=cash|check —
 * the same endpoint the full charge form uses, so all the settle /
 * partial / multi-charge logic lives in one place. The form stays
 * cash/check-only by hiding the method picker; the route's hard
 * blocks (acceptsCash / acceptsChecks on the owner) still apply.
 */
export function RecordOfflinePaymentForm({
  tenants,
}: RecordOfflinePaymentFormProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "check">("cash");
  const [checkNumber, setCheckNumber] = useState("");
  const [dateReceived, setDateReceived] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{
    receiptNumber: string;
    paymentId: string;
    summary?: string;
  } | null>(null);

  // ── Settle / auto-allocate state ──
  // Same shape as the charge form — outstanding charges fetched on
  // tenant select; appliesToChargeId is mutually exclusive with
  // autoAllocate.
  const [outstandingCharges, setOutstandingCharges] = useState<
    OutstandingCharge[]
  >([]);
  const [appliesToChargeId, setAppliesToChargeId] = useState<string | null>(
    null
  );
  const [autoAllocate, setAutoAllocate] = useState(false);

  // ── Recovery plan state ──
  const [activePlan, setActivePlan] = useState<ActiveRecoveryPlan | null>(null);
  const [applyToPlan, setApplyToPlan] = useState(false);

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((t) =>
      [t.name, t.email, t.unitNumber, t.propertyName]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
    );
  }, [search, tenants]);

  const selectedTenant = tenants.find((t) => t.tenantId === tenantId);
  const selectedCharge = outstandingCharges.find(
    (c) => c.id === appliesToChargeId
  );

  // ─── Fetch outstanding charges + active recovery plan on tenant select ───
  // Mirrors the charge form's fetch pattern — runs in parallel so the
  // settle UI + recovery checkbox land at the same time.
  useEffect(() => {
    if (!tenantId) {
      setOutstandingCharges([]);
      setActivePlan(null);
      setAppliesToChargeId(null);
      setAutoAllocate(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [chargesRes, recoveryRes] = await Promise.all([
          fetch(`/api/tenants/${tenantId}/outstanding-charges`).then((r) =>
            r.ok ? r.json() : { charges: [] }
          ),
          fetch(`/api/tenants/${tenantId}/active-recovery-plan`).then((r) =>
            r.ok ? r.json() : { plan: null }
          ),
        ]);
        if (cancelled) return;
        setOutstandingCharges(chargesRes.charges || []);
        setActivePlan(recoveryRes.plan || null);
      } catch {
        // Best-effort — failure leaves the cards collapsed but doesn't
        // block the form from working as a vanilla offline-record path.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  // When PM picks a specific charge, lock amount to it and turn off
  // auto-allocate. (Same UX rule the charge form uses.)
  useEffect(() => {
    if (selectedCharge) {
      setAmount(selectedCharge.amount.toFixed(2));
      setAutoAllocate(false);
    }
  }, [selectedCharge]);

  // Compute the auto-allocate preview client-side — mirrors the
  // server's oldest-first walk so the PM sees exactly what will
  // happen on submit.
  const allocationPreview = (() => {
    if (!autoAllocate || appliesToChargeId) return null;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return null;
    if (outstandingCharges.length === 0) return null;
    const sorted = [...outstandingCharges].sort((a, b) => {
      const da = new Date(a.dueDate).getTime();
      const dbb = new Date(b.dueDate).getTime();
      if (da !== dbb) return da - dbb;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    const total = sorted.reduce((s, c) => s + c.amount, 0);
    if (amt > total + 0.005) {
      return { overflow: true, total, allocations: [] as PreviewAlloc[] };
    }
    let remaining = amt;
    const allocations: PreviewAlloc[] = [];
    for (const c of sorted) {
      if (remaining <= 0.005) break;
      if (remaining >= c.amount - 0.005) {
        allocations.push({
          id: c.id,
          description: c.description?.trim() || c.type,
          amount: c.amount,
          original: c.amount,
          partial: false,
        });
        remaining = Math.round((remaining - c.amount) * 100) / 100;
      } else {
        allocations.push({
          id: c.id,
          description: c.description?.trim() || c.type,
          amount: remaining,
          original: c.amount,
          partial: true,
        });
        remaining = 0;
      }
    }
    return { overflow: false, total, allocations };
  })();

  function reset() {
    setSearch("");
    setTenantId("");
    setAmount("");
    setMethod("cash");
    setCheckNumber("");
    setDateReceived(new Date().toISOString().split("T")[0]);
    setNotes("");
    setSuccess(null);
    setOutstandingCharges([]);
    setAppliesToChargeId(null);
    setAutoAllocate(false);
    setActivePlan(null);
    setApplyToPlan(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) {
      toast.error("Pick a tenant first");
      return;
    }
    if (!selectedTenant?.unitId) {
      toast.error("Tenant has no unit assignment");
      return;
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error("Enter a positive amount");
      return;
    }
    if (selectedCharge && amt > selectedCharge.amount + 0.005) {
      toast.error(
        `Amount exceeds outstanding charge of $${selectedCharge.amount.toFixed(2)}. Clear the selection or use auto-allocate.`
      );
      return;
    }
    if (method === "check" && !checkNumber.trim()) {
      toast.error("Enter the check number");
      return;
    }

    setSubmitting(true);
    try {
      // Default to RENT-typed when settling a charge that's RENT, or
      // when a recovery plan is being applied to. Otherwise FEE — the
      // server reuses existing.type during settle so the wire value
      // matters less, but for new (non-settle) cash/check receipts
      // RENT is the safer default.
      const inferredType = selectedCharge
        ? selectedCharge.type === "RENT" ||
          selectedCharge.type === "DEPOSIT" ||
          selectedCharge.type === "FEE"
          ? selectedCharge.type
          : "FEE"
        : "RENT";

      const res = await fetch("/api/payments/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          unitId: selectedTenant.unitId,
          amount: amt,
          type: inferredType,
          paymentMethod: method,
          source: "offline",
          description: notes.trim() || undefined,
          notes: notes.trim() || undefined,
          dateReceived: new Date(dateReceived).toISOString(),
          ...(method === "check" && { checkNumber: checkNumber.trim() }),
          ...(applyToPlan && { applyToRecoveryPlan: true }),
          ...(appliesToChargeId && { appliesToPaymentId: appliesToChargeId }),
          ...(autoAllocate && !appliesToChargeId && { autoAllocate: true }),
        }),
      });

      const body: ChargeResult = await res.json().catch(() => ({} as ChargeResult));

      if (!res.ok) {
        toast.error(body.error || "Failed to record payment");
        return;
      }

      // ── Compose the success summary based on which path the server
      // took. Same priority order as the charge form: multi-allocate
      // > settle > vanilla.
      let receiptNumber = body.receiptNumber || "";
      let summary: string | undefined;

      if (body.autoAllocated && body.allocations && body.charged) {
        const fullCount = body.allocations.filter((a) => !a.partial).length;
        const partialCount = body.allocations.filter((a) => a.partial).length;
        receiptNumber = body.allocations[0]?.receiptNumber || receiptNumber;
        summary =
          `Allocated across ${body.allocations.length} charge${body.allocations.length === 1 ? "" : "s"} — ` +
          `${fullCount} settled in full${partialCount > 0 ? ` + ${partialCount} partial` : ""}\n` +
          body.allocations
            .map(
              (a) =>
                `  • ${a.description?.trim() || "charge"}: $${a.amount.toFixed(2)}${a.partial ? ` (partial of $${a.originalAmount.toFixed(2)})` : ""}`
            )
            .join("\n");
        toast.success(summary, { duration: 8000 });
      } else if (appliesToChargeId && body.charged) {
        toast.success(`Outstanding charge settled — receipt ${receiptNumber}`);
      } else {
        toast.success(`Payment recorded — receipt ${receiptNumber}`);
      }

      // Partial-settle additive toast (single-charge partial path).
      if (body.partialSettle) {
        const ps = body.partialSettle;
        toast.message(
          `Partial settle — paid $${ps.paidAmount.toFixed(2)} of $${ps.originalAmount.toFixed(2)}`,
          {
            description: `$${ps.remainderAmount.toFixed(2)} remains as a new outstanding charge.`,
            duration: 7000,
          }
        );
      }

      // Recovery toast (additive).
      if (body.recovery) {
        if (body.recovery.applied && body.recovery.plan) {
          const { completedPayments, requiredPayments } = body.recovery.plan;
          toast.success(
            `Applied to recovery plan — ${completedPayments}/${requiredPayments} on-time payments`,
            { duration: 5000 }
          );
        } else if (applyToPlan && !body.recovery.applied) {
          toast.warning(
            `Recovery plan not credited: ${body.recovery.reason ?? "period mismatch"}`,
            { duration: 6000 }
          );
        }
      }

      setSuccess({
        receiptNumber,
        paymentId: body.paymentId || "",
        summary,
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-semibold">Payment recorded</h3>
          </div>

          <div className="rounded-lg border bg-background p-4 space-y-2">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              Receipt number
            </div>
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              <span className="font-mono text-lg font-semibold">
                {success.receiptNumber}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(success.receiptNumber);
                  toast.success("Copied");
                }}
                className="ml-auto rounded-md border px-2 py-1 text-xs hover:bg-muted inline-flex items-center gap-1"
              >
                <Copy className="h-3 w-3" />
                Copy
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Hand this to the tenant — it&apos;s the audit-of-record for the
              cash/check. The tenant ledger has already been credited.
            </p>
            {success.summary && (
              <pre className="mt-2 whitespace-pre-wrap text-[11px] text-muted-foreground">
                {success.summary}
              </pre>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={reset}>Record another</Button>
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/tenants")}
            >
              Back to tenants
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Tenant picker */}
      <div className="space-y-2">
        <Label>Tenant</Label>
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by tenant name, email, unit, or property…"
          disabled={submitting}
        />
        <div className="max-h-48 overflow-y-auto rounded-lg border divide-y">
          {filteredTenants.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4 text-center">
              {tenants.length === 0
                ? "No tenants on file."
                : "No tenants match that search."}
            </p>
          ) : (
            filteredTenants.slice(0, 50).map((t) => (
              <button
                key={t.tenantId}
                type="button"
                onClick={() => setTenantId(t.tenantId)}
                className={
                  "w-full text-left p-3 text-sm hover:bg-muted/50 transition-colors " +
                  (tenantId === t.tenantId
                    ? "bg-primary/5 border-l-2 border-primary"
                    : "")
                }
              >
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground">
                  {t.propertyName} — Unit {t.unitNumber}
                  {t.email ? ` · ${t.email}` : ""}
                </div>
              </button>
            ))
          )}
        </div>
        {selectedTenant && (
          <p className="text-xs text-muted-foreground">
            Monthly rent on file: ${selectedTenant.rentAmount.toLocaleString()}
          </p>
        )}
      </div>

      {/* ── Outstanding charges card ── */}
      {tenantId && outstandingCharges.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold">Outstanding charges</span>
              <span className="text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-amber-500/10 text-amber-700 border border-amber-500/20">
                {outstandingCharges.length} open
              </span>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              Total $
              {outstandingCharges
                .reduce((s, c) => s + c.amount, 0)
                .toFixed(2)}
            </span>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Pick one to settle it directly, or check &ldquo;auto-allocate&rdquo;
            below to spread one cash/check across multiple charges.
          </p>

          <div className="space-y-1.5">
            {outstandingCharges.map((c) => (
              <label
                key={c.id}
                className={`flex items-center gap-3 rounded-md border p-2 cursor-pointer transition-colors ${
                  appliesToChargeId === c.id
                    ? "border-amber-600 bg-amber-500/10"
                    : "border-border hover:bg-muted/30"
                }`}
              >
                <input
                  type="radio"
                  name="appliesToCharge"
                  checked={appliesToChargeId === c.id}
                  onChange={() => setAppliesToChargeId(c.id)}
                  disabled={submitting}
                />
                <div className="flex-1 text-xs">
                  <div className="font-medium">
                    {c.description?.trim() || c.type}
                  </div>
                  <div className="text-muted-foreground">
                    Due {new Date(c.dueDate).toLocaleDateString()} ·{" "}
                    {c.type}
                    {c.status === "FAILED" ? " · ⚠ Previous attempt failed" : ""}
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  ${c.amount.toFixed(2)}
                </span>
              </label>
            ))}
          </div>

          {appliesToChargeId && (
            <button
              type="button"
              onClick={() => setAppliesToChargeId(null)}
              disabled={submitting}
              className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Clear selection (record as a new charge instead)
            </button>
          )}

          {/* ── Auto-allocate toggle ── */}
          {!appliesToChargeId && outstandingCharges.length > 1 && (
            <div className="rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoAllocate}
                  onChange={(e) => setAutoAllocate(e.target.checked)}
                  disabled={submitting}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    Auto-allocate across outstanding charges
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Walks the list oldest-first, settling each charge in full
                    until the amount runs out (the last one may partial-settle).
                  </p>
                </div>
              </label>

              {autoAllocate && allocationPreview && (
                <div className="rounded-md bg-background/60 border border-border p-2 text-xs space-y-1">
                  {allocationPreview.overflow ? (
                    <p className="text-red-600 dark:text-red-400">
                      Amount ${Number(amount || 0).toFixed(2)} exceeds total
                      outstanding ${allocationPreview.total.toFixed(2)}.
                      Lower the amount or clear auto-allocate.
                    </p>
                  ) : (
                    <>
                      <p className="font-medium">
                        Will settle {allocationPreview.allocations.length}{" "}
                        charge
                        {allocationPreview.allocations.length === 1 ? "" : "s"}:
                      </p>
                      <ul className="space-y-0.5 pl-3 list-disc text-muted-foreground">
                        {allocationPreview.allocations.map((a) => (
                          <li key={a.id} className="tabular-nums">
                            {a.description}: ${a.amount.toFixed(2)}
                            {a.partial && (
                              <span className="text-amber-600 dark:text-amber-400">
                                {" "}
                                (partial of ${a.original.toFixed(2)} —
                                ${(a.original - a.amount).toFixed(2)} will
                                remain)
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Recovery plan toggle ── */}
      {tenantId && activePlan && (
        <label className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={applyToPlan}
            onChange={(e) => setApplyToPlan(e.target.checked)}
            disabled={submitting}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              Apply this payment to the recovery plan
            </div>
            <p className="text-[11px] text-muted-foreground">
              Counts toward the {activePlan.requiredPayments}-payment
              requirement (currently {activePlan.completedPayments}/
              {activePlan.requiredPayments}). Only applies if the period
              matches the plan&apos;s required months.
            </p>
          </div>
        </label>
      )}

      {/* Method */}
      <div className="space-y-2">
        <Label>Method</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMethod("cash")}
            disabled={submitting}
            className={
              "rounded-lg border p-4 text-sm flex items-center gap-2 transition-colors " +
              (method === "cash"
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "hover:bg-muted/50")
            }
          >
            <HandCoins className="h-4 w-4 text-emerald-600" />
            <span className="font-medium">Cash</span>
          </button>
          <button
            type="button"
            onClick={() => setMethod("check")}
            disabled={submitting}
            className={
              "rounded-lg border p-4 text-sm flex items-center gap-2 transition-colors " +
              (method === "check"
                ? "border-slate-500/40 bg-slate-500/10"
                : "hover:bg-muted/50")
            }
          >
            <FileCheck className="h-4 w-4 text-slate-500" />
            <span className="font-medium">Check</span>
          </button>
        </div>
      </div>

      {/* Amount + date */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="amount">
            Amount
            {selectedCharge && (
              <span className="ml-1 text-[10px] text-muted-foreground">
                (max ${selectedCharge.amount.toFixed(2)} — enter less to partial-pay)
              </span>
            )}
          </Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              max={selectedCharge ? selectedCharge.amount.toFixed(2) : undefined}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="pl-9"
              disabled={submitting}
              required
            />
          </div>
          {/* Inline partial-pay hint when below the selected charge amount */}
          {selectedCharge &&
            Number(amount) > 0 &&
            Number(amount) < selectedCharge.amount - 0.005 && (
              <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                Partial: ${(selectedCharge.amount - Number(amount)).toFixed(2)}{" "}
                will stay as a new outstanding charge.
              </p>
            )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="dateReceived">Date received</Label>
          <Input
            id="dateReceived"
            type="date"
            value={dateReceived}
            onChange={(e) => setDateReceived(e.target.value)}
            disabled={submitting}
            required
          />
        </div>
      </div>

      {/* Check number — only when method=check */}
      {method === "check" && (
        <div className="space-y-2">
          <Label htmlFor="checkNumber">Check number</Label>
          <Input
            id="checkNumber"
            type="text"
            value={checkNumber}
            onChange={(e) => setCheckNumber(e.target.value)}
            placeholder="1234"
            disabled={submitting}
            required
          />
        </div>
      )}

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <textarea
          id="notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. April rent — paid in office"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          disabled={submitting}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !tenantId}>
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Receipt className="mr-2 h-4 w-4" />
          )}
          Record payment
        </Button>
      </div>
    </form>
  );
}

// ─── Internal preview type ───
type PreviewAlloc = {
  id: string;
  description: string;
  amount: number;
  original: number;
  partial: boolean;
};

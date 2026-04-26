"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Loader2,
  CreditCard,
  Landmark,
  HandCoins,
  FileCheck,
  X,
  AlertCircle,
  Send,
  User as UserIcon,
  Sparkles,
  CheckCircle2,
  Receipt,
} from "lucide-react";

/**
 * Shared "charge a tenant" form. Used by:
 *   - /dashboard/payments/charge       (standalone page)
 *   - /dashboard/virtual-terminal      (the Charge Tenant tab)
 *
 * Both surfaces are now identical — debounced tenant search, the full
 * method picker (card / ACH / cash / check), and the recovery-plan
 * apply path. Wrappers just provide the page chrome (page header vs
 * tab) — no duplicated form state.
 */

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface TenantSearchResult {
  id: string;
  unitId: string | null;
  name: string;
  email: string | null;
  unitLabel: string | null;
  savedCard: { brand: string | null; last4: string } | null;
  savedBank: { last4: string } | null;
}

interface PaymentMethodAvailability {
  tenant: {
    hasCard: boolean;
    cardBrand: string | null;
    cardLast4: string | null;
    hasAch: boolean;
    bankLast4: string | null;
    bankAccountType: string | null;
  };
  owner: {
    acceptsCash: boolean;
    acceptsChecks: boolean;
  };
  available: string[];
}

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
  originalBalance: number;
  forgivenessAmount: number;
  requiredPayments: number;
  completedPayments: number;
  requiredPeriodKeys: string[];
  startDate: string;
  endDate: string;
  graceDays: number;
  failurePolicy: string;
}

type Method = "card" | "ach" | "cash" | "check";
type ChargeType = "RENT" | "DEPOSIT" | "FEE" | "RECOVERY";

interface ChargeTenantFormProps {
  /** Tag the source on Payment.source so reports can split by entry point. */
  source?: "tenant-portal" | "virtual-terminal" | "autopay" | "scheduled";
  /** Where to redirect after a successful charge. Defaults to /dashboard/payments. */
  successHref?: string;
  /** Optional callback fired right after a successful charge — useful when a parent
   *  wants to e.g. close a modal or refresh a tab. */
  onSuccess?: (result: ChargeResult) => void;
}

interface ChargeResult {
  success: boolean;
  paymentId?: string;
  receiptNumber?: string;
  charged?: boolean;
  method?: string;
  recovery?: {
    applied: boolean;
    plan?: { id: string; completedPayments: number; requiredPayments: number };
    log?: { periodKey: string; wasOnTime: boolean };
    reason?: string;
  };
}

// ────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────

export function ChargeTenantForm({
  source = "virtual-terminal",
  // NOTE: `successHref` stays on the interface for back-compat but is
  // intentionally not destructured here — the form no longer auto-
  // navigates after a successful charge. It refreshes the tenant's
  // state in-place instead so the outstanding-charges + recovery cards
  // reflect what the server now sees. Wrappers that want post-charge
  // navigation should do it from the `onSuccess` callback.
  onSuccess,
}: ChargeTenantFormProps) {

  // ── Tenant search (debounced) ──
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<TenantSearchResult[]>([]);
  const [selected, setSelected] = useState<TenantSearchResult | null>(null);

  // ── Payment method state ──
  const [methodAvailability, setMethodAvailability] =
    useState<PaymentMethodAvailability | null>(null);
  const [methodLoading, setMethodLoading] = useState(false);
  const [method, setMethod] = useState<Method | "">("");

  // ── Recovery plan state ──
  const [activePlan, setActivePlan] = useState<ActiveRecoveryPlan | null>(null);
  const [applyToPlan, setApplyToPlan] = useState(false);

  // ── Outstanding-charges state ──
  // When a charge is picked, the new payment SETTLES it (updates the
  // existing PENDING/FAILED Payment row) instead of creating a new one.
  // Locks amount + type to the charge's values.
  const [outstandingCharges, setOutstandingCharges] = useState<
    OutstandingCharge[]
  >([]);
  const [appliesToChargeId, setAppliesToChargeId] = useState<string | null>(
    null
  );

  // ── Form fields ──
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<ChargeType>("RENT");
  const [description, setDescription] = useState("");

  // ── Check-only state ──
  const [checkNumber, setCheckNumber] = useState("");
  const [checkDate, setCheckDate] = useState("");
  const [payerBankName, setPayerBankName] = useState("");
  const [memoLine, setMemoLine] = useState("");
  const [checkSubType, setCheckSubType] = useState<
    "PERSONAL" | "MONEY_ORDER" | "CASHIERS_CHECK"
  >("PERSONAL");

  const [submitting, setSubmitting] = useState(false);

  // ─── Debounced tenant search ───
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/pm/tenants/search?q=${encodeURIComponent(query.trim())}`
        );
        if (res.ok) {
          const body = await res.json();
          setResults(body.tenants || []);
        }
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  // ─── Tenant-state fetcher (used on select + after every successful charge) ───
  // Hits methods + recovery + outstanding-charges in parallel so the cards
  // always reflect what the server actually has. Pulled out as a stable
  // function so post-charge refresh can call it without re-running the
  // selection useEffect.
  async function fetchTenantState(
    tenantId: string,
    {
      autoSelectFirstMethod = false,
      autoCheckRecoveryApply = false,
    }: { autoSelectFirstMethod?: boolean; autoCheckRecoveryApply?: boolean } = {}
  ) {
    const [methods, planResp, chargesResp] = await Promise.all([
      fetch(`/api/tenants/${tenantId}/payment-methods`).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`/api/tenants/${tenantId}/active-recovery-plan`).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`/api/tenants/${tenantId}/outstanding-charges`).then((r) =>
        r.ok ? r.json() : null
      ),
    ]);

    if (methods) {
      setMethodAvailability(methods);
      if (autoSelectFirstMethod && methods.available.length > 0) {
        setMethod(methods.available[0] as Method);
      }
    }
    const plan = planResp?.plan ?? null;
    setActivePlan(plan);
    if (autoCheckRecoveryApply && plan && plan.status !== "PLAN_OFFERED") {
      setApplyToPlan(true);
    }
    const charges: OutstandingCharge[] = chargesResp?.charges ?? [];
    setOutstandingCharges(charges);
  }

  // ─── On tenant select: fetch state + auto-pick first method + pre-check recovery apply ───
  useEffect(() => {
    if (!selected) {
      setMethodAvailability(null);
      setActivePlan(null);
      setOutstandingCharges([]);
      setAppliesToChargeId(null);
      setMethod("");
      setApplyToPlan(false);
      return;
    }

    let cancelled = false;
    setMethodLoading(true);
    setMethod("");

    Promise.all([
      fetch(`/api/tenants/${selected.id}/payment-methods`).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`/api/tenants/${selected.id}/active-recovery-plan`).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`/api/tenants/${selected.id}/outstanding-charges`).then((r) =>
        r.ok ? r.json() : null
      ),
    ])
      .then(([methods, planResp, chargesResp]) => {
        if (cancelled) return;
        if (methods) {
          setMethodAvailability(methods);
          if (methods.available.length > 0) {
            setMethod(methods.available[0] as Method);
          }
        }
        const plan = planResp?.plan ?? null;
        setActivePlan(plan);
        if (plan && plan.status !== "PLAN_OFFERED") {
          setApplyToPlan(true);
        }
        const charges: OutstandingCharge[] = chargesResp?.charges ?? [];
        setOutstandingCharges(charges);
        setAppliesToChargeId(null);
      })
      .catch(() => toast.error("Failed to load tenant details"))
      .finally(() => {
        if (!cancelled) setMethodLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  // Helper: when a charge is picked, sync amount + type to it.
  const selectedCharge = outstandingCharges.find(
    (c) => c.id === appliesToChargeId
  );
  useEffect(() => {
    if (selectedCharge) {
      setAmount(selectedCharge.amount.toFixed(2));
      // Charges of type APPLICATION can't really be re-typed, but the
      // ChargeType union doesn't include it; coerce to FEE for
      // form-state purposes (the server uses existing.type anyway).
      const t = selectedCharge.type;
      if (t === "RENT" || t === "DEPOSIT" || t === "FEE") setType(t);
      else setType("FEE");
    }
  }, [selectedCharge]);

  function reset() {
    setSelected(null);
    setQuery("");
    setResults([]);
    setMethodAvailability(null);
    setActivePlan(null);
    setOutstandingCharges([]);
    setAppliesToChargeId(null);
    setMethod("");
    setAmount("");
    setType("RENT");
    setDescription("");
    setCheckNumber("");
    setCheckDate("");
    setPayerBankName("");
    setMemoLine("");
    setCheckSubType("PERSONAL");
    setApplyToPlan(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      toast.error("Please select a tenant");
      return;
    }
    if (!selected.unitId) {
      toast.error("Tenant has no unit assignment");
      return;
    }
    if (!method) {
      toast.error("Please select a payment method");
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (method === "check" && !checkNumber.trim()) {
      toast.error("Check number is required");
      return;
    }

    setSubmitting(true);
    try {
      // The "RECOVERY" type is a UI affordance only — server-side it's
      // a RENT payment with applyToRecoveryPlan=true. (Recovery plans
      // only count RENT payments; see resolvePaymentPeriod.)
      const serverType = type === "RECOVERY" ? "RENT" : type;
      const apply =
        applyToPlan ||
        (type === "RECOVERY" && !!activePlan);

      const res = await fetch("/api/payments/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: selected.id,
          unitId: selected.unitId,
          amount: amt,
          type: serverType,
          description: description || undefined,
          source,
          paymentMethod: method,
          ...(apply && { applyToRecoveryPlan: true }),
          ...(appliesToChargeId && { appliesToPaymentId: appliesToChargeId }),
          ...(method === "check" && {
            checkNumber: checkNumber.trim(),
            checkDate: checkDate
              ? new Date(checkDate).toISOString()
              : undefined,
            payerBankName: payerBankName.trim() || undefined,
            memoLine: memoLine.trim() || undefined,
            checkSubType,
          }),
        }),
      });

      const body: ChargeResult = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(
          (body as { error?: string }).error || "Failed to charge tenant"
        );
        return;
      }

      // If we settled an existing charge, lead with that — it's the
      // most useful piece of information for the PM ("Cindy's $50
      // late fee is now closed, paid by check").
      if (appliesToChargeId && body.charged) {
        toast.success(
          method === "cash" || method === "check"
            ? `Outstanding charge settled — receipt ${body.receiptNumber}`
            : `Outstanding charge settled — ${
                method === "card"
                  ? `card ending ${
                      methodAvailability?.tenant.cardLast4 ?? ""
                    }`
                  : `bank ending ${
                      methodAvailability?.tenant.bankLast4 ?? ""
                    }`
              }`
        );
      }

      // Method-specific success message (only for new charges; the
      // settle case is already handled above)
      else if (method === "card" && body.charged) {
        toast.success(
          `Charged ${
            methodAvailability?.tenant.cardBrand?.toUpperCase() ?? "card"
          } •••• ${methodAvailability?.tenant.cardLast4 ?? ""}`
        );
      } else if (method === "ach" && body.charged) {
        toast.success(
          `ACH initiated — bank •••• ${
            methodAvailability?.tenant.bankLast4 ?? ""
          }`
        );
      } else if (method === "cash" || method === "check") {
        toast.success(`Recorded — receipt ${body.receiptNumber}`);
      } else if (!body.charged) {
        toast.error(
          "Payment was declined. Check the payment record for details."
        );
      }

      // Recovery plan toast (additive — fires after the method toast).
      if (body.recovery) {
        if (body.recovery.applied && body.recovery.plan) {
          const { completedPayments, requiredPayments } = body.recovery.plan;
          toast.success(
            `Applied to recovery plan — ${completedPayments}/${requiredPayments} on-time payments`,
            { duration: 5000 }
          );
        } else if (apply && !body.recovery.applied) {
          toast.warning(
            `Recovery plan not credited: ${
              body.recovery.reason ?? "period mismatch"
            }`,
            { duration: 6000 }
          );
        }
      }

      // Refresh the tenant's state in place so the outstanding-charges
      // card + recovery-plan progress reflect what the server now sees.
      // Without this the form keeps showing the just-paid charge as
      // outstanding until the PM manually refreshes — confusing.
      if (selected) {
        try {
          await fetchTenantState(selected.id);
        } catch {
          // Best-effort refresh — toast already confirmed the charge.
        }
      }

      // Reset only the per-charge fields, keep the tenant selected so
      // the PM can record another charge for them in seconds (the
      // "Square POS" flow). They hit Cancel / Change to leave.
      setAmount("");
      setDescription("");
      setCheckNumber("");
      setCheckDate("");
      setPayerBankName("");
      setMemoLine("");
      setCheckSubType("PERSONAL");
      setAppliesToChargeId(null);
      // Re-default to first available method since availability may
      // have shifted (e.g. the PM just used the only saved card).
      // We pull this from the state we just refreshed.

      onSuccess?.(body);
      // Note: we deliberately don't `router.push(successHref)` here.
      // Pushing to the same route doesn't unmount the form, so the
      // in-place refresh above is what actually keeps the UI honest.
      // Wrappers that genuinely want to navigate (e.g. the standalone
      // /dashboard/payments/charge page) can handle it from onSuccess.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Charge failed");
    } finally {
      setSubmitting(false);
    }
  }

  const noMethodsAvailable =
    methodAvailability !== null &&
    methodAvailability.available.length === 0;

  const methodOptions: Array<{
    value: Method;
    icon: typeof CreditCard;
    label: () => string;
    available: boolean;
    disabledReason: string;
  }> = [
    {
      value: "card",
      icon: CreditCard,
      available: methodAvailability?.available.includes("card") ?? false,
      disabledReason: "No card on file",
      label: () =>
        methodAvailability?.tenant.hasCard
          ? `Card — ${
              methodAvailability.tenant.cardBrand?.toUpperCase() ?? "Card"
            } •••• ${methodAvailability.tenant.cardLast4 ?? ""}`
          : "Card",
    },
    {
      value: "ach",
      icon: Landmark,
      available: methodAvailability?.available.includes("ach") ?? false,
      disabledReason: "No bank account on file",
      label: () =>
        methodAvailability?.tenant.hasAch
          ? `Bank — ${
              methodAvailability.tenant.bankAccountType ?? "account"
            } •••• ${methodAvailability.tenant.bankLast4 ?? ""}`
          : "ACH (Bank)",
    },
    {
      value: "cash",
      icon: HandCoins,
      available: methodAvailability?.available.includes("cash") ?? false,
      disabledReason: "Cash not enabled for this property's owner",
      label: () => "Cash",
    },
    {
      value: "check",
      icon: FileCheck,
      available: methodAvailability?.available.includes("check") ?? false,
      disabledReason: "Checks not enabled for this property's owner",
      label: () => "Check / Money Order",
    },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-5 animate-fade-scale-in">
      {/* ─── Step 1: Tenant search ─── */}
      {!selected && (
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <label className="text-xs font-medium">Find tenant</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, email, property, or unit…"
              autoFocus
              className="w-full rounded-lg border bg-background pl-9 pr-9 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {query.trim().length >= 2 && !searching && results.length === 0 && (
            <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">
              No matching tenants.
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-1">
              {results.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelected(t)}
                  className="w-full text-left rounded-lg border bg-background p-3 hover:border-primary hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        {t.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.unitLabel || "No unit assigned"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {t.savedCard && (
                        <span className="text-[11px] rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          •••{t.savedCard.last4}
                        </span>
                      )}
                      {t.savedBank && (
                        <span className="text-[11px] rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 px-2 py-0.5 flex items-center gap-1">
                          <Landmark className="h-3 w-3" />
                          •••{t.savedBank.last4}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Step 2: Selected tenant — full charge form ─── */}
      {selected && (
        <>
          <div className="rounded-xl border bg-card p-5 space-y-5">
            {/* Header strip */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Charging</p>
                <p className="text-base font-semibold">{selected.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selected.unitLabel || "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={reset}
                disabled={submitting}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Change
              </button>
            </div>

            {/* Recovery plan card (only if active plan exists) */}
            {activePlan && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">
                      Active recovery plan
                    </span>
                    <span
                      className={`text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 ${
                        activePlan.status === "PLAN_AT_RISK"
                          ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                      }`}
                    >
                      {activePlan.status.replace("PLAN_", "").replace("_", " ")}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {activePlan.completedPayments} / {activePlan.requiredPayments}{" "}
                    on-time
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${
                        (activePlan.completedPayments /
                          Math.max(1, activePlan.requiredPayments)) *
                        100
                      }%`,
                    }}
                  />
                </div>

                <div className="text-xs text-muted-foreground">
                  Make {activePlan.requiredPayments} consecutive on-time payments
                  and ${activePlan.forgivenessAmount.toLocaleString()} of the
                  prior overdue balance is forgiven.
                </div>

                {/* Apply toggle */}
                <label className="flex items-start gap-2 cursor-pointer pt-1 border-t">
                  <input
                    type="checkbox"
                    checked={applyToPlan}
                    onChange={(e) => {
                      setApplyToPlan(e.target.checked);
                      if (e.target.checked) {
                        // Mirror in the type dropdown so the UI is coherent
                        setType("RECOVERY");
                      } else if (type === "RECOVERY") {
                        setType("RENT");
                      }
                    }}
                    disabled={submitting}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      Apply this charge to the recovery plan
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Counts toward the {activePlan.requiredPayments}-payment
                      requirement. Only applies if the period matches the
                      plan&apos;s required months.
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Outstanding charges card (only if any open balance) */}
            {outstandingCharges.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-semibold">
                      Outstanding charges
                    </span>
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
                  Pick one to settle it directly — the existing PENDING row
                  closes instead of leaving an unpaid charge floating next to
                  a duplicate payment.
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
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 bg-muted text-muted-foreground">
                            {c.type}
                          </span>
                          {c.status === "FAILED" && (
                            <span className="text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 bg-red-500/10 text-red-600 border border-red-500/20">
                              previously failed
                            </span>
                          )}
                          <span className="text-sm font-mono tabular-nums">
                            ${c.amount.toFixed(2)}
                          </span>
                        </div>
                        {c.description && (
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">
                            {c.description}
                          </div>
                        )}
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Due {new Date(c.dueDate).toLocaleDateString()}
                        </div>
                      </div>
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
              </div>
            )}

            {/* Method picker */}
            <div className="space-y-2">
              <label className="text-xs font-medium">Payment Method</label>
              {methodLoading && (
                <p className="text-sm text-muted-foreground">
                  Loading available methods...
                </p>
              )}

              {noMethodsAvailable && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">No payment methods available</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Tenant has no card or bank on file, and cash/check
                      aren&apos;t enabled for this property&apos;s owner. Either
                      ask the tenant to add a payment method in their portal,
                      or enable cash/check on the owner page.
                    </p>
                  </div>
                </div>
              )}

              {methodAvailability && !noMethodsAvailable && (
                <div className="grid grid-cols-2 gap-2">
                  {methodOptions.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={!opt.available || submitting}
                        onClick={() => setMethod(opt.value)}
                        title={!opt.available ? opt.disabledReason : undefined}
                        className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left transition ${
                          method === opt.value
                            ? "border-primary bg-primary/5"
                            : opt.available
                              ? "border-muted hover:border-muted-foreground/40"
                              : "border-muted opacity-40 cursor-not-allowed"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="text-sm">{opt.label()}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Amount + type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">
                  Amount (USD) *
                  {appliesToChargeId && (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      (locked to outstanding charge)
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  disabled={submitting || !!appliesToChargeId}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-xs font-medium">
                  Type *
                  {appliesToChargeId && (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      (locked)
                    </span>
                  )}
                </label>
                <select
                  value={type}
                  onChange={(e) => {
                    const next = e.target.value as ChargeType;
                    setType(next);
                    // Recovery option auto-checks the apply toggle.
                    if (next === "RECOVERY") setApplyToPlan(true);
                  }}
                  disabled={submitting || !!appliesToChargeId}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                >
                  <option value="RENT">Rent</option>
                  <option value="DEPOSIT">Deposit</option>
                  <option value="FEE">Fee / Misc</option>
                  {/* Only available when there's an active plan to apply to */}
                  {activePlan && (
                    <option value="RECOVERY">Recovery plan payment</option>
                  )}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium">
                Description{" "}
                <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Appears on the receipt"
                disabled={submitting}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Check-specific fields */}
            {method === "check" && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                <div>
                  <label className="text-xs font-medium">Check Type</label>
                  <select
                    value={checkSubType}
                    onChange={(e) =>
                      setCheckSubType(e.target.value as typeof checkSubType)
                    }
                    disabled={submitting}
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  >
                    <option value="PERSONAL">Personal Check</option>
                    <option value="MONEY_ORDER">Money Order</option>
                    <option value="CASHIERS_CHECK">Cashier&apos;s Check</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium">
                      Check / Reference # *
                    </label>
                    <input
                      type="text"
                      value={checkNumber}
                      onChange={(e) => setCheckNumber(e.target.value)}
                      placeholder="e.g. 1234"
                      required
                      disabled={submitting}
                      className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Date on Check</label>
                    <input
                      type="date"
                      value={checkDate}
                      onChange={(e) => setCheckDate(e.target.value)}
                      disabled={submitting}
                      className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium">Bank Name</label>
                  <input
                    type="text"
                    value={payerBankName}
                    onChange={(e) => setPayerBankName(e.target.value)}
                    placeholder="e.g. Chase"
                    disabled={submitting}
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Memo Line</label>
                  <input
                    type="text"
                    value={memoLine}
                    onChange={(e) => setMemoLine(e.target.value)}
                    placeholder="e.g. April rent"
                    disabled={submitting}
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={reset}
                disabled={submitting}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  submitting || !method || noMethodsAvailable || !amount
                }
                className="btn-press rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {method === "cash" || method === "check"
                  ? "Record Payment"
                  : "Charge Tenant"}
              </button>
            </div>
          </div>
        </>
      )}
    </form>
  );
}

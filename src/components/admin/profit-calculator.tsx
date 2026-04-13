"use client";

import { useState, useMemo, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  calculateProfit,
  PRESETS,
  type CalculatorInputs,
} from "@/lib/profit-calculator";
import { getTier, RESIDUAL_TIERS } from "@/lib/residual-tiers";
import {
  Download,
  Mail,
  Loader2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Zap,
  TrendingUp,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

const DEFAULT_INPUTS: CalculatorInputs = {
  units: 200,
  avgRent: 1500,
  occupancyPct: 92,
  cardPct: 30,
  pmAchRate: 5,
  mgmtFeePct: 8,
  achPayer: "tenant",
  currentSoftwareCost: 0,
};

function tierBadge(name: string): string {
  const m: Record<string, string> = {
    Starter: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    Growth: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    Scale: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    Enterprise: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  };
  return m[name] || m.Starter;
}

export function ProfitCalculator() {
  const [inputs, setInputs] = useState<CalculatorInputs>(DEFAULT_INPUTS);
  const [mode, setMode] = useState<"sdr" | "internal">("sdr");
  const [heroMode, setHeroMode] = useState<"net" | "total">("total");
  const [showDetails, setShowDetails] = useState(false);
  const [showCallFlow, setShowCallFlow] = useState(true);
  const [callStep, setCallStep] = useState(0);
  const [prospectName, setProspectName] = useState("");
  const [prospectEmail, setProspectEmail] = useState("");
  const [prospectCompany, setProspectCompany] = useState("");
  const [sendingQuote, setSendingQuote] = useState(false);

  // ── ALL CALCULATIONS UNCHANGED ──────────────────────
  const c = useMemo(() => calculateProfit(inputs), [inputs]);
  const tier = c.tier;

  useEffect(() => {
    const t = getTier(inputs.units);
    if (t.feeScheduleLocked) {
      setInputs((p) => ({ ...p, pmAchRate: 6 }));
    }
  }, [inputs.units]);

  function update<K extends keyof CalculatorInputs>(
    field: K,
    value: CalculatorInputs[K]
  ) {
    setInputs((prev) => ({ ...prev, [field]: value }));
  }

  // ── QUOTE HANDLERS UNCHANGED ────────────────────────
  async function handlePreviewQuote() {
    const res = await fetch("/api/admin/profit-calculator/generate-quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...inputs, ...c, prospectName: prospectName || "Prospect", prospectEmail, prospectCompany }),
    });
    if (res.ok) {
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), "_blank");
    } else {
      toast.error("Failed to generate preview");
    }
  }

  async function handleDownloadQuote() {
    const res = await fetch("/api/admin/profit-calculator/generate-quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...inputs, ...c, prospectName, prospectEmail, prospectCompany }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `DoorStax_Quote_${(prospectName || "Prospect").replace(/\s+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      toast.error("Failed to generate quote");
    }
  }

  async function handleEmailQuote() {
    setSendingQuote(true);
    try {
      const res = await fetch("/api/admin/profit-calculator/email-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...inputs, ...c, prospectName, prospectEmail, prospectCompany }),
      });
      if (res.ok) toast.success("Quote emailed to " + prospectEmail);
      else toast.error("Failed to send");
    } finally {
      setSendingQuote(false);
    }
  }

  // ── DERIVED UI VALUES ───────────────────────────────
  const heroNumber =
    heroMode === "total"
      ? c.mgmtFeeEarnings + c.pmNetCostOrProfit
      : c.pmNetCostOrProfit;
  const heroLabel =
    heroMode === "total"
      ? "Total Monthly Income with DoorStax"
      : "Net Gain from DoorStax Payments";
  const statusText =
    inputs.units >= 1000
      ? "Operating at Enterprise-level volume"
      : inputs.units >= 500
        ? "Scaling toward Enterprise territory"
        : inputs.units >= 100
          ? "Growing portfolio with monetization unlocked"
          : "Building a strong foundation";

  // ═══════════════════════════════════════════════════
  return (
    <div className="min-h-screen">
      {/* ── TOP BAR ─────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Pricing Calculator
          </h1>
          <p className="text-xs text-muted-foreground">
            Model PM costs and revenue for live sales calls
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border overflow-hidden text-xs">
            <button
              onClick={() => setMode("sdr")}
              className={
                "px-3 py-1.5 font-medium transition-colors " +
                (mode === "sdr"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted")
              }
            >
              Sales View
            </button>
            <button
              onClick={() => setMode("internal")}
              className={
                "px-3 py-1.5 font-medium transition-colors " +
                (mode === "internal"
                  ? "bg-red-600 text-white"
                  : "hover:bg-muted")
              }
            >
              <Shield className="h-3 w-3 inline mr-1" />
              Internal
            </button>
          </div>
          <button
            onClick={() => setShowCallFlow(!showCallFlow)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            {showCallFlow ? (
              <EyeOff className="h-3 w-3" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
            Call Flow
          </button>
        </div>
      </div>

      {/* ── 3-COLUMN LAYOUT ────────────────────────── */}
      <div className="flex gap-6">
        {/* ▌LEFT: INPUT CONTROLS ▌ */}
        <div className="w-64 shrink-0 space-y-4">
          <div className="rounded-xl border bg-card p-4 space-y-4 sticky top-20">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Prospect Profile
            </h3>

            {/* Presets */}
            <div className="flex gap-1">
              {Object.entries(PRESETS).map(([key, p]) => (
                <button
                  key={key}
                  onClick={() => setInputs((prev) => ({ ...prev, ...p.values }))}
                  className="flex-1 rounded border px-1 py-1 text-[10px] font-medium hover:bg-muted transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Units — primary */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium">Units</label>
                <input
                  type="number"
                  value={inputs.units}
                  onChange={(e) =>
                    update("units", Math.max(1, Number(e.target.value)))
                  }
                  className="w-20 rounded border bg-background px-2 py-1 text-sm text-right font-mono"
                />
              </div>
              <input
                type="range"
                min={1}
                max={3000}
                value={inputs.units}
                onChange={(e) => update("units", Number(e.target.value))}
                className="w-full accent-primary mt-1"
              />
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[9px] text-muted-foreground">1</span>
                <span
                  className={
                    "text-[10px] px-1.5 py-0.5 rounded-full font-semibold " +
                    tierBadge(tier.name)
                  }
                >
                  {tier.name}
                </span>
                <span className="text-[9px] text-muted-foreground">3k</span>
              </div>
            </div>

            {/* Compact inputs */}
            <div className="space-y-2.5 pt-2 border-t">
              <CompactInput
                label="Avg Rent"
                prefix="$"
                value={inputs.avgRent}
                onChange={(v) => update("avgRent", v)}
              />
              <CompactInput
                label="Occupancy"
                suffix="%"
                value={inputs.occupancyPct}
                onChange={(v) => update("occupancyPct", v)}
                max={100}
              />
              <CompactInput
                label="Card %"
                suffix="%"
                value={inputs.cardPct}
                onChange={(v) => update("cardPct", v)}
                max={100}
              />
              <CompactInput
                label="Mgmt Fee"
                suffix="%"
                value={inputs.mgmtFeePct}
                onChange={(v) => update("mgmtFeePct", v)}
                step={0.5}
              />
              <CompactInput
                label="Current SW"
                prefix="$"
                value={inputs.currentSoftwareCost}
                onChange={(v) => update("currentSoftwareCost", v)}
                step={50}
              />
              {!tier.feeScheduleLocked && (
                <CompactInput
                  label="ACH Fee"
                  prefix="$"
                  value={inputs.pmAchRate}
                  onChange={(v) => update("pmAchRate", v)}
                  step={0.5}
                />
              )}
            </div>
          </div>
        </div>

        {/* ▌CENTER: THE PITCH ▌ */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* ═══ HERO ═══ */}
          <div className="rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-card to-card p-8 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/5 to-transparent pointer-events-none" />
            <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest mb-1 relative">
              {statusText}
            </p>

            {/* Hero mode toggle */}
            <div className="flex justify-center gap-4 mb-3 relative">
              <button
                onClick={() => setHeroMode("total")}
                className={
                  "text-[10px] pb-0.5 " +
                  (heroMode === "total"
                    ? "font-semibold text-emerald-400 border-b border-emerald-400"
                    : "text-muted-foreground")
                }
              >
                Total Monthly Income
              </button>
              <button
                onClick={() => setHeroMode("net")}
                className={
                  "text-[10px] pb-0.5 " +
                  (heroMode === "net"
                    ? "font-semibold text-emerald-400 border-b border-emerald-400"
                    : "text-muted-foreground")
                }
              >
                Net from Payments
              </button>
            </div>

            <div className="relative">
              <p className="text-[10px] text-muted-foreground mb-1">
                {heroLabel}
              </p>
              <p className="text-5xl md:text-6xl font-black tracking-tight">
                <span className="text-emerald-400">
                  {heroNumber >= 0 ? "+" : "-"}$
                </span>
                <span className="text-foreground">
                  {Math.abs(heroNumber).toLocaleString("en-US", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </span>
              </p>
              <p className="text-lg text-muted-foreground mt-1">per month</p>
            </div>

            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 relative">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-400">
                {"\u2248"} $
                {Math.abs(heroNumber * 12).toLocaleString("en-US", {
                  maximumFractionDigits: 0,
                })}
                /year
              </span>
            </div>

            <p className="text-[10px] text-muted-foreground/60 mt-4 italic relative">
              You are currently not capturing this revenue with your existing
              setup
            </p>
          </div>

          {/* ═══ 3-NUMBER RULE ═══ */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border bg-card p-4 text-center">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Platform Investment
              </p>
              <p className="text-xl font-bold">
                {formatCurrency(c.softwareCost)}
              </p>
              <p className="text-[9px] text-muted-foreground mt-1">
                ${tier.perUnitCost.toFixed(2)}/unit &middot; {tier.name}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Payment Revenue
              </p>
              <p className="text-xl font-bold text-emerald-500">
                +{formatCurrency(c.totalPmPaymentEarnings)}
              </p>
              <p className="text-[9px] text-muted-foreground mt-1">
                Card + ACH earnings
              </p>
            </div>
            <div
              className={
                "rounded-xl border p-4 text-center " +
                (c.pmPaymentsCoverSoftware
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-amber-500/30 bg-amber-500/5")
              }
            >
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Net Monthly Gain
              </p>
              <p
                className={
                  "text-xl font-bold " +
                  (c.pmNetCostOrProfit >= 0
                    ? "text-emerald-500"
                    : "text-amber-500")
                }
              >
                {c.pmNetCostOrProfit >= 0 ? "+" : ""}
                {formatCurrency(c.pmNetCostOrProfit)}
              </p>
              <p className="text-[9px] text-muted-foreground mt-1">
                {c.pmPaymentsCoverSoftware
                  ? "Platform pays for itself"
                  : "Net of payment earnings"}
              </p>
            </div>
          </div>

          {/* Self-paying callout */}
          {c.pmPaymentsCoverSoftware && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <Zap className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-400">
                  The platform pays for itself
                </p>
                <p className="text-xs text-muted-foreground">
                  Payment earnings of{" "}
                  {formatCurrency(c.totalPmPaymentEarnings)}/mo exceed the
                  cost of {formatCurrency(c.softwareCost)}/mo by{" "}
                  {formatCurrency(c.pmNetCostOrProfit)}.
                </p>
              </div>
            </div>
          )}

          {/* ═══ DETAILS — collapsible ═══ */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between p-4 text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              <span>Detailed Breakdown</span>
              {showDetails ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {showDetails && (
              <div className="border-t p-5 space-y-4">
                <div className="space-y-2 text-sm">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Payment Earnings
                  </h4>
                  <Row
                    label={`Card (${(tier.cardRate * 100).toFixed(2)}% of ${formatCurrency(c.cardVolume)})`}
                    value={`+${formatCurrency(c.pmCardEarnings)}`}
                    className="text-emerald-500"
                  />
                  <Row
                    label={`ACH ($${c.pmAchSpread.toFixed(2)} x ${c.achPayments} tx)`}
                    value={`+${formatCurrency(c.pmAchEarnings)}`}
                    className="text-emerald-500"
                  />
                </div>
                <div className="space-y-2 text-sm border-t pt-4">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Total Monthly Income
                  </h4>
                  <Row
                    label={`Management fees (${inputs.mgmtFeePct}%)`}
                    value={formatCurrency(c.mgmtFeeEarnings)}
                  />
                  <Row
                    label="Payment earnings"
                    value={`+${formatCurrency(c.totalPmPaymentEarnings)}`}
                    className="text-emerald-500"
                  />
                  <Row
                    label="Platform investment"
                    value={`-${formatCurrency(c.softwareCost)}`}
                    className="text-red-500"
                  />
                  <Row
                    label="Total Net Monthly Income"
                    value={formatCurrency(c.pmTotalNetIncome)}
                    className="font-bold"
                    border
                  />
                </div>
                <details className="border-t pt-4">
                  <summary className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer">
                    Tier Rate Card
                  </summary>
                  <div className="mt-2 space-y-1">
                    {RESIDUAL_TIERS.map((t) => (
                      <div
                        key={t.name}
                        className={
                          "flex items-center justify-between text-xs rounded p-1.5 " +
                          (t.name === tier.name ? "bg-primary/10 font-medium" : "")
                        }
                      >
                        <span>
                          {t.name} ({t.minUnits}-{t.maxUnits || "\u221e"})
                        </span>
                        <span className="text-muted-foreground">
                          ${t.perUnitCost}/u &middot; ACH ${t.platformAchCost}{" "}
                          &middot; Card {(t.cardRate * 100).toFixed(2)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </div>

          {/* ═══ QUOTE SECTION ═══ */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold">Send Pricing Proposal</h3>
            <div className="grid grid-cols-3 gap-3">
              <input
                type="text"
                value={prospectName}
                onChange={(e) => setProspectName(e.target.value)}
                placeholder="Prospect name *"
                className="rounded-lg border bg-background px-3 py-2 text-sm"
              />
              <input
                type="email"
                value={prospectEmail}
                onChange={(e) => setProspectEmail(e.target.value)}
                placeholder="Email *"
                className="rounded-lg border bg-background px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={prospectCompany}
                onChange={(e) => setProspectCompany(e.target.value)}
                placeholder="Company"
                className="rounded-lg border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handlePreviewQuote}
                className="rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted flex items-center gap-1.5"
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </button>
              <button
                onClick={handleDownloadQuote}
                disabled={!prospectName}
                className="rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50 flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
              <button
                onClick={handleEmailQuote}
                disabled={!prospectName || !prospectEmail || sendingQuote}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
              >
                {sendingQuote ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Mail className="h-3.5 w-3.5" />
                )}
                Email Proposal
              </button>
            </div>
          </div>
        </div>

        {/* ▌RIGHT: CONTEXT PANEL ▌ */}
        <div className="w-64 shrink-0">
          <div className="sticky top-20 space-y-4">
            {/* SDR CALL FLOW */}
            {mode === "sdr" && showCallFlow && (
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-primary">
                  Live Call Flow
                </h3>
                <div className="space-y-2">
                  {[
                    {
                      step: 1,
                      text: "Confirm their unit count and avg rent",
                      action: "Adjust sliders to match",
                    },
                    {
                      step: 2,
                      text: "Show the revenue number",
                      action: "Point to the hero section",
                    },
                    {
                      step: 3,
                      text: "Pause and ask:",
                      action: `"What would an extra $${Math.round(heroNumber).toLocaleString()}/month do for your business?"`,
                    },
                    {
                      step: 4,
                      text: "Reinforce:",
                      action: `"This is based on YOUR portfolio — ${inputs.units} units at $${inputs.avgRent} avg rent"`,
                    },
                    {
                      step: 5,
                      text: "Close:",
                      action: '"Let me send you this proposal — what email should I use?"',
                    },
                  ].map(({ step, text, action }) => (
                    <button
                      key={step}
                      onClick={() => setCallStep(step)}
                      className={
                        "w-full text-left rounded-lg p-2 transition-colors text-[11px] " +
                        (callStep === step
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted/50")
                      }
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={
                            "h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 " +
                            (callStep >= step
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground")
                          }
                        >
                          {step}
                        </span>
                        <div>
                          <p className="font-medium">{text}</p>
                          <p className="text-muted-foreground mt-0.5 italic">
                            {action}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* INTERNAL VIEW */}
            {mode === "internal" && (
              <div className="space-y-4">
                <div className="rounded-xl bg-red-950/50 border-2 border-red-500/50 p-3">
                  <div className="flex items-center gap-2 text-red-400">
                    <Shield className="h-4 w-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      Internal Only
                    </span>
                  </div>
                  <p className="text-[9px] text-red-400/70 mt-1">
                    Do NOT share screen or include in proposals.
                  </p>
                </div>

                <div className="rounded-xl border border-red-500/20 bg-card p-4 space-y-2">
                  <h4 className="text-[10px] font-semibold text-red-400">
                    DoorStax Revenue
                  </h4>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Card net</span>
                      <span className="font-mono">
                        {formatCurrency(c.doorstaxCardNet)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ACH net</span>
                      <span className="font-mono">
                        {formatCurrency(c.doorstaxAchNet)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Software</span>
                      <span className="font-mono">
                        {formatCurrency(c.doorstaxSoftware)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-1.5 font-bold">
                      <span>Net revenue</span>
                      <span className="text-emerald-400">
                        {formatCurrency(c.doorstaxNet)}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Per unit</span>
                      <span className="font-mono">
                        ${(c.doorstaxNet / inputs.units).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Annual</span>
                      <span className="font-mono">
                        {formatCurrency(c.doorstaxNet * 12)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-red-500/20 bg-card p-4 space-y-1.5">
                  <h4 className="text-[10px] font-semibold text-red-400">
                    Card Margin
                  </h4>
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span>Collected (3.25%)</span>
                      <span className="font-mono">
                        {formatCurrency(c.grossCardCollected)}
                      </span>
                    </div>
                    <div className="flex justify-between text-red-400">
                      <span>Interchange</span>
                      <span>-{formatCurrency(c.cardCosts)}</span>
                    </div>
                    <div className="flex justify-between text-amber-400">
                      <span>Bank (30%)</span>
                      <span>-{formatCurrency(c.bankShare)}</span>
                    </div>
                    <div className="flex justify-between text-purple-400">
                      <span>PM residual</span>
                      <span>-{formatCurrency(c.pmCardEarnings)}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-1 text-emerald-400">
                      <span>Keeps</span>
                      <span>{formatCurrency(c.doorstaxCardNet)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── HELPER COMPONENTS ────────────────────────────────

function Row({
  label,
  value,
  className = "",
  border = false,
}: {
  label: string;
  value: string;
  className?: string;
  border?: boolean;
}) {
  return (
    <div
      className={`flex justify-between text-sm ${border ? "border-t pt-2" : ""}`}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${className}`}>{value}</span>
    </div>
  );
}

function CompactInput({
  label,
  prefix,
  suffix,
  value,
  onChange,
  step,
  max,
}: {
  label: string;
  prefix?: string;
  suffix?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-xs">{label}</label>
      <div className="flex items-center gap-1">
        {prefix && (
          <span className="text-[10px] text-muted-foreground">{prefix}</span>
        )}
        <input
          type="number"
          step={step}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-16 rounded border bg-background px-2 py-1 text-xs text-right"
        />
        {suffix && (
          <span className="text-[10px] text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  );
}

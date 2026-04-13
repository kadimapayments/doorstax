"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency } from "@/lib/utils";
import {
  calculateProfit,
  PRESETS,
  type CalculatorInputs,
} from "@/lib/profit-calculator";
import { getTier, RESIDUAL_TIERS } from "@/lib/residual-tiers";
import {
  Calculator,
  DollarSign,
  TrendingUp,
  Download,
  Mail,
  Loader2,
  Eye,
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
};

function tierColor(name: string): string {
  const m: Record<string, string> = {
    Starter: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    Growth: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    Scale:
      "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    Enterprise:
      "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  };
  return m[name] || m.Starter;
}

export function ProfitCalculator() {
  const [inputs, setInputs] = useState<CalculatorInputs>(DEFAULT_INPUTS);
  const [prospectName, setProspectName] = useState("");
  const [prospectEmail, setProspectEmail] = useState("");
  const [prospectCompany, setProspectCompany] = useState("");
  const [sendingQuote, setSendingQuote] = useState(false);

  const c = useMemo(() => calculateProfit(inputs), [inputs]);
  const tier = c.tier;

  // Auto-adjust ACH rate when tier changes
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

  async function handlePreviewQuote() {
    const res = await fetch("/api/admin/profit-calculator/generate-quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...inputs, ...c, prospectName: prospectName || "Prospect", prospectEmail, prospectCompany }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
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

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <PageHeader
        title="Profit Calculator"
        description="Model PM costs and DoorStax earnings. All numbers auto-adjust with unit count."
      />

      {/* Presets */}
      <div className="flex gap-2">
        {Object.entries(PRESETS).map(([key, p]) => (
          <Button
            key={key}
            variant="outline"
            size="sm"
            onClick={() =>
              setInputs((prev) => ({
                ...prev,
                ...p.values,
              }))
            }
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Input controls */}
      <Card className="border-border">
        <CardContent className="p-6 space-y-5">
          <h2 className="text-base font-semibold">Prospect Details</h2>
          <div className="space-y-4">
            {/* Unit slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Units Under Management</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={inputs.units}
                    onChange={(e) =>
                      update("units", Math.max(1, Number(e.target.value)))
                    }
                    className="w-24 text-right font-mono"
                  />
                  <Badge className={tierColor(tier.name)}>{tier.name}</Badge>
                </div>
              </div>
              <input
                type="range"
                min={1}
                max={2000}
                value={inputs.units}
                onChange={(e) => update("units", Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>Avg Monthly Rent ($)</Label>
                <Input
                  type="number"
                  value={inputs.avgRent}
                  onChange={(e) => update("avgRent", Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Occupancy (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={inputs.occupancyPct}
                  onChange={(e) =>
                    update("occupancyPct", Number(e.target.value))
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Card Payment % (rest ACH)</Label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={inputs.cardPct}
                  onChange={(e) => update("cardPct", Number(e.target.value))}
                  className="w-full accent-primary mt-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{inputs.cardPct}% Card</span>
                  <span>{100 - inputs.cardPct}% ACH</span>
                </div>
              </div>
              <div>
                <Label>Management Fee (%)</Label>
                <Input
                  type="number"
                  step={0.5}
                  value={inputs.mgmtFeePct}
                  onChange={(e) =>
                    update("mgmtFeePct", Number(e.target.value))
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label>PM ACH Rate ($)</Label>
                <Input
                  type="number"
                  step={0.5}
                  value={inputs.pmAchRate}
                  onChange={(e) =>
                    update("pmAchRate", Number(e.target.value))
                  }
                  disabled={tier.feeScheduleLocked}
                  className="mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {tier.feeScheduleLocked
                    ? "Fixed at $6 for Starter"
                    : `Platform cost: $${tier.platformAchCost} · Spread: $${c.pmAchSpread.toFixed(2)}`}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results — two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: PM Perspective */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            What the PM Sees
          </h2>

          <Card className="border-border">
            <CardContent className="p-5 space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Software Cost
              </h3>
              <div className="text-3xl font-bold">
                {formatCurrency(c.softwareCost)}
                <span className="text-base font-normal text-muted-foreground">
                  /mo
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {inputs.units} units &middot; {tier.name} tier &middot; $
                {tier.perUnitCost}/unit
              </p>
            </CardContent>
          </Card>

          {tier.feeScheduleLocked ? (
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="p-5">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  Payment monetization unlocks at 100 units
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  Starter tier: all processing fees go to the platform.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border">
              <CardContent className="p-5 space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Payment Earnings
                </h3>
                <Row
                  label={`Card (${(tier.cardRate * 100).toFixed(2)}%)`}
                  value={formatCurrency(c.pmCardEarnings)}
                  className="text-green-600"
                />
                <Row
                  label={`ACH ($${c.pmAchSpread.toFixed(2)} × ${c.achPayments} tx)`}
                  value={formatCurrency(c.pmAchEarnings)}
                  className="text-green-600"
                />
                <Row
                  label="Total"
                  value={formatCurrency(c.totalPmPaymentEarnings)}
                  className="text-green-600 font-bold"
                  border
                />
              </CardContent>
            </Card>
          )}

          <Card
            className={
              c.pmPaymentsCoverSoftware
                ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20"
                : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20"
            }
          >
            <CardContent className="p-5 space-y-1">
              <h3 className="text-sm font-semibold">
                {c.pmPaymentsCoverSoftware
                  ? "\u2705 Payments cover software cost"
                  : "\ud83d\udcb0 Net software cost after earnings"}
              </h3>
              <div
                className={`text-2xl font-bold ${c.pmNetCostOrProfit >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {c.pmNetCostOrProfit >= 0 ? "+" : ""}
                {formatCurrency(c.pmNetCostOrProfit)}/mo
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-5 space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                PM Total Monthly Income
              </h3>
              <Row
                label={`Management fees (${inputs.mgmtFeePct}%)`}
                value={formatCurrency(c.mgmtFeeEarnings)}
              />
              <Row
                label="Payment earnings"
                value={`+${formatCurrency(c.totalPmPaymentEarnings)}`}
                className="text-green-600"
              />
              <Row
                label="Software cost"
                value={`-${formatCurrency(c.softwareCost)}`}
                className="text-red-500"
              />
              <Row
                label="Net Monthly Income"
                value={formatCurrency(c.pmTotalNetIncome)}
                className="text-lg font-bold"
                border
              />
            </CardContent>
          </Card>

          {/* SDR talking points */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-5 space-y-2">
              <h3 className="text-sm font-semibold">\ud83d\udcac SDR Talking Points</h3>
              <ul className="text-sm space-y-1.5 text-muted-foreground">
                <li>
                  &bull; Software costs{" "}
                  <strong>
                    ${(c.softwareCost / inputs.units).toFixed(2)}/unit/month
                  </strong>
                </li>
                {c.pmPaymentsCoverSoftware && (
                  <li>
                    &bull;{" "}
                    <strong className="text-green-600">
                      Payment earnings cover the software cost
                    </strong>
                  </li>
                )}
                <li>
                  &bull; Total monthly revenue with DoorStax:{" "}
                  <strong>
                    {formatCurrency(
                      c.mgmtFeeEarnings + c.totalPmPaymentEarnings
                    )}
                  </strong>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: DoorStax Perspective */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            What DoorStax Earns
          </h2>
          <p className="text-xs text-muted-foreground">
            Internal only — do not share with prospects
          </p>

          <Card className="border-border">
            <CardContent className="p-5 space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Card Revenue
              </h3>
              <Row
                label="Collected (3.25%)"
                value={formatCurrency(c.grossCardCollected)}
              />
              <Row
                label="Interchange + fees"
                value={`-${formatCurrency(c.cardCosts)}`}
                className="text-red-500"
              />
              <Row
                label="Bank share (30%)"
                value={`-${formatCurrency(c.bankShare)}`}
                className="text-amber-600"
              />
              <Row
                label="PM residual"
                value={`-${formatCurrency(c.pmCardEarnings)}`}
                className="text-purple-600"
              />
              <Row
                label="Net card revenue"
                value={formatCurrency(c.doorstaxCardNet)}
                className="text-green-600 font-bold"
                border
              />
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-5 space-y-2">
              <Row
                label={`ACH collected ($${tier.platformAchCost} × ${c.achPayments})`}
                value={formatCurrency(c.doorstaxAchCollected)}
              />
              <Row
                label="Processing ($0.50/tx)"
                value={`-${formatCurrency(c.doorstaxAchCost)}`}
                className="text-red-500"
              />
              <Row
                label="Net ACH revenue"
                value={formatCurrency(c.doorstaxAchNet)}
                className="text-green-600 font-bold"
                border
              />
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-5">
              <Row
                label="Software subscription"
                value={formatCurrency(c.doorstaxSoftware)}
                className="text-green-600 font-medium"
              />
            </CardContent>
          </Card>

          <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
            <CardContent className="p-5 space-y-1">
              <h3 className="text-sm font-semibold">
                DoorStax Net from This PM
              </h3>
              <div className="text-3xl font-bold text-green-600">
                {formatCurrency(c.doorstaxNet)}
                <span className="text-base font-normal text-muted-foreground">
                  /mo
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                ${(c.doorstaxNet / inputs.units).toFixed(2)}/unit &middot;{" "}
                {formatCurrency(c.doorstaxNet * 12)} annually
              </p>
            </CardContent>
          </Card>

          {/* Tier rate card */}
          <Card className="border-border">
            <CardContent className="p-5 space-y-2">
              <h3 className="text-sm font-semibold">Tier Rate Card</h3>
              {RESIDUAL_TIERS.map((t) => (
                <div
                  key={t.name}
                  className={`flex items-center justify-between text-sm rounded-lg p-2 ${t.name === tier.name ? "bg-primary/10 font-medium" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <Badge className={tierColor(t.name)}>{t.name}</Badge>
                    <span className="text-muted-foreground text-xs">
                      {t.minUnits}-{t.maxUnits || "\u221e"} units
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    SW: ${t.perUnitCost}/u &middot; ACH: ${t.platformAchCost}{" "}
                    &middot; Card: {(t.cardRate * 100).toFixed(2)}%
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quote generation */}
      <Card className="border-border">
        <CardContent className="p-6 space-y-4">
          <h3 className="text-base font-semibold">
            Send Quote to Prospect
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label>Prospect Name *</Label>
              <Input
                value={prospectName}
                onChange={(e) => setProspectName(e.target.value)}
                placeholder="John Smith"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={prospectEmail}
                onChange={(e) => setProspectEmail(e.target.value)}
                placeholder="john@company.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Company</Label>
              <Input
                value={prospectCompany}
                onChange={(e) => setProspectCompany(e.target.value)}
                placeholder="ABC Properties"
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handlePreviewQuote}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview PDF
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadQuote}
              disabled={!prospectName}
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button
              onClick={handleEmailQuote}
              disabled={
                !prospectName || !prospectEmail || sendingQuote
              }
            >
              {sendingQuote ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Email Quote
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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

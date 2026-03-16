"use client";

import { useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency } from "@/lib/utils";
import {
  calculateProfit,
  PRESETS,
  type CalculatorInputs,
} from "@/lib/profit-calculator";
import {
  Calculator,
  DollarSign,
  TrendingUp,
  Printer,
  BarChart3,
  Zap,
} from "lucide-react";

const DEFAULT_INPUTS: CalculatorInputs = {
  units: 200,
  avgRent: 2000,
  ...PRESETS.expected.values,
};

export function ProfitCalculator() {
  const [inputs, setInputs] = useState<CalculatorInputs>(DEFAULT_INPUTS);
  const [pmName, setPmName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  const result = useMemo(() => calculateProfit(inputs), [inputs]);

  function update(field: keyof CalculatorInputs, value: number) {
    setInputs((prev) => ({ ...prev, [field]: value }));
  }

  function applyPreset(key: keyof typeof PRESETS) {
    setInputs((prev) => ({ ...prev, ...PRESETS[key].values }));
  }

  function handlePrint() {
    window.print();
  }

  // Validation: ACH + Card must be ≤ 100
  const paymentSplitValid = inputs.achPct + inputs.cardPct <= 100;

  return (
    <div className="space-y-6 print:space-y-4" ref={printRef}>
      <div className="flex items-center justify-between print:hidden">
        <PageHeader
          title="PM Profit Calculator"
          description="Model revenue potential for property management portfolios."
        />
        <Button variant="outline" onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          Print Report
        </Button>
      </div>

      {/* Print header — only visible when printing */}
      <div className="hidden print:block text-center space-y-1 pb-4 border-b border-border">
        <h1 className="text-2xl font-bold">DoorStax Revenue Projection</h1>
        {companyName && <p className="text-lg">{companyName}</p>}
        {pmName && <p className="text-sm text-muted-foreground">Prepared for: {pmName}</p>}
        <p className="text-xs text-muted-foreground">
          {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Presets */}
      <div className="flex gap-2 print:hidden">
        {Object.entries(PRESETS).map(([key, preset]) => (
          <Button
            key={key}
            variant="outline"
            size="sm"
            onClick={() => applyPreset(key as keyof typeof PRESETS)}
            className="gap-1.5"
          >
            <Zap className="h-3.5 w-3.5" />
            {preset.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* LEFT: Inputs */}
        <div className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Portfolio Inputs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Total Units</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50000}
                    value={inputs.units}
                    onChange={(e) => update("units", Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Avg Monthly Rent ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={50}
                    value={inputs.avgRent}
                    onChange={(e) => update("avgRent", Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Occupancy %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={inputs.occupancyPct}
                    onChange={(e) => update("occupancyPct", Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Autopay Adoption %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={inputs.autopayPct}
                    onChange={(e) => update("autopayPct", Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">ACH % of Payments</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={inputs.achPct}
                    onChange={(e) => update("achPct", Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Card % of Payments</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={inputs.cardPct}
                    onChange={(e) => update("cardPct", Number(e.target.value))}
                  />
                </div>
              </div>

              {!paymentSplitValid && (
                <p className="text-xs text-destructive">
                  ACH % + Card % cannot exceed 100%
                </p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Software Cost / Unit ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={inputs.softwareCostPerUnit}
                    onChange={(e) => update("softwareCostPerUnit", Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Card Fee Rate (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.05}
                    value={inputs.cardFeeRate}
                    onChange={(e) => update("cardFeeRate", Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">ACH Spread / Tx ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={inputs.achFeePerTx}
                    onChange={(e) => update("achFeePerTx", Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Late Fee Revenue / Unit ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={inputs.lateFeePerUnit}
                    onChange={(e) => update("lateFeePerUnit", Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Ancillary Income ($/mo)</Label>
                <Input
                  type="number"
                  min={0}
                  value={inputs.ancillaryIncome}
                  onChange={(e) => update("ancillaryIncome", Number(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Report Info (print only shows, but input here) */}
          <Card className="border-border print:hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Report Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">PM Name</Label>
                <Input
                  value={pmName}
                  onChange={(e) => setPmName(e.target.value)}
                  placeholder="Property Manager Name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Company Name</Label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Company / DBA"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Results */}
        <div className="space-y-4">
          {/* Key Metrics */}
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard
              label="Monthly Net Positive"
              value={formatCurrency(result.monthlyNetRevenue)}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <MetricCard
              label="Annual Revenue"
              value={formatCurrency(result.annualNetRevenue)}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <MetricCard
              label="Software Cost Offset"
              value={`${Math.round(result.softwareCostOffset)}%`}
              icon={<BarChart3 className="h-4 w-4" />}
            />
            <MetricCard
              label="Break-Even"
              value={`${result.breakEvenUnits} units`}
              icon={<Calculator className="h-4 w-4" />}
            />
          </div>

          {/* Revenue Breakdown */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Revenue Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Occupied Units</span>
                  <span className="font-medium">{result.occupiedUnits.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Total Rent Roll</span>
                  <span className="font-medium">{formatCurrency(result.totalRentRoll)}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">
                    Card Revenue <span className="text-xs">({result.cardTxCount} tx)</span>
                  </span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(result.cardRevenue)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">
                    ACH Revenue <span className="text-xs">({result.achTxCount} tx)</span>
                  </span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(result.achRevenue)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Late Fees</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(result.lateFeeRevenue)}
                  </span>
                </div>
                {result.ancillaryRevenue > 0 && (
                  <div className="flex justify-between border-b border-border pb-2">
                    <span className="text-muted-foreground">Ancillary Income</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(result.ancillaryRevenue)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-b border-border pb-2 font-semibold">
                  <span>Monthly Gross Revenue</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(result.monthlyGrossRevenue)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border pb-2 text-destructive">
                  <span>Software Cost</span>
                  <span>-{formatCurrency(result.monthlySoftwareCost)}</span>
                </div>
                <div className="flex justify-between font-bold text-base pt-1">
                  <span>Monthly Net</span>
                  <span className={result.monthlyNetRevenue >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                    {formatCurrency(result.monthlyNetRevenue)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comparison Table */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">With vs Without DoorStax</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="pb-2 pr-4 font-medium">Metric</th>
                      <th className="pb-2 pr-4 font-medium">Without</th>
                      <th className="pb-2 pr-4 font-medium">With DoorStax</th>
                      <th className="pb-2 font-medium">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border">
                      <td className="py-2 pr-4 text-muted-foreground">Card Revenue</td>
                      <td className="py-2 pr-4">$0</td>
                      <td className="py-2 pr-4 text-emerald-600 dark:text-emerald-400 font-medium">
                        {formatCurrency(result.cardRevenue)}
                      </td>
                      <td className="py-2 text-emerald-600 dark:text-emerald-400">
                        +{formatCurrency(result.cardRevenue)}
                      </td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-2 pr-4 text-muted-foreground">ACH Revenue</td>
                      <td className="py-2 pr-4">$0</td>
                      <td className="py-2 pr-4 text-emerald-600 dark:text-emerald-400 font-medium">
                        {formatCurrency(result.achRevenue)}
                      </td>
                      <td className="py-2 text-emerald-600 dark:text-emerald-400">
                        +{formatCurrency(result.achRevenue)}
                      </td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-2 pr-4 text-muted-foreground">Late Fee Revenue</td>
                      <td className="py-2 pr-4">$0</td>
                      <td className="py-2 pr-4 text-emerald-600 dark:text-emerald-400 font-medium">
                        {formatCurrency(result.lateFeeRevenue)}
                      </td>
                      <td className="py-2 text-emerald-600 dark:text-emerald-400">
                        +{formatCurrency(result.lateFeeRevenue)}
                      </td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-2 pr-4 text-muted-foreground">Software Cost</td>
                      <td className="py-2 pr-4">$0</td>
                      <td className="py-2 pr-4 text-destructive">
                        -{formatCurrency(result.monthlySoftwareCost)}
                      </td>
                      <td className="py-2 text-destructive">
                        -{formatCurrency(result.monthlySoftwareCost)}
                      </td>
                    </tr>
                    <tr className="font-bold">
                      <td className="py-2 pr-4">Net Monthly</td>
                      <td className="py-2 pr-4">$0</td>
                      <td className={`py-2 pr-4 ${result.monthlyNetRevenue >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                        {formatCurrency(result.monthlyNetRevenue)}
                      </td>
                      <td className={`py-2 ${result.monthlyNetRevenue >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                        {result.monthlyNetRevenue >= 0 ? "+" : ""}{formatCurrency(result.monthlyNetRevenue)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Summary Card */}
          <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Badge
                  variant="outline"
                  className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
                >
                  Projection Summary
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Monthly Revenue</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(result.monthlyGrossRevenue)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Annual Projection</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(result.annualNetRevenue)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Cost Offset</p>
                  <p className="text-lg font-bold">
                    {Math.round(result.softwareCostOffset)}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Revenue Being Missed</p>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                    {formatCurrency(result.monthlyGrossRevenue)}/mo
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

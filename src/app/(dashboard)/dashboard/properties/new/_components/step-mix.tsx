"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { Info } from "lucide-react";
import type { WizardState } from "../_lib/wizard-state";

interface StepMixProps {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  errors: Record<string, string>;
}

export function StepMix({ state, update, errors }: StepMixProps) {
  const hasCommercial = Number(state.commercialUnitCount || 0) > 0;

  return (
    <div className="space-y-5 rounded-xl border bg-card p-6">
      <div>
        <h2 className="text-lg font-semibold">Unit mix &amp; compliance</h2>
        <p className="text-sm text-muted-foreground">
          How many units and of what kinds. Subsidized / commercial mix
          matters for both underwriting and compliance.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="residentialUnitCount">Residential units *</Label>
          <NumericInput
            id="residentialUnitCount"
            value={state.residentialUnitCount}
            onChange={(v) => update({ residentialUnitCount: v })}
            placeholder="e.g. 12"
          />
          {errors.residentialUnitCount && (
            <p className="text-xs text-destructive">
              {errors.residentialUnitCount}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="commercialUnitCount">Commercial units</Label>
          <NumericInput
            id="commercialUnitCount"
            value={state.commercialUnitCount}
            onChange={(v) => update({ commercialUnitCount: v })}
            placeholder="e.g. 2 (ground-floor retail)"
          />
        </div>
      </div>

      {hasCommercial && (
        <div className="space-y-2">
          <Label htmlFor="commercialFloors">
            Floor(s) with commercial units
          </Label>
          <Input
            id="commercialFloors"
            value={state.commercialFloors}
            onChange={(e) => update({ commercialFloors: e.target.value })}
            placeholder="e.g. 1 (or 1,2 if on multiple floors)"
          />
          <p className="text-[11px] text-muted-foreground">
            Comma-separated floor numbers. Helps underwriters understand
            mixed-use zoning.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="section8UnitCount">
          Section 8 / subsidized unit count
        </Label>
        <NumericInput
          id="section8UnitCount"
          value={state.section8UnitCount}
          onChange={(v) => update({ section8UnitCount: v })}
          placeholder="Enter 0 if none"
        />
        {errors.section8UnitCount && (
          <p className="text-xs text-destructive">{errors.section8UnitCount}</p>
        )}
        {Number(state.section8UnitCount || 0) > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-700 dark:text-blue-400">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>
              Subsidized units are subject to HUD inspection schedules. The
              underwriter may ask for HAP contract and annual inspection
              report in the Documents step.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="zoning">Zoning</Label>
          <Input
            id="zoning"
            value={state.zoning}
            onChange={(e) => update({ zoning: e.target.value })}
            placeholder="e.g. R-6, C-4-6, etc."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="parcelNumber">Parcel number (APN)</Label>
          <Input
            id="parcelNumber"
            value={state.parcelNumber}
            onChange={(e) => update({ parcelNumber: e.target.value })}
            placeholder="e.g. 01234-5678"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="annualPropertyTax">Annual property tax</Label>
        <NumericInput
          id="annualPropertyTax"
          decimal
          value={state.annualPropertyTax}
          onChange={(v) => update({ annualPropertyTax: v })}
          placeholder="e.g. 18000"
        />
      </div>
    </div>
  );
}

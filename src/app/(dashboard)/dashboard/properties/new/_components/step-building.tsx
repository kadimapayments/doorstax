"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WizardState } from "../_lib/wizard-state";

interface StepBuildingProps {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  errors: Record<string, string>;
}

const CONSTRUCTION_OPTS = [
  { value: "BRICK", label: "Brick" },
  { value: "WOOD_FRAME", label: "Wood frame" },
  { value: "CONCRETE", label: "Concrete" },
  { value: "MIXED", label: "Mixed" },
];

const PARKING_OPTS = [
  { value: "STREET", label: "Street only" },
  { value: "ONSITE", label: "On-site lot" },
  { value: "COVERED", label: "Covered" },
  { value: "GARAGE", label: "Garage" },
  { value: "MIXED", label: "Mixed" },
];

export function StepBuilding({ state, update, errors }: StepBuildingProps) {
  return (
    <div className="space-y-5 rounded-xl border bg-card p-6">
      <div>
        <h2 className="text-lg font-semibold">Building profile</h2>
        <p className="text-sm text-muted-foreground">
          Physical characteristics of the structure. Used by underwriters to
          assess the risk profile.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="yearBuilt">Year built *</Label>
          <Input
            id="yearBuilt"
            type="number"
            min="1700"
            max={new Date().getFullYear() + 5}
            value={state.yearBuilt}
            onChange={(e) => update({ yearBuilt: e.target.value })}
            placeholder="e.g. 1978"
          />
          {errors.yearBuilt && (
            <p className="text-xs text-destructive">{errors.yearBuilt}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="totalSqft">Total sqft *</Label>
          <Input
            id="totalSqft"
            type="number"
            min="1"
            value={state.totalSqft}
            onChange={(e) => update({ totalSqft: e.target.value })}
            placeholder="e.g. 18000"
          />
          {errors.totalSqft && (
            <p className="text-xs text-destructive">{errors.totalSqft}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="storyCount">Stories *</Label>
          <Input
            id="storyCount"
            type="number"
            min="1"
            value={state.storyCount}
            onChange={(e) => update({ storyCount: e.target.value })}
            placeholder="e.g. 4"
          />
          {errors.storyCount && (
            <p className="text-xs text-destructive">{errors.storyCount}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <YesNoField
          label="Elevator on premises"
          value={state.hasElevator}
          onChange={(v) => update({ hasElevator: v })}
        />
        <YesNoField
          label="On-site laundry"
          value={state.hasOnsiteLaundry}
          onChange={(v) => update({ hasOnsiteLaundry: v })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="constructionType">Construction type *</Label>
        <select
          id="constructionType"
          value={state.constructionType}
          onChange={(e) =>
            update({
              constructionType: e.target
                .value as WizardState["constructionType"],
            })
          }
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Select…</option>
          {CONSTRUCTION_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {errors.constructionType && (
          <p className="text-xs text-destructive">{errors.constructionType}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="parkingSpaces">Parking spaces *</Label>
          <Input
            id="parkingSpaces"
            type="number"
            min="0"
            value={state.parkingSpaces}
            onChange={(e) => update({ parkingSpaces: e.target.value })}
            placeholder="e.g. 12"
          />
          {errors.parkingSpaces && (
            <p className="text-xs text-destructive">{errors.parkingSpaces}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="parkingType">Parking type *</Label>
          <select
            id="parkingType"
            value={state.parkingType}
            onChange={(e) =>
              update({
                parkingType: e.target.value as WizardState["parkingType"],
              })
            }
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select…</option>
            {PARKING_OPTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {errors.parkingType && (
            <p className="text-xs text-destructive">{errors.parkingType}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function YesNoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={
            "flex-1 rounded-md border px-3 py-2 text-sm transition-colors " +
            (value === true
              ? "border-primary bg-primary/10 text-primary font-medium"
              : "bg-background hover:bg-muted/30")
          }
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={
            "flex-1 rounded-md border px-3 py-2 text-sm transition-colors " +
            (value === false
              ? "border-primary bg-primary/10 text-primary font-medium"
              : "bg-background hover:bg-muted/30")
          }
        >
          No
        </button>
      </div>
    </div>
  );
}

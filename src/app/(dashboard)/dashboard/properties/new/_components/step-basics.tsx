"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { ImageUpload } from "@/components/ui/image-upload";
import type { WizardState } from "../_lib/wizard-state";

interface StepBasicsProps {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  errors: Record<string, string>;
}

export function StepBasics({ state, update, errors }: StepBasicsProps) {
  return (
    <div className="space-y-5 rounded-xl border bg-card p-6">
      <div>
        <h2 className="text-lg font-semibold">Basics</h2>
        <p className="text-sm text-muted-foreground">
          Where is the property and what is it?
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Property name *</Label>
        <Input
          id="name"
          value={state.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="e.g. Sunset Apartments"
          required
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Street address *</Label>
        <AddressAutocomplete
          id="address"
          value={state.address}
          onChange={(val) => update({ address: val })}
          onSelect={(c) =>
            update({
              address: c.street,
              city: c.city || state.city,
              state: c.state || state.state,
              zip: c.zip || state.zip,
            })
          }
          placeholder="Start typing property address…"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        {errors.address && (
          <p className="text-xs text-destructive">{errors.address}</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="city">City *</Label>
          <Input
            id="city"
            value={state.city}
            onChange={(e) => update({ city: e.target.value })}
            required
          />
          {errors.city && (
            <p className="text-xs text-destructive">{errors.city}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State *</Label>
          <Input
            id="state"
            maxLength={2}
            value={state.state}
            onChange={(e) => update({ state: e.target.value.toUpperCase() })}
            placeholder="CA"
            required
          />
          {errors.state && (
            <p className="text-xs text-destructive">{errors.state}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="zip">ZIP *</Label>
          <Input
            id="zip"
            value={state.zip}
            onChange={(e) => update({ zip: e.target.value })}
            placeholder="90210"
            required
          />
          {errors.zip && (
            <p className="text-xs text-destructive">{errors.zip}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="propertyType">Property type *</Label>
        <select
          id="propertyType"
          value={state.propertyType}
          onChange={(e) =>
            update({
              propertyType: e.target.value as WizardState["propertyType"],
            })
          }
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="SINGLE_FAMILY">Single Family</option>
          <option value="MULTIFAMILY">Multifamily</option>
          <option value="OFFICE">Office</option>
          <option value="COMMERCIAL">Commercial</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="purchasePrice">Purchase price</Label>
          <Input
            id="purchasePrice"
            type="number"
            step="0.01"
            min="0"
            value={state.purchasePrice}
            onChange={(e) => update({ purchasePrice: e.target.value })}
            placeholder="e.g. 500000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="purchaseDate">Purchase date</Label>
          <Input
            id="purchaseDate"
            type="date"
            value={state.purchaseDate}
            onChange={(e) => update({ purchaseDate: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={state.description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="Brief description…"
        />
      </div>

      <ImageUpload
        images={state.photos}
        onChange={(photos) => update({ photos })}
        folder="properties"
        label="Exterior photos"
      />
    </div>
  );
}

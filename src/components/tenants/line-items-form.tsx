"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface LineItem {
  description: string;
  amount: number;
  type: "RENT" | "DEPOSIT" | "FEE" | "APPLICATION";
}

interface LineItemsFormProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  defaultRentAmount?: number;
}

const TYPE_OPTIONS: { value: LineItem["type"]; label: string }[] = [
  { value: "RENT", label: "Rent" },
  { value: "DEPOSIT", label: "Deposit" },
  { value: "FEE", label: "Fee" },
  { value: "APPLICATION", label: "Application" },
];

export function LineItemsForm({
  items,
  onChange,
  defaultRentAmount,
}: LineItemsFormProps) {
  const [enabled, setEnabled] = useState(items.length > 0);

  function handleToggle(checked: boolean) {
    setEnabled(checked);
    if (checked && items.length === 0) {
      // Pre-populate with first month rent
      onChange([
        {
          description: "First Month Rent",
          amount: defaultRentAmount || 0,
          type: "RENT",
        },
      ]);
    } else if (!checked) {
      onChange([]);
    }
  }

  function updateItem(index: number, updates: Partial<LineItem>) {
    const next = items.map((item, i) =>
      i === index ? { ...item, ...updates } : item
    );
    onChange(next);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function addItem() {
    onChange([...items, { description: "", amount: 0, type: "FEE" }]);
  }

  const total = items.reduce((sum, item) => sum + (item.amount || 0), 0);

  return (
    <div className="rounded-lg border border-border p-4 space-y-4">
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => handleToggle(e.target.checked)}
          className="rounded"
        />
        <div>
          <span className="text-sm font-medium">
            Add charges for first invoice
          </span>
          <p className="text-xs text-muted-foreground">
            Optionally create rent, deposits, or fees when adding this tenant.
          </p>
        </div>
      </label>

      {enabled && (
        <div className="space-y-3 pt-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                {index === 0 && (
                  <Label className="text-xs">Description</Label>
                )}
                <Input
                  value={item.description}
                  onChange={(e) =>
                    updateItem(index, { description: e.target.value })
                  }
                  placeholder="e.g. First Month Rent"
                  className="text-sm"
                />
              </div>
              <div className="w-28 space-y-1">
                {index === 0 && <Label className="text-xs">Amount</Label>}
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={item.amount || ""}
                  onChange={(e) =>
                    updateItem(index, {
                      amount: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0.00"
                  className="text-sm"
                />
              </div>
              <div className="w-32 space-y-1">
                {index === 0 && <Label className="text-xs">Type</Label>}
                <Select
                  value={item.type}
                  onValueChange={(v) =>
                    updateItem(index, { type: v as LineItem["type"] })
                  }
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeItem(index)}
                className="shrink-0 h-9 w-9 text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="flex items-center justify-between pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addItem}
              className="text-xs"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Line Item
            </Button>
            {items.length > 0 && (
              <p className="text-sm font-medium">
                Total: {formatCurrency(total)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

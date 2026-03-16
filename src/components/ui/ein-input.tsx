"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

/** Strip to digits, cap at 9, format as XX-XXXXXXX */
export function formatEin(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

/** Strip formatted EIN back to digits only */
export function stripEin(value: string): string {
  return value.replace(/\D/g, "");
}

type EinInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "onChange"
> & {
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (formatted: string) => void;
};

export const EinInput = React.forwardRef<HTMLInputElement, EinInputProps>(
  ({ onChange, onValueChange, ...props }, ref) => {
    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const formatted = formatEin(e.target.value);
      e.target.value = formatted;
      onChange?.(e);
      onValueChange?.(formatted);
    }

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        placeholder="XX-XXXXXXX"
        maxLength={10}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
EinInput.displayName = "EinInput";

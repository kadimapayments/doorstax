"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

/** Strip to digits, then format as (XXX) XXX-XXXX */
export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Strip formatted phone back to digits only */
export function stripPhone(value: string): string {
  return value.replace(/\D/g, "");
}

type PhoneInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "onChange"
> & {
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (formatted: string) => void;
};

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ onChange, onValueChange, ...props }, ref) => {
    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const formatted = formatPhoneNumber(e.target.value);
      // Update the native input value so controlled components see the formatted string
      e.target.value = formatted;
      onChange?.(e);
      onValueChange?.(formatted);
    }

    return (
      <Input
        ref={ref}
        type="tel"
        placeholder="(555) 123-4567"
        onChange={handleChange}
        {...props}
      />
    );
  }
);
PhoneInput.displayName = "PhoneInput";

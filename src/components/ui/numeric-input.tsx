"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

interface NumericInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  /** Current value as a string. Use "" for "empty", never "0" by default. */
  value: string;
  /** Called with the new string. Empty means the field is blank. */
  onChange: (next: string) => void;
  /** If true, allow decimal input. Default: false (integers only). */
  decimal?: boolean;
  /** If true, select-all on focus so typing replaces. Default: true. */
  selectOnFocus?: boolean;
}

/**
 * NumericInput — a small wrapper over `<input>` that fixes the "leading
 * zero won't disappear" bug that's all over the app.
 *
 * Symptoms of the bug the native `<input type="number">` causes when
 * you initialize state to `0` / `"0"`:
 *   - user sees "0" in the field
 *   - user types "5" expecting "5"
 *   - browser renders "05"
 *   - user has to manually delete the "0"
 *
 * Root cause: the app was using number-typed state that coerces an
 * empty field back to 0 on every render. This component keeps the
 * value as a string ("" means empty), never renders "0" unless the
 * user explicitly typed it, and select-all's on focus so starting to
 * type always replaces.
 *
 * Use this for ANY numeric field where the natural "empty" state is
 * "no value yet" rather than "zero." Currency, unit counts, sqft,
 * year built, etc. It is not a replacement for true zero-valued
 * inputs like percent sliders.
 */
export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  function NumericInput(
    { value, onChange, decimal = false, selectOnFocus = true, ...rest },
    ref
  ) {
    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;

        // Allow clearing completely.
        if (raw === "") {
          onChange("");
          return;
        }

        // Strip anything that isn't a digit (or a single decimal point
        // when decimal=true). Also allow a leading "-" in case we ever
        // need negative numbers — currently all our use-cases are >= 0
        // but future-proofing.
        const allowedPattern = decimal ? /[^0-9.]/g : /[^0-9]/g;
        let cleaned = raw.replace(allowedPattern, "");

        // Collapse multiple decimal points.
        if (decimal) {
          const firstDot = cleaned.indexOf(".");
          if (firstDot !== -1) {
            cleaned =
              cleaned.slice(0, firstDot + 1) +
              cleaned.slice(firstDot + 1).replace(/\./g, "");
          }
        }

        // Drop a leading "0" if a non-zero digit follows (so "05" → "5").
        // This is the key fix — it handles the case where state was
        // initialised to "0" and the user starts typing.
        if (cleaned.length > 1 && cleaned.startsWith("0") && cleaned[1] !== ".") {
          cleaned = cleaned.replace(/^0+/, "") || "0";
        }

        onChange(cleaned);
      },
      [onChange, decimal]
    );

    const handleFocus = React.useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        if (selectOnFocus) {
          // Defer so the click-to-place-cursor doesn't undo the selection.
          requestAnimationFrame(() => {
            try {
              e.target.select();
            } catch {
              // ignore (select() can throw on detached inputs)
            }
          });
        }
        rest.onFocus?.(e);
      },
      [rest, selectOnFocus]
    );

    return (
      <Input
        ref={ref}
        type="text"
        inputMode={decimal ? "decimal" : "numeric"}
        pattern={decimal ? "[0-9]*[.]?[0-9]*" : "[0-9]*"}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        {...rest}
      />
    );
  }
);

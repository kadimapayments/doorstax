/**
 * Display-layer formatters.
 *
 * This file is the single place we keep “how numbers look to a human.”
 * It is safe to import on both server (PDF generators, API responses)
 * and client (React components) — no browser APIs, no Prisma types.
 *
 * Do NOT use these for parsing or for storage. `formatPhoneE164()` in
 * `src/lib/kadima/phone.ts` is the E.164 canonicalizer; this file
 * handles the inverse (E.164 / raw digits → "(212) 555-1234").
 */

/**
 * Format a phone number for display as "(xxx) xxx-xxxx" or
 * "+n (xxx) xxx-xxxx" for international numbers. Accepts E.164,
 * raw 10-digit, or partially-typed input; returns "—" when it can't
 * make sense of it.
 *
 *   "+12125551234"     → "(212) 555-1234"
 *   "2125551234"       → "(212) 555-1234"
 *   "(212) 555-1234"   → "(212) 555-1234"
 *   "+442071838750"    → "+44 2071838750"   (non-NANP passes through clean)
 *   null / ""          → "—"
 */
export function formatPhoneDisplay(
  raw: string | null | undefined,
  fallback = "—"
): string {
  if (!raw) return fallback;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return fallback;

  // NANP (North American) — 10 digits, or 11 starting with 1
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }

  // Non-NANP — keep the + prefix and group the rest lightly
  if (String(raw).startsWith("+") && digits.length > 8) {
    return `+${digits.slice(0, digits.length - 10)} ${digits.slice(-10)}`;
  }

  // Fallback: return digits as-is, don't mangle something exotic
  return digits;
}

/**
 * Format a dollar amount as "$1,234.56". Two decimal places always.
 * Accepts string | number | Decimal-ish object with `.toString()`.
 *
 *   1234 → "$1,234.00"
 *   "1234.5" → "$1,234.50"
 *   null → "—"
 */
export function formatMoneyDisplay(
  v: string | number | null | undefined,
  fallback = "—"
): string {
  if (v === null || v === undefined || v === "") return fallback;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format an integer count with thousand separators.
 *
 *   1234 → "1,234"
 *   null → "—"
 */
export function formatCount(
  v: number | null | undefined,
  fallback = "—"
): string {
  if (v === null || v === undefined) return fallback;
  return v.toLocaleString("en-US");
}

/**
 * Format square footage as "12,345 sqft".
 */
export function formatSqft(
  v: number | null | undefined,
  fallback = "—"
): string {
  if (v === null || v === undefined) return fallback;
  return `${v.toLocaleString("en-US")} sqft`;
}

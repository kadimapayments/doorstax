/**
 * Format a phone number to E.164 format.
 * Kadima requires E.164 (e.g. +18187740010).
 *
 *  - 10 digits → +1{digits}  (US number)
 *  - 11 digits starting with 1 → +{digits}
 *  - Already has + → keep as-is
 *  - Otherwise → return undefined (don't send invalid phone)
 */
export function formatPhoneE164(phone: string | undefined | null): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.startsWith("+") && digits.length >= 10) return phone;
  // Can't reliably format — omit to avoid Kadima rejection
  console.warn(`[kadima] Cannot format phone to E.164: "${phone}", omitting`);
  return undefined;
}

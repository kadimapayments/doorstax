import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Receipt-number generator for offline (cash / check) payments.
 *
 * Numbers are landlord-scoped: each PM has their own monotonic sequence
 * stored on `User.nextReceiptSequence`, formatted with `User.receiptPrefix`
 * (defaults to "RECEIPT" when unset). Two PMs can issue the same numeric
 * sequence and never collide because of the schema-level
 * `@@unique([landlordId, receiptNumber])` constraint.
 *
 * The reservation is atomic: Postgres handles row-level locking on the
 * User row when Prisma issues `{ increment: 1 }`. Two concurrent calls
 * produce two distinct numbers, never a duplicate.
 */

/**
 * Atomically reserve the next receipt number for a landlord. MUST be
 * called inside the same transaction that creates the Payment row —
 * if Payment.create rolls back after this runs, Postgres rolls back
 * the increment too, keeping the sequence contiguous.
 *
 * @param tx          — the Prisma transaction client
 * @param landlordId  — the PM (User.id) the receipt belongs to
 * @returns           — formatted receipt number, e.g. "MORRISON-1001"
 */
export async function reserveReceiptNumber(
  tx: Prisma.TransactionClient,
  landlordId: string
): Promise<string> {
  const updated = await tx.user.update({
    where: { id: landlordId },
    data: { nextReceiptSequence: { increment: 1 } },
    select: { receiptPrefix: true, nextReceiptSequence: true },
  });
  // After increment, nextReceiptSequence is the *next* one to issue;
  // the value we just reserved is (newValue - 1).
  const reserved = updated.nextReceiptSequence - 1;
  const prefix = (updated.receiptPrefix?.trim() || "RECEIPT").toUpperCase();
  return `${prefix}-${reserved}`;
}

/**
 * Validate a receipt prefix string before saving it. Used by the
 * PM-facing receipt-settings card.
 *
 * Rules:
 *   - 1–20 chars
 *   - alphanumeric + hyphen + underscore only (uppercased on display)
 *   - no leading / trailing whitespace (we trim before validating)
 *   - cannot start with a digit (so receipts always read as
 *     "<word>-<number>", never ambiguous "<number>-<number>")
 */
export function validateReceiptPrefix(
  raw: string
): { ok: true; value: string } | { ok: false; reason: string } {
  const value = (raw || "").trim();
  if (value.length === 0) {
    return { ok: false, reason: "Prefix cannot be empty" };
  }
  if (value.length > 20) {
    return { ok: false, reason: "Prefix must be 20 characters or fewer" };
  }
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(value)) {
    return {
      ok: false,
      reason:
        "Prefix must start with a letter and contain only letters, numbers, hyphens, or underscores",
    };
  }
  return { ok: true, value: value.toUpperCase() };
}

/**
 * Set the next-receipt-sequence to a specific number. Used for
 * one-time migration when a PM is moving from another platform
 * and wants to continue their existing numbering.
 *
 * Refuses to set the sequence BACKWARDS — once you've issued
 * "MORRISON-1500", you can't reset to 1000 because that risks
 * colliding with previously-issued numbers (and the unique
 * constraint would block the duplicate at write time anyway).
 */
export async function setReceiptStartSequence(
  landlordId: string,
  sequence: number
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!Number.isInteger(sequence) || sequence < 1) {
    return { ok: false, reason: "Sequence must be a positive integer" };
  }

  const current = await db.user.findUnique({
    where: { id: landlordId },
    select: { nextReceiptSequence: true },
  });
  if (!current) {
    return { ok: false, reason: "User not found" };
  }
  if (sequence < current.nextReceiptSequence) {
    return {
      ok: false,
      reason: `Cannot reset sequence backwards (current next: ${current.nextReceiptSequence})`,
    };
  }

  await db.user.update({
    where: { id: landlordId },
    data: { nextReceiptSequence: sequence },
  });
  return { ok: true };
}

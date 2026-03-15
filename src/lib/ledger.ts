import { db } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import type { Prisma, LedgerEntry } from "@prisma/client";

const ZERO = new Decimal(0);

/**
 * Get the latest balance for a tenant by reading the most recent ledger entry.
 * Returns Decimal(0) if no entries exist.
 */
export async function getLatestBalance(
  tenantId: string,
  tx?: Prisma.TransactionClient
): Promise<Decimal> {
  const client = tx ?? db;
  const latest = await client.ledgerEntry.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: { balanceAfter: true },
  });
  return latest?.balanceAfter ?? ZERO;
}

/**
 * Derive a period key ("YYYY-MM") from a Date.
 */
export function periodKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Write helpers (all use serializable transactions) ──────

/**
 * Create a CHARGE entry (tenant owes more).
 * Idempotent: skips if a CHARGE already exists for this tenant+period.
 */
export async function createChargeEntry(opts: {
  tenantId: string;
  unitId: string;
  amount: number | Decimal;
  periodKey: string;
  description?: string;
  createdById?: string;
}): Promise<LedgerEntry | null> {
  try {
    return await db.$transaction(
      async (tx) => {
        // Check for existing charge (idempotency)
        // Note: @@unique constraint doesn't enforce for NULL paymentId in PostgreSQL,
        // so we do an explicit check within the serializable transaction
        const existing = await tx.ledgerEntry.findFirst({
          where: {
            tenantId: opts.tenantId,
            periodKey: opts.periodKey,
            type: "CHARGE",
            paymentId: null,
          },
        });
        if (existing) return null; // Already charged

        const prevBalance = await getLatestBalance(opts.tenantId, tx);
        const amount = new Decimal(opts.amount.toString());
        const balanceAfter = prevBalance.plus(amount);

        return tx.ledgerEntry.create({
          data: {
            tenantId: opts.tenantId,
            unitId: opts.unitId,
            type: "CHARGE",
            amount,
            balanceAfter,
            periodKey: opts.periodKey,
            description: opts.description ?? null,
            paymentId: null,
            createdById: opts.createdById ?? null,
            locked: true,
          },
        });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (err) {
    // P2002 = unique constraint violation (already exists)
    if ((err as { code?: string }).code === "P2002") return null;
    console.error("[ledger] Failed to create charge entry:", err);
    return null;
  }
}

/**
 * Record a PAYMENT entry (tenant balance decreases).
 * Links to a Payment record via paymentId.
 */
export async function recordPayment(opts: {
  tenantId: string;
  unitId: string;
  paymentId: string;
  amount: number | Decimal;
  periodKey: string;
  description?: string;
}): Promise<LedgerEntry | null> {
  try {
    return await db.$transaction(
      async (tx) => {
        const prevBalance = await getLatestBalance(opts.tenantId, tx);
        const amount = new Decimal(opts.amount.toString());
        const balanceAfter = prevBalance.minus(amount);

        return tx.ledgerEntry.create({
          data: {
            tenantId: opts.tenantId,
            unitId: opts.unitId,
            type: "PAYMENT",
            amount: amount.negated(), // Negative = credit
            balanceAfter,
            periodKey: opts.periodKey,
            description: opts.description ?? "Payment received",
            paymentId: opts.paymentId,
            locked: true,
          },
        });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return null;
    console.error("[ledger] Failed to record payment:", err);
    return null;
  }
}

/**
 * Record a REVERSAL entry (balance goes back up after refund).
 * Links to the same Payment record that was refunded.
 */
export async function recordReversal(opts: {
  tenantId: string;
  unitId: string;
  paymentId: string;
  amount: number | Decimal;
  periodKey: string;
  reason?: string;
}): Promise<LedgerEntry | null> {
  try {
    return await db.$transaction(
      async (tx) => {
        const prevBalance = await getLatestBalance(opts.tenantId, tx);
        const amount = new Decimal(opts.amount.toString());
        const balanceAfter = prevBalance.plus(amount);

        return tx.ledgerEntry.create({
          data: {
            tenantId: opts.tenantId,
            unitId: opts.unitId,
            type: "REVERSAL",
            amount, // Positive = debit (owed again)
            balanceAfter,
            periodKey: opts.periodKey,
            description: opts.reason ? `Reversal: ${opts.reason}` : "Payment reversed",
            paymentId: opts.paymentId,
            metadata: opts.reason ? { reason: opts.reason } : undefined,
            locked: true,
          },
        });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return null;
    console.error("[ledger] Failed to record reversal:", err);
    return null;
  }
}

/**
 * Create an ADJUSTMENT entry (positive = tenant owes more, negative = credit).
 * Used for manual corrections by PM/admin.
 */
export async function createAdjustment(opts: {
  tenantId: string;
  unitId: string;
  amount: number | Decimal;
  periodKey: string;
  description: string;
  createdById: string;
}): Promise<LedgerEntry | null> {
  try {
    return await db.$transaction(
      async (tx) => {
        const prevBalance = await getLatestBalance(opts.tenantId, tx);
        const amount = new Decimal(opts.amount.toString());
        const balanceAfter = prevBalance.plus(amount);

        return tx.ledgerEntry.create({
          data: {
            tenantId: opts.tenantId,
            unitId: opts.unitId,
            type: "ADJUSTMENT",
            amount,
            balanceAfter,
            periodKey: opts.periodKey,
            description: opts.description,
            createdById: opts.createdById,
            metadata: { adjustedBy: opts.createdById },
            locked: true,
          },
        });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (err) {
    console.error("[ledger] Failed to create adjustment:", err);
    return null;
  }
}

/**
 * Get all ledger entries for a tenant, ordered chronologically.
 */
export async function getLedgerForTenant(tenantId: string): Promise<LedgerEntry[]> {
  return db.ledgerEntry.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  });
}

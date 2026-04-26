export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveApiLandlord } from "@/lib/api-landlord";

/**
 * POST /api/accounting/backfill-payments
 *
 * Retroactively journals every COMPLETED payment for the requesting
 * landlord that doesn't yet have a JournalEntry. Used to repair the
 * accounting ledger after the synchronous hook was missing for a
 * stretch (e.g. cash receipts before the hook was wired).
 *
 * Idempotent — `journalIncomingPayment` dedupes via
 * `alreadyJournaled(pmId, source, sourceId)`. Calling this twice on
 * the same Payment row is a no-op the second time.
 *
 * Lookback window defaults to 180 days (covers the longest plausible
 * gap). Pass `?days=N` to override.
 */
export async function POST(req: NextRequest) {
  const ctx = await resolveApiLandlord();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const daysParam = req.nextUrl.searchParams.get("days");
  const days = daysParam ? Math.max(1, Math.min(720, Number(daysParam))) : 180;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Seed accounts once before the loop so journal writes don't race.
  try {
    const { seedDefaultAccounts } = await import(
      "@/lib/accounting/chart-of-accounts"
    );
    await seedDefaultAccounts(ctx.landlordId);
  } catch (err) {
    console.error("[backfill] seedDefaultAccounts failed:", err);
    return NextResponse.json(
      { error: "Failed to seed chart of accounts" },
      { status: 500 }
    );
  }

  const candidates = await db.payment.findMany({
    where: {
      landlordId: ctx.landlordId,
      status: "COMPLETED",
      paidAt: { gte: since, not: null },
    },
    select: { id: true, type: true, amount: true, paidAt: true },
    orderBy: { paidAt: "asc" },
  });

  const { journalIncomingPayment } = await import(
    "@/lib/accounting/auto-entries"
  );

  let journaled = 0;
  let skipped = 0;
  const errors: Array<{ paymentId: string; error: string }> = [];

  for (const p of candidates) {
    try {
      const result = await journalIncomingPayment(p.id);
      if (result) {
        journaled += 1;
      } else {
        // null return = either already-journaled (dedup hit) or not
        // COMPLETED. Either way it's a no-op for this payment.
        skipped += 1;
      }
    } catch (err) {
      errors.push({
        paymentId: p.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: candidates.length,
    journaled,
    skipped,
    errors,
    sinceDays: days,
  });
}

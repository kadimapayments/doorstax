export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET|POST /api/cron/journal-payments-backfill
 *
 * Nightly safety net — finds COMPLETED payments from the last 7 days
 * that don't yet have a JournalEntry and runs `journalIncomingPayment`
 * on each. Catches any synchronous-hook misses (transient errors,
 * edge timing on deploys, etc.).
 *
 * Idempotent — the helper dedupes via alreadyJournaled. Running this
 * cron daily on the same dataset is harmless.
 *
 * Auth: Vercel cron header OR `Authorization: Bearer <CRON_SECRET>`.
 */

function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron")) return true;
  const auth = req.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sinceDaysParam = req.nextUrl.searchParams.get("days");
  const days = sinceDaysParam
    ? Math.max(1, Math.min(720, Number(sinceDaysParam)))
    : 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Group payments by landlordId so each PM's chart-of-accounts is
  // seeded once. Also collects all candidates in one query.
  const candidates = await db.payment.findMany({
    where: {
      status: "COMPLETED",
      paidAt: { gte: since, not: null },
    },
    select: { id: true, landlordId: true },
    orderBy: { paidAt: "asc" },
  });

  if (candidates.length === 0) {
    return NextResponse.json({
      ok: true,
      scanned: 0,
      journaled: 0,
      sinceDays: days,
    });
  }

  const byLandlord = new Map<string, string[]>();
  for (const p of candidates) {
    if (!byLandlord.has(p.landlordId)) byLandlord.set(p.landlordId, []);
    byLandlord.get(p.landlordId)!.push(p.id);
  }

  const { seedDefaultAccounts } = await import(
    "@/lib/accounting/chart-of-accounts"
  );
  const { journalIncomingPayment } = await import(
    "@/lib/accounting/auto-entries"
  );

  let journaled = 0;
  let skipped = 0;
  const errors: Array<{ paymentId: string; error: string }> = [];

  for (const [landlordId, paymentIds] of byLandlord) {
    try {
      await seedDefaultAccounts(landlordId);
    } catch (err) {
      console.error(
        "[journal-backfill] seedDefaultAccounts failed for",
        landlordId,
        err
      );
      continue;
    }
    for (const paymentId of paymentIds) {
      try {
        const result = await journalIncomingPayment(paymentId);
        if (result) journaled += 1;
        else skipped += 1;
      } catch (err) {
        errors.push({
          paymentId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: candidates.length,
    journaled,
    skipped,
    errors,
    landlords: byLandlord.size,
    sinceDays: days,
  });
}

export const GET = handle;
export const POST = handle;

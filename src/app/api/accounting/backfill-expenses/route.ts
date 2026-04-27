export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveApiLandlord } from "@/lib/api-landlord";

/**
 * POST /api/accounting/backfill-expenses
 *
 * Repairs the expense → accounting pipeline for the requesting
 * landlord. Three classes of bugs this cleans up:
 *
 *   1. **Wrong-account journal entries** — every expense that hit
 *      /api/expenses before the category-mapping fix journaled to
 *      account 5000 Repairs & Maintenance regardless of category.
 *      A $65k property tax expense ended up in maintenance.
 *
 *   2. **Missing journal entries** — three callsites created Expense
 *      rows without journaling at all:
 *        - recurring-expenses cron
 *        - vendor-invoice approval
 *        - payout-generator platform fees
 *      Those expenses never appeared in accounting.
 *
 *   3. **Missing accounts** — MORTGAGE / PAYROLL / UPGRADES had no
 *      target account in the chart, would have fallen to 5999 Misc.
 *      Now seeded as 5250, 5850, 5050.
 *
 * Algorithm per expense:
 *   - Compute expected account code from category.
 *   - If no journal entry exists → create one.
 *   - If entry exists but EXPENSE-line account ≠ expected → delete +
 *     recreate (auto-generated entries don't need a reversal audit
 *     trail since they were never user-edited).
 *   - If entry exists and correct → skip.
 *
 * Idempotent — run multiple times safely. Pass `?days=N` to limit
 * the lookback window (default = no limit, scans every expense for
 * the landlord). Pass `?dryRun=true` to preview without writing.
 */
export async function POST(req: NextRequest) {
  const ctx = await resolveApiLandlord();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const daysParam = req.nextUrl.searchParams.get("days");
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "true";
  const since = daysParam
    ? new Date(Date.now() - Math.max(1, Number(daysParam)) * 86400000)
    : null;

  // Seed (additive) before the loop so any NEW chart-of-accounts rows
  // are present for the journal helper to reference. Without this,
  // backfilling on a PM seeded before the chart additions would fail
  // when the helper tries to find account 5300 / 5250 / etc.
  try {
    const { seedDefaultAccounts } = await import(
      "@/lib/accounting/chart-of-accounts"
    );
    await seedDefaultAccounts(ctx.landlordId);
  } catch (err) {
    console.error("[backfill-expenses] seedDefaultAccounts failed:", err);
    return NextResponse.json(
      { error: "Failed to seed chart of accounts" },
      { status: 500 }
    );
  }

  // Pull every expense for this landlord. Scoped to PM via landlordId
  // so admin "View as PM" impersonation backfills only that PM's
  // books. If `?days=N` is set, restrict to recent expenses.
  const expenses = await db.expense.findMany({
    where: {
      landlordId: ctx.landlordId,
      ...(since && { date: { gte: since } }),
    },
    select: {
      id: true,
      category: true,
      amount: true,
      date: true,
      propertyId: true,
      description: true,
    },
    orderBy: { date: "asc" },
  });

  const { expenseCategoryToAccountCode } = await import(
    "@/lib/accounting/chart-of-accounts"
  );
  const { journalExpense } = await import("@/lib/accounting/auto-entries");

  // Pull the landlord's expense accounts so we can map account.id back
  // to its code when inspecting existing journal entry lines.
  const accounts = await db.ledgerAccount.findMany({
    where: { pmId: ctx.landlordId, type: "EXPENSE" },
    select: { id: true, code: true },
  });
  const idToCode = new Map(accounts.map((a) => [a.id, a.code]));

  let createdMissing = 0;
  let fixedWrongAccount = 0;
  let alreadyCorrect = 0;
  let errors: Array<{ expenseId: string; error: string }> = [];

  for (const exp of expenses) {
    const expectedCode = expenseCategoryToAccountCode(exp.category);

    try {
      // Look up the existing journal entry (if any) and its expense
      // line. Source/sourceId is unique per expense — there's at most
      // one auto-generated entry to inspect.
      const existing = await db.journalEntry.findFirst({
        where: {
          pmId: ctx.landlordId,
          source: "EXPENSE",
          sourceId: exp.id,
        },
        include: {
          lines: {
            select: { accountId: true, debit: true, credit: true },
          },
        },
      });

      if (!existing) {
        // ── Case 1: no entry exists → create one ──
        if (dryRun) {
          createdMissing += 1;
          continue;
        }
        await journalExpense({
          pmId: ctx.landlordId,
          expenseId: exp.id,
          amount: Number(exp.amount),
          expenseAccountCode: expectedCode,
          date: exp.date || new Date(),
          propertyId: exp.propertyId,
          description: exp.description || exp.category || "Property expense",
        });
        createdMissing += 1;
        continue;
      }

      // Find the expense-side line (the debit). For a standard
      // journalExpense entry there's exactly one debit line and one
      // credit line; the debit goes to the expense account.
      const debitLine = existing.lines.find(
        (l) => Number(l.debit) > 0 && Number(l.credit) === 0
      );
      const currentCode = debitLine
        ? idToCode.get(debitLine.accountId) ?? null
        : null;

      if (currentCode === expectedCode) {
        alreadyCorrect += 1;
        continue;
      }

      // ── Case 2: wrong account — delete + recreate ──
      // The entry's auto-generated and never user-edited, so deletion
      // is safe and cleaner than a REVERSAL pair (which would leave
      // the wrong account on the books even if marked reversed). The
      // `lines` cascade delete is enforced by the schema.
      if (dryRun) {
        fixedWrongAccount += 1;
        continue;
      }
      await db.journalEntry.delete({ where: { id: existing.id } });
      await journalExpense({
        pmId: ctx.landlordId,
        expenseId: exp.id,
        amount: Number(exp.amount),
        expenseAccountCode: expectedCode,
        date: exp.date || new Date(),
        propertyId: exp.propertyId,
        description: exp.description || exp.category || "Property expense",
      });
      fixedWrongAccount += 1;
    } catch (err) {
      errors.push({
        expenseId: exp.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    scanned: expenses.length,
    createdMissing,
    fixedWrongAccount,
    alreadyCorrect,
    errors,
    sinceDays: daysParam ? Number(daysParam) : null,
  });
}

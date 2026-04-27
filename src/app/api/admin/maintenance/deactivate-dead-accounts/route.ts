export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit";

/**
 * POST /api/admin/maintenance/deactivate-dead-accounts
 *
 * One-shot admin maintenance action: deactivates the system-seeded
 * `5400 Landscaping` and `5500 Cleaning` LedgerAccount rows across
 * every landlord. These two accounts were originally seeded but
 * unreachable through `expenseCategoryToAccountCode()` — every
 * maintenance expense routes to 5000 Repairs & Maintenance. They
 * were removed from `DEFAULT_ACCOUNTS` on 2026-04-27, but
 * `seedDefaultAccounts` is only additive (it never removes accounts),
 * so existing landlords still have rows in their charts.
 *
 * Intentional design choices:
 *
 *   - **Deactivate, not delete.** Historical `JournalEntryLine` rows
 *     pointing at these accounts (if any exist) must remain readable
 *     for past P&L / balance reports. Setting `isActive=false` blocks
 *     the accounts from new dropdowns without breaking history.
 *
 *   - **Only `isSystem=true` rows.** PMs can create custom accounts
 *     via `/api/accounting/accounts` POST. If a PM intentionally
 *     created a custom 5400 or 5500, that's their decision and we
 *     don't touch it. The `isSystem: true` filter protects them.
 *
 *   - **Idempotent.** Re-running on already-deactivated rows updates
 *     nothing (the `isActive: true` filter excludes them). Safe to
 *     run multiple times.
 *
 *   - **No journal-entry migration.** Past `JournalEntry` rows are
 *     immutable by design (double-entry audit trail). Their lines
 *     stay pointed at 5400/5500; the accounts simply become read-only.
 *
 * Reactivation: PUT `/api/accounting/accounts/[id]` with
 * `{ isActive: true }` re-enables an individual account if needed.
 *
 * Gated by `admin:expenses` — chart of accounts is an expense-domain
 * surface. SUPER_ADMINs and the platform owner pass via the `["*"]`
 * permissions wildcard.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:expenses")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Pull the affected rows first so we can audit which landlords
  // were touched. updateMany doesn't return the rows it changed,
  // and the count alone isn't enough for a meaningful audit trail.
  const targets = await db.ledgerAccount.findMany({
    where: {
      code: { in: ["5400", "5500"] },
      isSystem: true,
      isActive: true,
    },
    select: { id: true, pmId: true, code: true, name: true },
  });

  const result = await db.ledgerAccount.updateMany({
    where: {
      code: { in: ["5400", "5500"] },
      isSystem: true,
      isActive: true,
    },
    data: { isActive: false },
  });

  // Group affected landlords for the audit description so a quick
  // glance at the audit log tells the operator which tenants were
  // impacted.
  const landlordCount = new Set(targets.map((t) => t.pmId)).size;

  await auditLog({
    userId: session.user.id,
    userRole: "ADMIN",
    action: "DEACTIVATE",
    objectType: "LedgerAccount",
    objectId: "system:5400+5500",
    description: `Deactivated ${result.count} dead system maintenance accounts across ${landlordCount} landlord(s) (codes 5400 Landscaping + 5500 Cleaning).`,
    req,
  });

  return NextResponse.json({
    ok: true,
    deactivatedCount: result.count,
    landlordCount,
    affectedAccounts: targets.map((t) => ({
      id: t.id,
      pmId: t.pmId,
      code: t.code,
      name: t.name,
    })),
  });
}

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { reconcileRecentPayments } from "@/lib/recovery/service";

/**
 * POST /api/cron/recovery-reconcile
 *
 * Sweep recently-COMPLETED rent payments and apply them to matching
 * recovery plans. This is the bridge between the existing payments
 * architecture (which we do NOT modify) and the new recovery tracker.
 *
 * Two auth modes:
 *   - Vercel Cron: header `x-vercel-cron: 1` is set by Vercel when the
 *     schedule fires. We trust it because our runtime edge is behind
 *     Vercel's auth.
 *   - Manual invoke: header `Authorization: Bearer <CRON_SECRET>`.
 *     Anyone with the secret can trigger a sweep — useful for admin
 *     tooling and for the initial 300-unit portfolio migration.
 *
 * The endpoint is a thin wrapper over `reconcileRecentPayments()` in
 * the service layer so the same logic is reachable from tests +
 * internal scripts without spinning up HTTP.
 *
 * Suggested schedule: every 30 minutes. Anything less than daily is
 * fine — worst case a counted payment takes N minutes to show up on
 * the plan; nothing depends on real-time.
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

  const sinceHoursParam = req.nextUrl.searchParams.get("sinceHours");
  const sinceHours = sinceHoursParam ? Number(sinceHoursParam) : 48;
  if (!Number.isFinite(sinceHours) || sinceHours < 1 || sinceHours > 720) {
    return NextResponse.json(
      { error: "sinceHours must be between 1 and 720" },
      { status: 400 }
    );
  }

  try {
    const result = await reconcileRecentPayments(sinceHours);
    return NextResponse.json({
      ok: true,
      sinceHours,
      ...result,
    });
  } catch (err) {
    console.error("[recovery-reconcile] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// Support both POST (Vercel cron can be configured for either) and GET
// so the same secret-guarded URL can be hit from a browser for manual
// reconciliation + observability.
export const GET = handle;
export const POST = handle;

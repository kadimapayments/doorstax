export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveApiLandlord } from "@/lib/api-landlord";
import { db } from "@/lib/db";
import { applyPaymentToRecovery } from "@/lib/recovery/service";

/**
 * POST /api/recovery-plans/[id]/resync
 *
 * Scoped reconciliation endpoint. Looks up every COMPLETED rent
 * payment for the plan's tenant in the last 90 days and runs
 * `applyPaymentToRecovery()` on each. Safe to call repeatedly —
 * the service layer is idempotent via unique(recoveryPlanId, paymentId).
 *
 * Purpose:
 *   1. Testing — PMs shouldn't have to wait on the 30-min cron
 *      sweep to see a payment land on a plan.
 *   2. Operational self-heal — if the cron misses a window, PM
 *      can force a refresh from the plan detail page.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await resolveApiLandlord();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const plan = await db.recoveryPlan.findUnique({
    where: { id },
    select: { id: true, tenantId: true, landlordId: true },
  });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (plan.landlordId !== ctx.landlordId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const candidates = await db.payment.findMany({
    where: {
      tenantId: plan.tenantId,
      status: "COMPLETED",
      type: "RENT",
      paidAt: { gte: since },
    },
    select: { id: true },
  });

  let applied = 0;
  const errors: Array<{ paymentId: string; error: string }> = [];
  for (const { id: paymentId } of candidates) {
    try {
      const result = await applyPaymentToRecovery(paymentId);
      if (result) applied += 1;
    } catch (err) {
      errors.push({
        paymentId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: candidates.length,
    applied,
    errors,
  });
}

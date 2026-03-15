import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createChargeEntry, periodKeyFromDate } from "@/lib/ledger";
import { emit } from "@/lib/events/emitter";

/**
 * Monthly Rent Charge Generator
 * Runs on the 1st of each month at 6 AM UTC (before statement generation at 8 AM).
 * Creates CHARGE ledger entries for all active tenants.
 * Idempotent — safe to re-run (@@unique constraint + code check prevents duplicates).
 */
export async function GET(req: Request) {
  // Verify cron secret (Vercel sends this automatically)
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const periodKey = periodKeyFromDate(now);
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Find all ACTIVE tenants with a unit assignment
  const tenants = await db.tenantProfile.findMany({
    where: {
      status: "ACTIVE",
      unitId: { not: null },
    },
    include: {
      unit: {
        select: {
          id: true,
          rentAmount: true,
        },
      },
    },
  });

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const tenant of tenants) {
    if (!tenant.unit) {
      skipped++;
      continue;
    }

    const rent = Number(tenant.unit.rentAmount);
    const monthlyCharge = (rent * tenant.splitPercent) / 100;

    if (monthlyCharge <= 0) {
      skipped++;
      continue;
    }

    try {
      const entry = await createChargeEntry({
        tenantId: tenant.id,
        unitId: tenant.unit.id,
        amount: monthlyCharge,
        periodKey,
        description: `${monthLabel} rent`,
      });

      if (entry) {
        generated++;
        emit({
          eventType: "rent.charged",
          aggregateType: "LedgerEntry",
          aggregateId: entry.id,
          payload: { tenantId: tenant.id, unitId: tenant.unit.id, amount: monthlyCharge, periodKey },
          emittedBy: "system",
        }).catch(console.error);
      } else {
        skipped++; // Already existed
      }
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    success: true,
    periodKey,
    total: tenants.length,
    generated,
    skipped,
    failed,
  });
}

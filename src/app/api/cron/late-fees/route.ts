import { withCronGuard } from "@/lib/cron-guard";
import { db } from "@/lib/db";
import { getLatestBalance, periodKeyFromDate } from "@/lib/ledger";
import { notify } from "@/lib/notifications";
import { Decimal } from "@prisma/client/runtime/library";

export const dynamic = "force-dynamic";

/**
 * Auto Late Fee cron.
 *
 * Schedule: 0 7 * * * (daily at 7 AM UTC / midnight PST).
 *
 * For each active tenant with a non-zero balance whose unit's property
 * has an enabled LateFeePolicy:
 *   1. Compute days past due from the start of the current period + graceDays.
 *   2. Count existing late-fee CHARGE entries this period ("Late fee — Day N").
 *   3. If (existing * dailyAmount) >= maxAmount, skip (capped).
 *   4. If daysPastDue <= existingCount, skip (already have a fee for each late day).
 *   5. Otherwise accrue one new CHARGE for today.
 *
 * IMPORTANT: We intentionally do NOT use createChargeEntry() — its
 * idempotency check blocks multiple CHARGEs per period. We write the
 * LedgerEntry directly inside a Serializable transaction so we can have
 * one rent-CHARGE plus many late-fee CHARGEs in the same period.
 */
export const GET = withCronGuard("late-fees", async () => {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodKey = periodKeyFromDate(periodStart);

  // Find active tenants with some unit assignment + a policy on that unit's
  // property. We deliberately don't pre-filter on balance here — we'll read
  // the latest balance inside the per-tenant transaction to avoid races.
  const tenants = await db.tenantProfile.findMany({
    where: {
      status: "ACTIVE",
      unitId: { not: null },
      unit: {
        property: {
          lateFeePolicy: { enabled: true },
        },
      },
    },
    select: {
      id: true,
      unitId: true,
      user: { select: { id: true, name: true, email: true } },
      unit: {
        select: {
          id: true,
          unitNumber: true,
          dueDay: true,
          property: {
            select: {
              id: true,
              name: true,
              landlordId: true,
              lateFeePolicy: {
                select: {
                  dailyAmount: true,
                  maxAmount: true,
                  graceDays: true,
                  notifyTenant: true,
                },
              },
            },
          },
        },
      },
    },
  });

  let charged = 0;
  let skippedGrace = 0;
  let skippedCapped = 0;
  let skippedZeroBalance = 0;
  let errors = 0;

  for (const t of tenants) {
    const policy = t.unit?.property?.lateFeePolicy;
    if (!t.unit || !policy) continue;

    // Rent is typically due on the unit's dueDay (usually 1st).
    // Late fee starts after dueDay + graceDays.
    const dueDay = t.unit.dueDay || 1;
    const dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay);
    const graceEnd = new Date(dueDate);
    graceEnd.setDate(graceEnd.getDate() + policy.graceDays);

    const daysPastDue = Math.floor(
      (now.getTime() - graceEnd.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysPastDue <= 0) {
      skippedGrace++;
      continue;
    }

    // Current balance must be > 0 for us to accrue a late fee.
    const balance = await getLatestBalance(t.id);
    if (balance.lte(0)) {
      skippedZeroBalance++;
      continue;
    }

    // Count existing late-fee CHARGE entries this period.
    const existingCount = await db.ledgerEntry.count({
      where: {
        tenantId: t.id,
        periodKey,
        type: "CHARGE",
        description: { startsWith: "Late fee" },
      },
    });

    const dailyAmount = new Decimal(policy.dailyAmount.toString());
    const maxAmount = new Decimal(policy.maxAmount.toString());
    const accruedSoFar = dailyAmount.mul(existingCount);

    if (accruedSoFar.gte(maxAmount)) {
      skippedCapped++;
      continue;
    }

    // One accrual per day past grace. If the cron missed a day, we'll
    // catch up one entry per run until existingCount === daysPastDue.
    if (existingCount >= daysPastDue) {
      // Already fully accrued for every past-due day.
      continue;
    }

    const dayNumber = existingCount + 1;
    // Cap the fee amount so we don't overshoot the max.
    const room = maxAmount.minus(accruedSoFar);
    const feeAmount = Decimal.min(dailyAmount, room);

    try {
      const created = await db.$transaction(
        async (tx) => {
          const prev = await getLatestBalance(t.id, tx);
          const newBalance = prev.plus(feeAmount);
          return tx.ledgerEntry.create({
            data: {
              tenantId: t.id,
              unitId: t.unit!.id,
              type: "CHARGE",
              amount: feeAmount,
              balanceAfter: newBalance,
              periodKey,
              description: `Late fee — Day ${dayNumber}`,
              paymentId: null,
              locked: true,
            },
          });
        },
        { isolationLevel: "Serializable" }
      );

      charged++;

      if (policy.notifyTenant && t.user) {
        const feeStr = `$${Number(feeAmount).toFixed(2)}`;
        const balanceStr = `$${Number(created.balanceAfter).toFixed(2)}`;
        notify({
          userId: t.user.id,
          createdById: t.unit.property.landlordId,
          type: "SYSTEM",
          title: "Late Fee Applied",
          message: `A late fee of ${feeStr} has been applied to your account. Current balance: ${balanceStr}.`,
          severity: "warning",
          actionUrl: "/tenant/pay",
          amount: Number(feeAmount),
          email: t.user.email
            ? {
                to: t.user.email,
                subject: `Late fee applied \u2014 ${feeStr}`,
                html: lateFeeEmail({
                  tenantName: t.user.name || "Tenant",
                  feeAmount: feeStr,
                  dayNumber,
                  newBalance: balanceStr,
                  propertyName: t.unit.property.name,
                  unitNumber: t.unit.unitNumber,
                }),
              }
            : undefined,
        }).catch((err) =>
          console.error("[cron:late-fees] notify failed:", err)
        );
      }
    } catch (err) {
      errors++;
      console.error(
        `[cron:late-fees] Failed for tenant ${t.id}:`,
        err
      );
    }
  }

  return {
    summary: {
      candidatesScanned: tenants.length,
      charged,
      skippedGrace,
      skippedCapped,
      skippedZeroBalance,
      errors,
      periodKey,
    },
  };
});

function lateFeeEmail(opts: {
  tenantName: string;
  feeAmount: string;
  dayNumber: number;
  newBalance: string;
  propertyName: string;
  unitNumber: string;
}) {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;">
<h2 style="color:#b45309;">Late Fee Applied</h2>
<p>Hi ${opts.tenantName},</p>
<p>A late fee of <strong>${opts.feeAmount}</strong> has been applied to your rent account for <strong>${opts.propertyName} \u2014 Unit ${opts.unitNumber}</strong> (day ${opts.dayNumber} past grace).</p>
<p>Your current balance is <strong>${opts.newBalance}</strong>. Late fees will continue to accrue daily until rent is paid, up to the cap set by your property manager.</p>
<p style="margin-top:24px;"><a href="${process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com"}/tenant/pay" style="display:inline-block;background:#5B00FF;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">Pay now</a></p>
<p style="font-size:12px;color:#666;margin-top:32px;">If you believe this fee was applied in error or you have a payment arrangement with your property manager, please contact them directly.</p>
</body></html>`;
}

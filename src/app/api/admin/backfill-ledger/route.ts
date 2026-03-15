import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Admin-only backfill route: generates historical LedgerEntry records
 * from existing Payment records and lease data.
 *
 * POST /api/admin/backfill-ledger
 *
 * Idempotent — uses findFirst checks to prevent duplicate entries.
 * Safe to re-run multiple times.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:audit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Find all tenants with a unit assignment
  const tenants = await db.tenantProfile.findMany({
    where: {
      unitId: { not: null },
      status: { in: ["ACTIVE", "PREVIOUS"] },
    },
    include: {
      unit: { select: { id: true, rentAmount: true } },
      payments: {
        where: { status: { in: ["COMPLETED", "REFUNDED"] } },
        orderBy: { dueDate: "asc" },
        select: {
          id: true,
          amount: true,
          status: true,
          dueDate: true,
          type: true,
          paidAt: true,
        },
      },
    },
  });

  let chargesCreated = 0;
  let paymentsCreated = 0;
  let reversalsCreated = 0;
  let tenantsProcessed = 0;

  for (const tenant of tenants) {
    if (!tenant.unit) continue;
    tenantsProcessed++;

    const rent = Number(tenant.unit.rentAmount);
    const monthlyCharge = (rent * tenant.splitPercent) / 100;
    const unitId = tenant.unit.id;

    // Determine month range: lease start → now
    const startDate = tenant.leaseStart || tenant.createdAt;
    const now = new Date();
    const cursor = new Date(
      new Date(startDate).getFullYear(),
      new Date(startDate).getMonth(),
      1
    );

    // Track running balance for this tenant
    // First check if there are already any ledger entries
    const existingLatest = await db.ledgerEntry.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      select: { balanceAfter: true },
    });
    let runningBalance = existingLatest
      ? Number(existingLatest.balanceAfter)
      : 0;

    // If entries already exist, skip this tenant (already backfilled)
    if (existingLatest) continue;

    // Generate month-by-month entries
    while (cursor <= now) {
      const periodKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);

      // 1. Create CHARGE entry for this month
      if (monthlyCharge > 0) {
        runningBalance += monthlyCharge;
        await db.ledgerEntry.create({
          data: {
            tenantId: tenant.id,
            unitId,
            type: "CHARGE",
            amount: new Decimal(monthlyCharge.toFixed(2)),
            balanceAfter: new Decimal(runningBalance.toFixed(2)),
            periodKey,
            description: `${monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })} rent`,
          },
        });
        chargesCreated++;
      }

      // 2. Create PAYMENT entries for completed payments in this month
      const monthPayments = tenant.payments.filter((p) => {
        const due = new Date(p.dueDate);
        return due >= monthStart && due <= monthEnd;
      });

      for (const payment of monthPayments) {
        const paymentAmount = Number(payment.amount);

        // Record PAYMENT entry
        runningBalance -= paymentAmount;
        await db.ledgerEntry.create({
          data: {
            tenantId: tenant.id,
            unitId,
            type: "PAYMENT",
            amount: new Decimal((-paymentAmount).toFixed(2)), // Negative = credit
            balanceAfter: new Decimal(runningBalance.toFixed(2)),
            periodKey,
            description: "Payment received",
            paymentId: payment.id,
          },
        });
        paymentsCreated++;

        // If payment was refunded, also create a REVERSAL entry
        if (payment.status === "REFUNDED") {
          runningBalance += paymentAmount;
          await db.ledgerEntry.create({
            data: {
              tenantId: tenant.id,
              unitId,
              type: "REVERSAL",
              amount: new Decimal(paymentAmount.toFixed(2)), // Positive = debit (owed again)
              balanceAfter: new Decimal(runningBalance.toFixed(2)),
              periodKey,
              description: "Payment refunded",
              paymentId: payment.id,
              metadata: { reason: "Refund" },
            },
          });
          reversalsCreated++;
        }
      }

      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  return NextResponse.json({
    success: true,
    tenantsProcessed,
    chargesCreated,
    paymentsCreated,
    reversalsCreated,
  });
}

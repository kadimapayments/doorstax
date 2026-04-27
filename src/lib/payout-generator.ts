import { db } from "@/lib/db";
import { getPerUnitCost, getTier } from "@/lib/residual-tiers";

/**
 * Serialize an OwnerPayout record — converts Decimal fields to numbers.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializePayout(payout: any) {
  return {
    ...payout,
    grossRent: Number(payout.grossRent),
    processingFees: Number(payout.processingFees),
    managementFee: Number(payout.managementFee),
    expenses: Number(payout.expenses),
    platformFee: Number(payout.platformFee),
    netPayout: Number(payout.netPayout),
    achRate: Number(payout.achRate ?? 6),
    payoutFee: Number(payout.payoutFee),
    payoutFeeRate: Number(payout.payoutFeeRate ?? 0),
    unitFee: Number(payout.unitFee ?? 0),
  };
}

/**
 * Generate a DRAFT payout for an owner.
 * Returns the serialized payout, or null if one already exists for the period.
 * Idempotent — safe to call multiple times.
 *
 * @param owner - Owner record with `properties` relation loaded
 * @param landlordId - PM's landlordId
 * @param month - 1-based month number (1 = January)
 * @param year - Full year
 * @param half - null for MONTHLY, 1 or 2 for SEMI_MONTHLY halves
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generatePayout(owner: any, landlordId: string, month: number, year: number, half: number | null) {
  // Period calculation
  let periodStart: Date, periodEnd: Date;
  if (half === 1) {
    periodStart = new Date(year, month - 1, 1);
    periodEnd = new Date(year, month - 1, 15, 23, 59, 59, 999);
  } else if (half === 2) {
    periodStart = new Date(year, month - 1, 16);
    periodEnd = new Date(year, month, 0, 23, 59, 59, 999);
  } else {
    periodStart = new Date(year, month - 1, 1);
    periodEnd = new Date(year, month, 0, 23, 59, 59, 999);
  }

  // Period label for semi-monthly
  const periodLabel = half === 1
    ? `${new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })} (1st–15th)`
    : half === 2
    ? `${new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })} (16th–${new Date(year, month, 0).getDate()}th)`
    : new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Duplicate check — overlapping period for same owner
  const existing = await db.ownerPayout.findFirst({
    where: {
      ownerId: owner.id,
      periodStart: { lte: periodEnd },
      periodEnd: { gte: periodStart },
    },
  });
  if (existing) {
    return null;
  }

  const propertyIds = owner.properties.map((p: { id: string }) => p.id);
  const isBillMe = owner.billMe;
  const achFeeMode = owner.achFeeResponsibility || "OWNER";

  // 1. Gross rent: sum of completed payments for owner's properties in period
  const paymentAgg = await db.payment.aggregate({
    where: {
      landlordId,
      status: "COMPLETED",
      unit: { propertyId: { in: propertyIds } },
      paidAt: { gte: periodStart, lte: periodEnd },
    },
    _sum: { amount: true },
  });
  const grossRent = Number(paymentAgg._sum.amount ?? 0);

  // 2. Processing fees (ACH) — driven by achFeeResponsibility
  let processingFees = 0;
  let achCount = 0;
  if (achFeeMode === "OWNER" && Number(owner.achRate) > 0) {
    achCount = await db.payment.count({
      where: {
        landlordId,
        status: "COMPLETED",
        paymentMethod: "ach",
        unit: { propertyId: { in: propertyIds } },
        paidAt: { gte: periodStart, lte: periodEnd },
      },
    });
    processingFees = achCount * Number(owner.achRate);
  }

  // 3. Management fee
  const mgmtPct = Number(owner.managementFeePercent);
  let managementFee = grossRent * (mgmtPct / 100);
  if (isBillMe && !owner.billMeIncludeManagement) {
    managementFee = 0;
  }

  // 4. Expenses
  let expensesTotal = 0;
  if (owner.deductExpenses) {
    const expenseAgg = await db.expense.aggregate({
      where: {
        landlordId,
        propertyId: { in: propertyIds },
        date: { gte: periodStart, lte: periodEnd },
      },
      _sum: { amount: true },
    });
    expensesTotal = Number(expenseAgg._sum.amount ?? 0);
  }

  // 5. Payout fee — deducted from owner (not PM expense)
  const payoutFeeRateValue = isBillMe ? 0 : Number(owner.payoutFeeRate);
  const payoutFee = Math.round(grossRent * payoutFeeRateValue * 100) / 100;

  // 6. Per-unit fee (replaces old platform fee)
  let unitFee = 0;
  if (!isBillMe && Number(owner.unitFeeRate) > 0) {
    const ownerUnits = await db.unit.count({
      where: { property: { ownerId: owner.id } },
    });
    if (half === 1) {
      unitFee = 0;
    } else {
      unitFee = ownerUnits * Number(owner.unitFeeRate);
    }
  }

  // Net payout
  const netPayout = Math.max(0, grossRent - processingFees - managementFee - expensesTotal - payoutFee - unitFee);

  // Expense creation for PM-absorbed costs
  if (grossRent > 0) {
    if (achFeeMode === "PM" && achCount === 0 && Number(owner.achRate) > 0) {
      achCount = await db.payment.count({
        where: {
          landlordId,
          status: "COMPLETED",
          paymentMethod: "ach",
          unit: { propertyId: { in: propertyIds } },
          paidAt: { gte: periodStart, lte: periodEnd },
        },
      });
    }

    const costExpenses = [];

    // ACH at cost — when PM absorbs ACH. Use tier-specific platform cost.
    if (achFeeMode === "PM" && achCount > 0) {
      const totalUnitsForTier = await db.unit.count({ where: { property: { landlordId } } });
      const achCost = getTier(totalUnitsForTier).platformAchCost;
      costExpenses.push({
        landlordId,
        propertyId: owner.properties[0].id,
        category: "PROCESSING_FEES",
        amount: achCount * achCost,
        date: new Date(),
        description: `ACH cost ($${achCost.toFixed(2)}/tx \u00d7 ${achCount}) \u2014 ${owner.name} ${periodLabel}`,
        vendor: "DoorStax",
      });
    }

    // Payout fee at cost (0.15%) — Bill Me only
    if (isBillMe) {
      const costPayoutFee = Math.round(grossRent * 0.0015 * 100) / 100;
      if (costPayoutFee > 0) {
        costExpenses.push({
          landlordId,
          propertyId: owner.properties[0].id,
          category: "PROCESSING_FEES",
          amount: costPayoutFee,
          date: new Date(),
          description: `Bill Me — Payout fee (0.15%) — ${owner.name} ${periodLabel}`,
          vendor: "DoorStax",
        });
      }

      // Platform fee at cost — Bill Me only
      const totalUnits = await db.unit.count({ where: { property: { landlordId } } });
      const ownerUnits = await db.unit.count({ where: { property: { ownerId: owner.id } } });
      const perUnitCost = getPerUnitCost(totalUnits);
      const platformCost = ownerUnits * perUnitCost;
      if (platformCost > 0 && half !== 1) {
        costExpenses.push({
          landlordId,
          propertyId: owner.properties[0].id,
          category: "PROCESSING_FEES",
          amount: platformCost,
          date: new Date(),
          description: `Bill Me — Platform fee ($${perUnitCost}/unit × ${ownerUnits}) — ${owner.name} ${periodLabel}`,
          vendor: "DoorStax",
        });
      }
    }

    for (const exp of costExpenses) {
      const created = await db.expense.create({
        data: exp as Parameters<typeof db.expense.create>[0]["data"],
      });

      // ── Accounting: journal the cost expense ──
      // PROCESSING_FEES → 5900 Payment Processing Fees. Without this,
      // platform / payout fees never landed on the chart of accounts —
      // the P&L was understating fee expense. Best-effort: failures
      // log loudly but don't roll back the expense row (journals are
      // a derived view that the backfill endpoint can repair).
      try {
        const {
          seedDefaultAccounts,
          expenseCategoryToAccountCode,
        } = await import("@/lib/accounting/chart-of-accounts");
        await seedDefaultAccounts(landlordId);
        const { journalExpense } = await import(
          "@/lib/accounting/auto-entries"
        );
        await journalExpense({
          pmId: landlordId,
          expenseId: created.id,
          amount: Number(created.amount),
          expenseAccountCode: expenseCategoryToAccountCode(created.category),
          date: created.date || new Date(),
          propertyId: created.propertyId,
          description: created.description || "Platform fee",
        });
      } catch (journalErr) {
        console.error(
          "[payout-generator] Journal failed for cost expense",
          created.id,
          journalErr
        );
      }
    }
  }

  const payout = await db.ownerPayout.create({
    data: {
      ownerId: owner.id,
      landlordId,
      periodStart,
      periodEnd,
      grossRent,
      processingFees,
      managementFee,
      expenses: expensesTotal,
      platformFee: 0,
      netPayout,
      achRate: Number(owner.achRate),
      payoutFee,
      payoutFeeRate: payoutFeeRateValue,
      unitFee,
      status: "DRAFT",
    },
  });

  return serializePayout(payout);
}

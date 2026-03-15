/**
 * Seed script: Populate the ledger with CHARGE + PAYMENT entries for all
 * active tenants, then leave a subset with unpaid balances.
 *
 * Uses createMany for batch inserts (fast).
 *
 * Distribution:
 *   ~70% — fully paid (balance = $0)
 *   ~10% — current month unpaid (CURRENT bucket)
 *   ~8%  — last 2 months unpaid (30_PLUS bucket)
 *   ~7%  — last 3 months unpaid (60_PLUS bucket)
 *   ~5%  — last 4+ months unpaid (90_PLUS bucket)
 *
 * Run: npx tsx prisma/seed-unpaid-balances.ts
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

function pk(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ml(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function cuid(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "cl";
  for (let i = 0; i < 23; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

async function main() {
  console.log("--- Seed Unpaid Balances (batch mode) ---\n");

  // Clear existing ledger entries
  const existingCount = await prisma.ledgerEntry.count();
  if (existingCount > 0) {
    console.log(`Clearing ${existingCount} existing ledger entries...`);
    await prisma.ledgerEntry.deleteMany({});
    console.log("Done.\n");
  }

  // Get all active tenants with unit
  const tenants = await prisma.tenantProfile.findMany({
    where: { status: "ACTIVE", unitId: { not: null } },
    include: {
      unit: {
        select: {
          id: true,
          rentAmount: true,
          property: { select: { landlordId: true } },
        },
      },
      user: { select: { name: true } },
      payments: {
        where: { status: "COMPLETED" },
        orderBy: { dueDate: "asc" },
        select: { id: true, amount: true, dueDate: true },
      },
    },
  });

  console.log(`Found ${tenants.length} active tenants.\n`);

  const now = new Date();

  // Generate 7 months of charges: Sep 2025 → Mar 2026
  const months: Date[] = [];
  for (let i = 6; i >= 0; i--) {
    months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }
  console.log("Months:", months.map(pk).join(", "), "\n");

  // Sort tenants deterministically
  const sorted = [...tenants].sort((a, b) =>
    (a.user?.name || a.id).localeCompare(b.user?.name || b.id)
  );

  // Build payment lookup: tenantId → periodKey → Payment.id
  const paymentLookup = new Map<string, Map<string, string>>();
  for (const t of sorted) {
    const map = new Map<string, string>();
    for (const p of t.payments) {
      const period = pk(new Date(p.dueDate));
      if (!map.has(period)) map.set(period, p.id);
    }
    paymentLookup.set(t.id, map);
  }

  // Collect all entries to insert
  const ledgerEntries: Prisma.LedgerEntryCreateManyInput[] = [];
  const syntheticPayments: Prisma.PaymentCreateManyInput[] = [];

  const bucketCounts = { paid: 0, current: 0, thirtyPlus: 0, sixtyPlus: 0, ninetyPlus: 0 };
  let tenantsWithBalance = 0;

  for (let idx = 0; idx < sorted.length; idx++) {
    const tenant = sorted[idx];
    if (!tenant.unit) continue;

    const rent = Number(tenant.unit.rentAmount);
    const monthlyCharge = (rent * tenant.splitPercent) / 100;
    if (monthlyCharge <= 0) continue;

    const unitId = tenant.unit.id;
    const landlordId = tenant.unit.property?.landlordId || "";

    // Determine unpaid months based on position
    const pct = idx / sorted.length;
    let unpaidMonths: number;
    if (pct < 0.70) {
      unpaidMonths = 0;
      bucketCounts.paid++;
    } else if (pct < 0.80) {
      unpaidMonths = 1;
      bucketCounts.current++;
    } else if (pct < 0.88) {
      unpaidMonths = 2;
      bucketCounts.thirtyPlus++;
    } else if (pct < 0.95) {
      unpaidMonths = 3;
      bucketCounts.sixtyPlus++;
    } else {
      unpaidMonths = 4;
      bucketCounts.ninetyPlus++;
    }

    const existingPayments = paymentLookup.get(tenant.id) || new Map();
    let runningBalance = 0;

    for (let mi = 0; mi < months.length; mi++) {
      const month = months[mi];
      const period = pk(month);
      const isPaid = mi < months.length - unpaidMonths;

      // Skip if lease hasn't started
      const leaseStart = tenant.leaseStart || tenant.createdAt;
      if (new Date(leaseStart) > new Date(month.getFullYear(), month.getMonth() + 1, 0)) {
        continue;
      }

      // CHARGE entry
      runningBalance += monthlyCharge;
      ledgerEntries.push({
        id: cuid(),
        tenantId: tenant.id,
        unitId,
        type: "CHARGE",
        amount: new Decimal(monthlyCharge.toFixed(2)),
        balanceAfter: new Decimal(runningBalance.toFixed(2)),
        periodKey: period,
        description: `${ml(month)} rent`,
        createdAt: new Date(month.getFullYear(), month.getMonth(), 1, 6, 0, 0),
      });

      // PAYMENT entry (if paid)
      if (isPaid) {
        let paymentId = existingPayments.get(period);

        if (!paymentId) {
          // Create synthetic payment
          paymentId = cuid();
          const payDate = new Date(month.getFullYear(), month.getMonth(), 3, 10, 0, 0);
          syntheticPayments.push({
            id: paymentId,
            tenantId: tenant.id,
            unitId,
            landlordId,
            amount: new Decimal(monthlyCharge.toFixed(2)),
            type: "RENT",
            status: "COMPLETED",
            paymentMethod: "ach",
            dueDate: new Date(month.getFullYear(), month.getMonth(), 1),
            paidAt: payDate,
            description: `${ml(month)} rent payment`,
            createdAt: payDate,
          });
        }

        runningBalance -= monthlyCharge;
        ledgerEntries.push({
          id: cuid(),
          tenantId: tenant.id,
          unitId,
          type: "PAYMENT",
          amount: new Decimal((-monthlyCharge).toFixed(2)),
          balanceAfter: new Decimal(runningBalance.toFixed(2)),
          periodKey: period,
          description: "Payment received",
          paymentId,
          createdAt: new Date(month.getFullYear(), month.getMonth(), 3, 10, 0, 0),
        });
      }
    }

    if (runningBalance > 0) tenantsWithBalance++;
  }

  console.log(`Prepared ${ledgerEntries.length} ledger entries.`);
  console.log(`Prepared ${syntheticPayments.length} synthetic payments.\n`);

  // Batch insert payments first (ledger entries reference them)
  if (syntheticPayments.length > 0) {
    console.log("Inserting synthetic payments...");
    // Insert in chunks of 500
    for (let i = 0; i < syntheticPayments.length; i += 500) {
      const chunk = syntheticPayments.slice(i, i + 500);
      await prisma.payment.createMany({ data: chunk, skipDuplicates: true });
      process.stdout.write(`  ${Math.min(i + 500, syntheticPayments.length)}/${syntheticPayments.length}\r`);
    }
    console.log("\nDone.\n");
  }

  // Batch insert ledger entries
  console.log("Inserting ledger entries...");
  for (let i = 0; i < ledgerEntries.length; i += 500) {
    const chunk = ledgerEntries.slice(i, i + 500);
    await prisma.ledgerEntry.createMany({ data: chunk, skipDuplicates: true });
    process.stdout.write(`  ${Math.min(i + 500, ledgerEntries.length)}/${ledgerEntries.length}\r`);
  }
  console.log("\nDone.\n");

  // Summary
  console.log("=== Results ===");
  console.log(`Ledger entries: ${ledgerEntries.length}`);
  console.log(`Synthetic payments: ${syntheticPayments.length}`);
  console.log(`Tenants with unpaid balance: ${tenantsWithBalance}`);
  console.log();
  console.log("Distribution:");
  console.log(`  Fully paid:   ${bucketCounts.paid}`);
  console.log(`  Current:      ${bucketCounts.current}`);
  console.log(`  30+ days:     ${bucketCounts.thirtyPlus}`);
  console.log(`  60+ days:     ${bucketCounts.sixtyPlus}`);
  console.log(`  90+ days:     ${bucketCounts.ninetyPlus}`);

  // Verify
  const positiveBalances = await prisma.$queryRaw<{ cnt: bigint; total: Decimal }[]>`
    SELECT COUNT(DISTINCT t."tenantId") as cnt, COALESCE(SUM(t."balanceAfter"), 0) as total
    FROM (
      SELECT DISTINCT ON ("tenantId") "tenantId", "balanceAfter"
      FROM "LedgerEntry"
      ORDER BY "tenantId", "createdAt" DESC
    ) t
    WHERE t."balanceAfter" > 0
  `;

  if (positiveBalances[0]) {
    console.log(`\nVerification: ${positiveBalances[0].cnt} tenants with positive balance`);
    console.log(`Total unpaid: $${Number(positiveBalances[0].total).toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// ─── HELPERS ──────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

const randomLast4 = () => String(1000 + Math.floor(Math.random() * 9000));

// Card brand distribution: 45% visa, 30% mastercard, 15% amex, 10% discover
const CARD_BRANDS = ["visa", "mastercard", "amex", "discover"];
const CARD_WEIGHTS = [45, 30, 15, 10];

// Decline reason codes for FAILED payments
const DECLINE_REASONS = [
  "insufficient_funds",
  "suspected_fraud",
  "card_expired",
  "do_not_honor",
  "invalid_card",
];

// ─── DATE HELPERS ─────────────────────────────────────────

/**
 * Returns an array of { year, month } for the last `n` months,
 * excluding the current month.
 */
function getPastMonths(n: number): { year: number; month: number }[] {
  const now = new Date();
  const months: { year: number; month: number }[] = [];
  for (let i = n; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() }); // 0-indexed month
  }
  return months;
}

/**
 * Returns the number of days in a given month (0-indexed month).
 */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Pick a random day in the given month with weighted distribution:
 *   - Days 1-5:   weight 3x (start of month)
 *   - Days 14-16: weight 2x (mid-month)
 *   - All others: weight 1x
 */
function pickWeightedDay(year: number, month: number): number {
  const maxDay = daysInMonth(year, month);
  const days: number[] = [];
  const weights: number[] = [];

  for (let d = 1; d <= maxDay; d++) {
    days.push(d);
    if (d >= 1 && d <= 5) {
      weights.push(3);
    } else if (d >= 14 && d <= 16) {
      weights.push(2);
    } else {
      weights.push(1);
    }
  }

  return weightedPick(days, weights);
}

// ─── MAIN ─────────────────────────────────────────────────

async function main() {
  console.log("Seed Auth History: generating 6 months of card payment history for existing PMs...\n");

  // 1. Query all PM users
  const pmUsers = await db.user.findMany({
    where: { role: "PM" },
    select: { id: true, name: true, email: true },
  });

  if (pmUsers.length === 0) {
    console.log("No PM users found. Run the main seed first.");
    return;
  }

  console.log(`Found ${pmUsers.length} PM(s)\n`);

  const pastMonths = getPastMonths(6);
  let grandTotal = 0;

  for (const pm of pmUsers) {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`  ${pm.name} (${pm.email})`);
    console.log(`${"=".repeat(50)}`);

    // 2. Query all tenant profiles for this PM's units
    //    We need tenants linked to units that belong to properties owned by this PM.
    const properties = await db.property.findMany({
      where: { landlordId: pm.id },
      select: {
        id: true,
        name: true,
        units: {
          select: {
            id: true,
            unitNumber: true,
            rentAmount: true,
            tenantProfiles: {
              where: { status: "ACTIVE" },
              select: { id: true },
            },
          },
        },
      },
    });

    // Flatten to a list of { tenantProfileId, unitId, rentAmount }
    const tenantUnits: {
      tenantId: string;
      unitId: string;
      rentAmount: number;
    }[] = [];

    for (const prop of properties) {
      for (const unit of prop.units) {
        for (const tp of unit.tenantProfiles) {
          tenantUnits.push({
            tenantId: tp.id,
            unitId: unit.id,
            rentAmount: Number(unit.rentAmount),
          });
        }
      }
    }

    if (tenantUnits.length === 0) {
      console.log("  No active tenants found, skipping.");
      continue;
    }

    console.log(`  ${tenantUnits.length} active tenant-unit pairs across ${properties.length} properties`);

    // 3. For each of the last 6 months, generate card payments
    //    Target: ~80-150 payments per PM per month, spread across tenants/units
    let pmTotal = 0;

    for (const { year, month } of pastMonths) {
      const monthLabel = new Date(year, month, 1).toLocaleString("default", {
        month: "long",
        year: "numeric",
      });

      // Determine how many payments this month (80-150, but capped at tenant count)
      const targetCount = Math.min(randInt(80, 150), tenantUnits.length);

      // Randomly select which tenant-units get a payment this month
      // Shuffle and take first `targetCount`
      const shuffled = [...tenantUnits].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, targetCount);

      const paymentBatch: any[] = [];

      for (const tu of selected) {
        const day = pickWeightedDay(year, month);
        const createdAt = new Date(year, month, day, randInt(6, 22), randInt(0, 59), randInt(0, 59));

        // Amount: rent-like $800-$3500
        const amount = randInt(800, 3500);

        // ~65% approval rate
        const isApproved = Math.random() < 0.65;
        const status = isApproved ? "COMPLETED" : "FAILED";

        // Card brand (weighted)
        const cardBrand = weightedPick(CARD_BRANDS, CARD_WEIGHTS);
        const cardLast4 = randomLast4();

        // Due date is the 1st of that month
        const dueDate = new Date(year, month, 1, 0, 0, 0, 0);

        const payment: any = {
          tenantId: tu.tenantId,
          unitId: tu.unitId,
          landlordId: pm.id,
          amount,
          type: "RENT",
          status,
          paymentMethod: "card",
          cardBrand,
          cardLast4,
          dueDate,
          createdAt,
        };

        if (status === "COMPLETED") {
          // paidAt = createdAt + random hours (1-48h)
          const paidAt = new Date(createdAt.getTime() + randInt(1, 48) * 60 * 60 * 1000);
          payment.paidAt = paidAt;
        } else {
          // FAILED: set decline reason
          payment.declineReasonCode = pick(DECLINE_REASONS);
        }

        paymentBatch.push(payment);
      }

      // Bulk insert in chunks of 500
      for (let i = 0; i < paymentBatch.length; i += 500) {
        await db.payment.createMany({ data: paymentBatch.slice(i, i + 500) });
      }

      pmTotal += paymentBatch.length;
      console.log(`  ${monthLabel}: ${paymentBatch.length} card payments`);
    }

    console.log(`  --> PM total: ${pmTotal} payments`);
    grandTotal += pmTotal;
  }

  // ─── SUMMARY ──────────────────────────────────────────
  console.log(`\n${"=".repeat(50)}`);
  console.log("  SEED AUTH HISTORY COMPLETE");
  console.log(`${"=".repeat(50)}`);
  console.log(`\nTotal card payments created: ${grandTotal.toLocaleString()}\n`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());

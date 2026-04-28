import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import {
  recordPayment,
  recordReversal,
  createChargeEntry,
  periodKeyFromDate,
} from "@/lib/ledger";
import { auditLog } from "@/lib/audit";
import { notify } from "@/lib/notifications";

/**
 * Daily Reconciliation Job
 * Runs every day at 9 AM UTC (after all other crons, before US business hours).
 * Detects and repairs data integrity issues between payments and ledger entries.
 *
 * AUTO-FIX (safe, idempotent):
 *  - COMPLETED payments missing PAYMENT ledger entries
 *  - REFUNDED payments missing REVERSAL ledger entries
 *  - Active tenants missing monthly CHARGE entries
 *
 * FLAG ONLY (requires manual review):
 *  - Stale PENDING payments (>48h, webhook never arrived)
 *  - Balance drift (recalculated balance != latest balanceAfter)
 *
 * Idempotent — safe to run multiple times per day.
 */
export async function GET(req: Request) {
  // ── Auth ──────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results = {
    completedMissingLedger: { found: 0, fixed: 0, failed: 0, details: [] as string[] },
    refundedMissingReversal: { found: 0, fixed: 0, failed: 0, details: [] as string[] },
    stalePending: { found: 0, details: [] as string[] },
    missingCharges: { found: 0, fixed: 0, failed: 0, details: [] as string[] },
    balanceDrift: { found: 0, details: [] as string[] },
    achProcessing: {
      polled: 0,
      settled: 0,
      bounced: 0,
      stillPending: 0,
      errors: 0,
      details: [] as string[],
    },
  };

  // ── CHECK 1: COMPLETED payments missing PAYMENT ledger entries ──
  // Happens when webhook updates Payment.status but recordPayment() fails silently.

  const completedWithoutLedger = await db.payment.findMany({
    where: {
      status: "COMPLETED",
      ledgerEntries: {
        none: { type: "PAYMENT" },
      },
    },
    select: {
      id: true,
      tenantId: true,
      unitId: true,
      amount: true,
      dueDate: true,
      tenant: {
        select: { user: { select: { name: true } } },
      },
    },
  });

  results.completedMissingLedger.found = completedWithoutLedger.length;

  for (const payment of completedWithoutLedger) {
    try {
      const entry = await recordPayment({
        tenantId: payment.tenantId,
        unitId: payment.unitId,
        paymentId: payment.id,
        amount: payment.amount,
        periodKey: periodKeyFromDate(payment.dueDate),
        description: "Payment received (reconciliation auto-fix)",
      });
      // entry=null means unique constraint hit (already existed) — still counts as fixed
      results.completedMissingLedger.fixed++;
      if (entry) {
        results.completedMissingLedger.details.push(
          `Payment ${payment.id} (${payment.tenant?.user?.name || "Unknown"}) — ledger entry created`
        );
      }
    } catch {
      results.completedMissingLedger.failed++;
      results.completedMissingLedger.details.push(
        `Payment ${payment.id} (${payment.tenant?.user?.name || "Unknown"}) — auto-fix failed`
      );
    }
  }

  // ── CHECK 2: REFUNDED payments missing REVERSAL ledger entries ──

  const refundedWithoutReversal = await db.payment.findMany({
    where: {
      status: "REFUNDED",
      ledgerEntries: {
        none: { type: "REVERSAL" },
      },
    },
    select: {
      id: true,
      tenantId: true,
      unitId: true,
      amount: true,
      dueDate: true,
      tenant: {
        select: { user: { select: { name: true } } },
      },
    },
  });

  results.refundedMissingReversal.found = refundedWithoutReversal.length;

  for (const payment of refundedWithoutReversal) {
    try {
      const entry = await recordReversal({
        tenantId: payment.tenantId,
        unitId: payment.unitId,
        paymentId: payment.id,
        amount: payment.amount,
        periodKey: periodKeyFromDate(payment.dueDate),
        reason: "Reconciliation auto-fix (missing reversal)",
      });
      results.refundedMissingReversal.fixed++;
      if (entry) {
        results.refundedMissingReversal.details.push(
          `Payment ${payment.id} (${payment.tenant?.user?.name || "Unknown"}) — reversal entry created`
        );
      }
    } catch {
      results.refundedMissingReversal.failed++;
      results.refundedMissingReversal.details.push(
        `Payment ${payment.id} (${payment.tenant?.user?.name || "Unknown"}) — reversal auto-fix failed`
      );
    }
  }

  // ── CHECK 3: Stale PENDING payments (>48h, webhook never arrived) ──
  // Flag only — gateway status is unknown, do NOT auto-resolve.

  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const stalePending = await db.payment.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: fortyEightHoursAgo },
      kadimaTransactionId: { not: null },
    },
    select: {
      id: true,
      amount: true,
      createdAt: true,
      kadimaTransactionId: true,
      tenant: {
        select: { user: { select: { name: true } } },
      },
      unit: {
        select: {
          unitNumber: true,
          property: { select: { name: true } },
        },
      },
    },
  });

  results.stalePending.found = stalePending.length;
  for (const p of stalePending) {
    const tenantName = p.tenant?.user?.name || "Unknown";
    const propertyUnit = `${p.unit?.property?.name || "?"} #${p.unit?.unitNumber || "?"}`;
    const ageHours = Math.round(
      (now.getTime() - p.createdAt.getTime()) / (1000 * 60 * 60)
    );
    results.stalePending.details.push(
      `$${Number(p.amount).toFixed(2)} from ${tenantName} at ${propertyUnit} — pending ${ageHours}h`
    );
  }

  // ── CHECK 3.5: Poll Kadima for PROCESSING ACH payments ──
  // ACH submissions land as PROCESSING (not COMPLETED) because Kadima
  // takes 1–3 business days to settle. This check fetches the latest
  // status from Kadima for every PROCESSING payment with a
  // transaction id, and:
  //
  //   • Settled / Approved / Posted → flip to COMPLETED, set paidAt
  //   • Returned / Failed / Rejected / Declined → flip to FAILED,
  //     write a REVERSAL ledger entry (undoes the PAYMENT entry that
  //     was written at submit time), journal a REFUND entry (undoes
  //     the auto-journaled accounting), and notify the PM with the
  //     return reason
  //   • Submitted / Pending / unknown → still in flight, no-op
  //
  // Idempotent: re-running on already-settled/already-bounced rows
  // is a no-op (status is no longer PROCESSING). Cap the per-run
  // workload at 200 rows so a backlog never blows the function
  // timeout — the next run picks up the rest.
  const processingPayments = await db.payment.findMany({
    where: {
      status: "PROCESSING",
      kadimaTransactionId: { not: null },
      paymentMethod: "ach",
    },
    select: {
      id: true,
      tenantId: true,
      unitId: true,
      landlordId: true,
      amount: true,
      kadimaTransactionId: true,
      type: true,
      description: true,
      dueDate: true,
      tenant: {
        select: { user: { select: { name: true, email: true } } },
      },
    },
    take: 200,
  });

  if (processingPayments.length > 0) {
    const { getAchTransaction } = await import("@/lib/kadima/ach");

    for (const p of processingPayments) {
      results.achProcessing.polled += 1;
      try {
        const remote = (await getAchTransaction(p.kadimaTransactionId!)) as {
          id?: string | number;
          status?: { status?: string } | string;
          settledAt?: string;
          returnCode?: string;
          returnReason?: string;
        };
        const rawStatus =
          typeof remote.status === "string"
            ? remote.status
            : remote.status?.status;
        const normalized = (rawStatus || "").toLowerCase();

        const settled = ["settled", "approved", "posted", "completed"].includes(
          normalized
        );
        const bounced = ["returned", "failed", "rejected", "declined"].includes(
          normalized
        );

        if (settled) {
          await db.payment.update({
            where: { id: p.id },
            data: {
              status: "COMPLETED",
              kadimaStatus: rawStatus || "Settled",
              paidAt: remote.settledAt ? new Date(remote.settledAt) : now,
            },
          });
          results.achProcessing.settled += 1;
        } else if (bounced) {
          // Reverse the ledger PAYMENT entry that was written at submit.
          const reversalPeriod = periodKeyFromDate(p.dueDate || now);
          await recordReversal({
            tenantId: p.tenantId,
            unitId: p.unitId,
            paymentId: p.id,
            amount: Number(p.amount),
            periodKey: reversalPeriod,
            reason: remote.returnReason
              ? `ACH return — ${remote.returnReason}`
              : `ACH return — ${rawStatus || "Returned"}`,
          }).catch((e) =>
            console.error(
              "[reconciliation] recordReversal failed:",
              p.id,
              e
            )
          );

          // Journal the refund (mirrors the original journal entry's
          // direction). Idempotent via journalRefund's dedup guard.
          try {
            const { journalRefund } = await import(
              "@/lib/accounting/auto-entries"
            );
            await journalRefund({
              pmId: p.landlordId,
              paymentId: p.id,
              amount: Number(p.amount),
              date: now,
              tenantId: p.tenantId,
              isPartial: false,
            });
          } catch (journalErr) {
            console.error(
              "[reconciliation] journalRefund failed:",
              p.id,
              journalErr
            );
          }

          await db.payment.update({
            where: { id: p.id },
            data: {
              status: "FAILED",
              kadimaStatus: rawStatus || "Returned",
              failedReason:
                remote.returnReason ||
                remote.returnCode ||
                `ACH ${rawStatus || "returned"}`,
            },
          });

          // Notify PM — bounced ACH means money didn't actually move.
          try {
            const pmNotice = await import("@/lib/notifications");
            const tenantName = p.tenant?.user?.name || "Tenant";
            await pmNotice.notify({
              userId: p.landlordId,
              createdById: p.landlordId,
              type: "ach_bounce",
              title: "ACH payment returned",
              message: `${tenantName}'s ACH payment of $${Number(p.amount).toFixed(2)} (${p.description || p.type}) was returned: ${remote.returnReason || rawStatus || "unknown reason"}. The ledger has been reversed.`,
              severity: "urgent",
              amount: Number(p.amount),
              actionUrl: `/dashboard/payments?paymentId=${p.id}`,
            });
          } catch (notifyErr) {
            console.error(
              "[reconciliation] PM bounce notify failed:",
              p.id,
              notifyErr
            );
          }

          results.achProcessing.bounced += 1;
          results.achProcessing.details.push(
            `BOUNCE — payment ${p.id} ($${Number(p.amount).toFixed(2)} from ${p.tenant?.user?.name || "?"}): ${remote.returnReason || rawStatus || "unknown"}`
          );
          // Audit trail
          auditLog({
            userId: null,
            userRole: "SYSTEM",
            action: "ACH_BOUNCE",
            objectType: "Payment",
            objectId: p.id,
            description: `ACH bounced: ${remote.returnReason || rawStatus || "unknown"}. Ledger reversed.`,
          });
        } else {
          results.achProcessing.stillPending += 1;
        }
      } catch (err) {
        results.achProcessing.errors += 1;
        const msg = err instanceof Error ? err.message : String(err);
        results.achProcessing.details.push(
          `ERROR polling ${p.id}: ${msg.slice(0, 120)}`
        );
        console.error(
          "[reconciliation] ACH poll failed for payment",
          p.id,
          err
        );
      }
    }
  }

  // ── CHECK 4: Missing monthly CHARGE entries ──
  // Only check on day >= 2 (charges cron runs on 1st at 6 AM).

  const periodKey = periodKeyFromDate(now);

  if (now.getDate() >= 2) {
    const activeTenants = await db.tenantProfile.findMany({
      where: {
        status: "ACTIVE",
        unitId: { not: null },
      },
      include: {
        unit: {
          select: { id: true, rentAmount: true },
        },
        user: { select: { name: true } },
        ledgerEntries: {
          where: {
            type: "CHARGE",
            periodKey,
            paymentId: null,
          },
          select: { id: true },
        },
      },
    });

    const missingCharge = activeTenants.filter(
      (t) => t.unit && t.ledgerEntries.length === 0
    );

    results.missingCharges.found = missingCharge.length;
    const monthLabel = now.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    for (const tenant of missingCharge) {
      if (!tenant.unit) continue;

      const rent = Number(tenant.unit.rentAmount);
      const monthlyCharge = (rent * tenant.splitPercent) / 100;

      if (monthlyCharge <= 0) {
        results.missingCharges.found--;
        continue;
      }

      try {
        const entry = await createChargeEntry({
          tenantId: tenant.id,
          unitId: tenant.unit.id,
          amount: monthlyCharge,
          periodKey,
          description: `${monthLabel} rent (reconciliation auto-fix)`,
        });
        results.missingCharges.fixed++;
        if (entry) {
          results.missingCharges.details.push(
            `${tenant.user?.name || "Unknown"} — $${monthlyCharge.toFixed(2)} charge created`
          );
        }
      } catch {
        results.missingCharges.failed++;
        results.missingCharges.details.push(
          `${tenant.user?.name || "Unknown"} — charge auto-fix failed`
        );
      }
    }
  }

  // ── CHECK 5: Balance drift ──
  // Recalculate balance from scratch (SUM of all amounts) and compare
  // to the latest balanceAfter. Any mismatch = corrupted running balance.

  const tenantsWithLedger = await db.ledgerEntry.findMany({
    distinct: ["tenantId"],
    select: { tenantId: true },
  });

  for (const { tenantId } of tenantsWithLedger) {
    const sumResult = await db.ledgerEntry.aggregate({
      where: { tenantId },
      _sum: { amount: true },
    });

    const latestEntry = await db.ledgerEntry.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        balanceAfter: true,
        tenant: { select: { user: { select: { name: true } } } },
      },
    });

    if (!latestEntry || !sumResult._sum.amount) continue;

    const calculatedBalance = new Decimal(sumResult._sum.amount.toString());
    const recordedBalance = new Decimal(latestEntry.balanceAfter.toString());

    if (!calculatedBalance.equals(recordedBalance)) {
      results.balanceDrift.found++;
      const tenantName = latestEntry.tenant?.user?.name || "Unknown";
      const drift = calculatedBalance.minus(recordedBalance).toFixed(2);
      results.balanceDrift.details.push(
        `${tenantName}: recorded=$${recordedBalance.toFixed(2)}, calculated=$${calculatedBalance.toFixed(2)}, drift=$${drift}`
      );
    }
  }

  // ── Summary ───────────────────────────────────────
  const autoFixed =
    results.completedMissingLedger.fixed +
    results.refundedMissingReversal.fixed +
    results.missingCharges.fixed;

  const flagged =
    results.stalePending.found +
    results.balanceDrift.found +
    results.completedMissingLedger.failed +
    results.refundedMissingReversal.failed +
    results.missingCharges.failed;

  const totalIssues =
    results.completedMissingLedger.found +
    results.refundedMissingReversal.found +
    results.stalePending.found +
    results.missingCharges.found +
    results.balanceDrift.found;

  // ── Audit log ─────────────────────────────────────
  auditLog({
    action: "PROCESS",
    objectType: "Reconciliation",
    description: `Daily reconciliation: ${totalIssues} issues found, ${autoFixed} auto-fixed, ${flagged} flagged`,
    newValue: {
      ranAt: now.toISOString(),
      totalIssues,
      autoFixed,
      flagged,
      checks: {
        completedMissingLedger: results.completedMissingLedger.found,
        refundedMissingReversal: results.refundedMissingReversal.found,
        stalePending: results.stalePending.found,
        missingCharges: results.missingCharges.found,
        balanceDrift: results.balanceDrift.found,
      },
    },
  });

  // ── Notify admins if any issues found ─────────────
  if (totalIssues > 0) {
    const admins = await db.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    const parts: string[] = [];
    if (results.completedMissingLedger.found > 0)
      parts.push(
        `${results.completedMissingLedger.found} missing payment ledger entries (${results.completedMissingLedger.fixed} auto-fixed)`
      );
    if (results.refundedMissingReversal.found > 0)
      parts.push(
        `${results.refundedMissingReversal.found} missing reversal entries (${results.refundedMissingReversal.fixed} auto-fixed)`
      );
    if (results.stalePending.found > 0)
      parts.push(
        `${results.stalePending.found} stale pending payments (needs review)`
      );
    if (results.missingCharges.found > 0)
      parts.push(
        `${results.missingCharges.found} missing monthly charges (${results.missingCharges.fixed} auto-fixed)`
      );
    if (results.balanceDrift.found > 0)
      parts.push(
        `${results.balanceDrift.found} tenant balance drifts (needs review)`
      );

    const severity: "info" | "warning" | "urgent" =
      flagged > 0 ? "warning" : "info";

    for (const admin of admins) {
      notify({
        userId: admin.id,
        createdById: admin.id,
        type: "RECONCILIATION_REPORT",
        title: `Daily Reconciliation: ${totalIssues} issue${totalIssues === 1 ? "" : "s"} found`,
        message: parts.join(". ") + ".",
        severity,
      }).catch(console.error);
    }
  }

  // ── Response ──────────────────────────────────────
  return NextResponse.json({
    success: true,
    ranAt: now.toISOString(),
    checks: {
      completedMissingLedger: results.completedMissingLedger,
      refundedMissingReversal: results.refundedMissingReversal,
      stalePending: results.stalePending,
      missingCharges: results.missingCharges,
      balanceDrift: results.balanceDrift,
      achProcessing: results.achProcessing,
    },
    autoFixed,
    flagged,
  });
}

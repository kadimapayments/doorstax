/**
 * Financial Reconciliation Engine
 *
 * Compares gateway (Kadima) transaction records against local Payment
 * records and LedgerEntry data. Generates reports with alerts for any
 * discrepancies found.
 *
 * CRITICAL: This engine NEVER modifies the ledger or payment records.
 * It is strictly a read-and-report system. The existing reconciliation
 * cron (/api/cron/reconciliation) handles auto-fixes.
 */

import { db } from "@/lib/db";
import { listCardTransactions, listAchTransactions } from "@/lib/kadima/reporting";

// TODO: [MULTI-MERCHANT] This reconciliation engine fetches transactions using
// the global Kadima client, which only sees one merchant's transactions.
// To reconcile across all PMs, this needs to iterate over each PM with
// merchant credentials and fetch their transactions separately using
// getMerchantCredentials() + createMerchantGatewayClient().
// See: src/lib/kadima/merchant-context.ts, merchant-client.ts
import { notify } from "@/lib/notifications";
import { auditLog } from "@/lib/audit";
import type {
  Prisma,
  ReconciliationAlertSeverity,
} from "@prisma/client";

// ─── Types ──────────────────────────────────────────────────

interface GatewayTransaction {
  id: string;
  amount: number;
  status: string;
  type: "card" | "ach";
  createdAt?: string;
}

interface AlertInput {
  alertType: string;
  severity: ReconciliationAlertSeverity;
  paymentId?: string;
  gatewayTxnId?: string;
  details: Prisma.InputJsonValue;
}

// ─── Main Reconciliation Function ───────────────────────────

/**
 * Run financial reconciliation for a given date.
 * Compares all Kadima transactions for the date against local records.
 * Returns the created ReconciliationReport.
 */
export async function runFinancialReconciliation(reportDate: Date) {
  console.warn(
    "[reconciliation-engine] Running with global credentials. " +
    "In multi-merchant mode, this only reconciles the platform merchant's transactions. " +
    "Per-PM reconciliation requires iterating over each PM's credentials."
  );

  const dateStr = reportDate.toISOString().split("T")[0];
  const nextDate = new Date(reportDate);
  nextDate.setDate(nextDate.getDate() + 1);
  const nextDateStr = nextDate.toISOString().split("T")[0];

  // ── Fetch gateway transactions ────────────────────────────

  const gatewayMap = new Map<string, GatewayTransaction>();

  try {
    const cardResult = await listCardTransactions({
      dateFrom: dateStr,
      dateTo: nextDateStr,
    });
    if (cardResult.data) {
      const txns = Array.isArray(cardResult.data) ? cardResult.data : [];
      for (const txn of txns) {
        gatewayMap.set(txn.id, {
          id: txn.id,
          amount: txn.amount,
          status: txn.status,
          type: "card",
          createdAt: txn.createdAt,
        });
      }
    }
  } catch (err) {
    console.error("[reconciliation-engine] Failed to fetch card transactions:", err);
  }

  try {
    const achResult = await listAchTransactions({
      dateFrom: dateStr,
      dateTo: nextDateStr,
    });
    if (achResult.data) {
      const txns = Array.isArray(achResult.data) ? achResult.data : [];
      for (const txn of txns) {
        gatewayMap.set(txn.id, {
          id: txn.id,
          amount: txn.amount,
          status: txn.status,
          type: "ach",
          createdAt: txn.createdAt,
        });
      }
    }
  } catch (err) {
    console.error("[reconciliation-engine] Failed to fetch ACH transactions:", err);
  }

  // ── Fetch local payment records ───────────────────────────

  const startOfDay = new Date(dateStr + "T00:00:00.000Z");
  const endOfDay = new Date(nextDateStr + "T00:00:00.000Z");

  const localPayments = await db.payment.findMany({
    where: {
      createdAt: { gte: startOfDay, lt: endOfDay },
      kadimaTransactionId: { not: null },
    },
    select: {
      id: true,
      amount: true,
      status: true,
      kadimaTransactionId: true,
      paymentMethod: true,
      createdAt: true,
    },
  });

  // Build local map (keyed by kadimaTransactionId)
  const localMap = new Map<string, typeof localPayments[0]>();
  const alerts: AlertInput[] = [];

  // ── Check for duplicates ──────────────────────────────────

  const txnIdCounts = new Map<string, string[]>();
  for (const payment of localPayments) {
    const txnId = payment.kadimaTransactionId!;
    const existing = txnIdCounts.get(txnId) || [];
    existing.push(payment.id);
    txnIdCounts.set(txnId, existing);
    localMap.set(txnId, payment);
  }

  let duplicatesFound = 0;
  for (const [txnId, paymentIds] of txnIdCounts) {
    if (paymentIds.length > 1) {
      duplicatesFound++;
      alerts.push({
        alertType: "DUPLICATE",
        severity: "WARNING",
        gatewayTxnId: txnId,
        details: {
          paymentIds,
          count: paymentIds.length,
          message: `${paymentIds.length} local payments share gateway transaction ${txnId}`,
        },
      });
    }
  }

  // ── Compare gateway vs local ──────────────────────────────

  let matchedCount = 0;
  let missingLocal = 0;
  let missingGateway = 0;
  let amountMismatches = 0;

  // Gateway transactions not found locally
  for (const [txnId, gwTxn] of gatewayMap) {
    const localPayment = localMap.get(txnId);

    if (!localPayment) {
      missingLocal++;
      alerts.push({
        alertType: "MISSING_LOCAL",
        severity: "CRITICAL",
        gatewayTxnId: txnId,
        details: {
          gatewayAmount: gwTxn.amount,
          gatewayStatus: gwTxn.status,
          gatewayType: gwTxn.type,
          gatewayDate: gwTxn.createdAt,
          message: `Gateway transaction ${txnId} has no matching local payment`,
        },
      });
      continue;
    }

    matchedCount++;

    // Amount comparison (allow small floating point difference)
    const localAmount = Number(localPayment.amount);
    const diff = Math.abs(localAmount - gwTxn.amount);
    if (diff > 0.01) {
      amountMismatches++;
      alerts.push({
        alertType: "AMOUNT_MISMATCH",
        severity: "CRITICAL",
        paymentId: localPayment.id,
        gatewayTxnId: txnId,
        details: {
          localAmount,
          gatewayAmount: gwTxn.amount,
          difference: Number((localAmount - gwTxn.amount).toFixed(2)),
          message: `Amount mismatch: local=$${localAmount.toFixed(2)}, gateway=$${gwTxn.amount.toFixed(2)}`,
        },
      });
    }

    // Status comparison
    const statusMismatch = detectStatusMismatch(localPayment.status, gwTxn.status);
    if (statusMismatch) {
      alerts.push({
        alertType: "STATUS_MISMATCH",
        severity: "WARNING",
        paymentId: localPayment.id,
        gatewayTxnId: txnId,
        details: {
          localStatus: localPayment.status,
          gatewayStatus: gwTxn.status,
          message: statusMismatch,
        },
      });
    }
  }

  // Local payments not found in gateway
  for (const payment of localPayments) {
    const txnId = payment.kadimaTransactionId!;
    if (!gatewayMap.has(txnId)) {
      missingGateway++;
      alerts.push({
        alertType: "MISSING_GATEWAY",
        severity: "WARNING",
        paymentId: payment.id,
        gatewayTxnId: txnId,
        details: {
          localAmount: Number(payment.amount),
          localStatus: payment.status,
          message: `Local payment ${payment.id} references gateway txn ${txnId} not found in gateway`,
        },
      });
    }
  }

  // ── Create report ─────────────────────────────────────────

  const report = await db.reconciliationReport.upsert({
    where: { reportDate: startOfDay },
    create: {
      reportDate: startOfDay,
      totalGatewayTxns: gatewayMap.size,
      totalLocalTxns: localPayments.length,
      matchedCount,
      missingLocal,
      missingGateway,
      amountMismatches,
      duplicatesFound,
      totalAlerts: alerts.length,
      summary: {
        dateRange: { from: dateStr, to: nextDateStr },
        gatewayBreakdown: {
          card: [...gatewayMap.values()].filter((t) => t.type === "card").length,
          ach: [...gatewayMap.values()].filter((t) => t.type === "ach").length,
        },
      },
      alerts: {
        create: alerts.map((a) => ({
          alertType: a.alertType,
          severity: a.severity,
          paymentId: a.paymentId,
          gatewayTxnId: a.gatewayTxnId,
          details: a.details,
        })),
      },
    },
    update: {
      totalGatewayTxns: gatewayMap.size,
      totalLocalTxns: localPayments.length,
      matchedCount,
      missingLocal,
      missingGateway,
      amountMismatches,
      duplicatesFound,
      totalAlerts: alerts.length,
      summary: {
        dateRange: { from: dateStr, to: nextDateStr },
        gatewayBreakdown: {
          card: [...gatewayMap.values()].filter((t) => t.type === "card").length,
          ach: [...gatewayMap.values()].filter((t) => t.type === "ach").length,
        },
      },
    },
    include: { alerts: true },
  });

  // If updating an existing report, recreate alerts
  if (report.alerts.length === 0 && alerts.length > 0) {
    await db.reconciliationAlert.createMany({
      data: alerts.map((a) => ({
        reportId: report.id,
        alertType: a.alertType,
        severity: a.severity,
        paymentId: a.paymentId,
        gatewayTxnId: a.gatewayTxnId,
        details: a.details,
      })),
    });
  }

  // ── Audit log ─────────────────────────────────────────────

  auditLog({
    action: "PROCESS",
    objectType: "ReconciliationReport",
    objectId: report.id,
    description: `Financial reconciliation for ${dateStr}: ${alerts.length} alerts (${missingLocal} missing local, ${missingGateway} missing gateway, ${amountMismatches} amount mismatches, ${duplicatesFound} duplicates)`,
  });

  // ── Notify admins if critical alerts ──────────────────────

  const criticalAlerts = alerts.filter((a) => a.severity === "CRITICAL");
  if (criticalAlerts.length > 0) {
    const admins = await db.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    for (const admin of admins) {
      notify({
        userId: admin.id,
        createdById: admin.id,
        type: "RECONCILIATION_ALERT",
        title: `Financial Reconciliation: ${criticalAlerts.length} critical alert(s)`,
        message: `Reconciliation for ${dateStr} found ${criticalAlerts.length} critical discrepancies between gateway and local records. Review required.`,
        severity: "urgent",
      }).catch(console.error);
    }
  }

  return report;
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Detect status mismatches between local and gateway.
 * Returns a message if mismatch found, null otherwise.
 */
function detectStatusMismatch(
  localStatus: string,
  gatewayStatus: string
): string | null {
  // Normalize gateway statuses
  const gwNormalized = gatewayStatus.toLowerCase();

  // Map expected gateway states to local states
  const statusMap: Record<string, string[]> = {
    COMPLETED: ["complete", "approved", "settled", "success"],
    FAILED: ["declined", "failed", "error", "void"],
    REFUNDED: ["refunded", "returned"],
    PENDING: ["pending", "processing"],
  };

  const expectedGateway = statusMap[localStatus];
  if (!expectedGateway) return null;

  if (!expectedGateway.includes(gwNormalized)) {
    return `Local status "${localStatus}" but gateway shows "${gatewayStatus}"`;
  }

  return null;
}

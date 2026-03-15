import { withCronGuard } from "@/lib/cron-guard";
import { runFinancialReconciliation } from "@/lib/reconciliation-engine";

/**
 * Financial Reconciliation Cron
 *
 * Compares Kadima gateway transactions with local payment records
 * for the previous day. Creates ReconciliationReport + alerts.
 *
 * NEVER modifies the ledger — report only.
 *
 * Schedule: 0 11 * * * (daily at 11 AM UTC)
 */
export const GET = withCronGuard("financial-reconciliation", async () => {
  // Reconcile yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const report = await runFinancialReconciliation(yesterday);

  return {
    summary: {
      reportId: report.id,
      reportDate: yesterday.toISOString().split("T")[0],
      totalGatewayTxns: report.totalGatewayTxns,
      totalLocalTxns: report.totalLocalTxns,
      matchedCount: report.matchedCount,
      totalAlerts: report.totalAlerts,
      missingLocal: report.missingLocal,
      missingGateway: report.missingGateway,
      amountMismatches: report.amountMismatches,
      duplicatesFound: report.duplicatesFound,
    },
  };
});

import { kadimaClient, withRetry } from "./client";
import type {
  AchTransaction,
  CardTransaction,
  SettlementBatch,
  TransactionListParams,
  KadimaListResponse,
} from "./types";

const KADIMA_DASHBOARD_BASE =
  process.env.KADIMA_DASHBOARD_BASE || "https://sandbox.kadimadashboard.com/api";

/**
 * List card transactions with filters.
 * GET /transaction
 */
export async function listCardTransactions(
  params?: TransactionListParams
): Promise<KadimaListResponse<CardTransaction>> {
  return withRetry(async () => {
    const { data } = await kadimaClient.get("/transaction", { params });
    return data;
  });
}

/**
 * List ACH transactions with filters.
 * GET /ach
 */
export async function listAchTransactions(
  params?: TransactionListParams
): Promise<KadimaListResponse<AchTransaction>> {
  return withRetry(async () => {
    const { data } = await kadimaClient.get("/ach", { params });
    return data;
  });
}

/**
 * Get ACH settlement batches.
 * GET /ach/settlement
 */
export async function getAchSettlements(params?: {
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  perPage?: number;
}): Promise<KadimaListResponse<SettlementBatch>> {
  return withRetry(async () => {
    const { data } = await kadimaClient.get("/ach/settlement", { params });
    return data;
  });
}

// ═══════════════════════════════════════════════════════
//  Kadima Dashboard Reporting — Merchant Statements
// ═══════════════════════════════════════════════════════

async function dashboardFetch(path: string, apiToken: string) {
  const res = await fetch(KADIMA_DASHBOARD_BASE + path, {
    headers: {
      Authorization: "Bearer " + apiToken,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Kadima reporting error (${res.status}): ${err.message || "Unknown"}`
    );
  }
  return res;
}

/** List pre-generated statement PDFs for a DBA */
export async function listStatements(dbaId: number, apiToken: string) {
  const res = await dashboardFetch(
    "/reporting/statements/" + dbaId,
    apiToken
  );
  return res.json();
}

/** Download a specific statement PDF (returns binary) */
export async function downloadStatement(
  statementId: string,
  apiToken: string
): Promise<ArrayBuffer> {
  const res = await fetch(
    KADIMA_DASHBOARD_BASE + "/reporting/statement/" + statementId,
    { headers: { Authorization: "Bearer " + apiToken } }
  );
  if (!res.ok) throw new Error("Failed to download statement: " + res.status);
  return res.arrayBuffer();
}

/** List transactions for a DBA within a date range */
export async function listMerchantTransactions(
  dbaId: number,
  apiToken: string,
  filters: { from?: string; to?: string; page?: number }
) {
  const url = new URL(
    KADIMA_DASHBOARD_BASE + "/reporting/transactions/" + dbaId
  );
  if (filters.from) url.searchParams.set("filter[date]", filters.from);
  if (filters.to) url.searchParams.set("filter[date][to]", filters.to);
  if (filters.page) url.searchParams.set("page", String(filters.page));
  const res = await dashboardFetch(
    url.pathname + url.search,
    apiToken
  );
  return res.json();
}

/** List batches for a DBA */
export async function listBatches(
  dbaId: number,
  apiToken: string,
  filters?: { from?: string; to?: string }
) {
  const url = new URL(
    KADIMA_DASHBOARD_BASE + "/reporting/batches/" + dbaId
  );
  if (filters?.from) url.searchParams.set("filter[batch.date]", filters.from);
  if (filters?.to) url.searchParams.set("filter[batch.date][to]", filters.to);
  const res = await dashboardFetch(
    url.pathname + url.search,
    apiToken
  );
  return res.json();
}

/** List payouts for a DBA */
export async function listPayouts(
  dbaId: number,
  apiToken: string,
  filters?: { from?: string; to?: string }
) {
  const url = new URL(
    KADIMA_DASHBOARD_BASE + "/reporting/payouts/acq/" + dbaId
  );
  if (filters?.from)
    url.searchParams.set("filter[processingDate]", filters.from);
  if (filters?.to)
    url.searchParams.set("filter[processingDate][to]", filters.to);
  const res = await dashboardFetch(
    url.pathname + url.search,
    apiToken
  );
  return res.json();
}

/** List chargebacks for a DBA */
export async function listChargebacks(
  dbaId: number,
  apiToken: string,
  filters?: { from?: string; to?: string }
) {
  const url = new URL(
    KADIMA_DASHBOARD_BASE + "/reporting/chargebacks/" + dbaId
  );
  if (filters?.from)
    url.searchParams.set("filter[date.posted]", filters.from);
  if (filters?.to)
    url.searchParams.set("filter[date.posted][to]", filters.to);
  const res = await dashboardFetch(
    url.pathname + url.search,
    apiToken
  );
  return res.json();
}

/** Get all reporting data for a month */
export async function getMonthlyReportingData(
  dbaId: number,
  apiToken: string,
  year: number,
  month: number
) {
  const from =
    year + "-" + String(month).padStart(2, "0") + "-01";
  const lastDay = new Date(year, month, 0).getDate();
  const to =
    year +
    "-" +
    String(month).padStart(2, "0") +
    "-" +
    String(lastDay).padStart(2, "0");

  const [transactions, batches, payouts, chargebacks] =
    await Promise.allSettled([
      listMerchantTransactions(dbaId, apiToken, { from, to }),
      listBatches(dbaId, apiToken, { from, to }),
      listPayouts(dbaId, apiToken, { from, to }),
      listChargebacks(dbaId, apiToken, { from, to }),
    ]);

  return {
    period: { from, to, year, month },
    transactions:
      transactions.status === "fulfilled" ? transactions.value : null,
    batches: batches.status === "fulfilled" ? batches.value : null,
    payouts: payouts.status === "fulfilled" ? payouts.value : null,
    chargebacks:
      chargebacks.status === "fulfilled" ? chargebacks.value : null,
  };
}

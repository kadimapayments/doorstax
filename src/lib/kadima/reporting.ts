import { kadimaClient, withRetry } from "./client";
import type {
  AchTransaction,
  CardTransaction,
  SettlementBatch,
  TransactionListParams,
  KadimaListResponse,
} from "./types";

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

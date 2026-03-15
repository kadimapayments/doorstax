import { kadimaClient, withRetry } from "./client";
import type {
  AchTransaction,
  CreateAchPayload,
  AchListParams,
  KadimaResponse,
  KadimaListResponse,
} from "./types";

/**
 * Create an ACH transaction.
 * POST /ach
 */
export async function createAchTransaction(
  payload: CreateAchPayload & { terminalId?: string }
): Promise<KadimaResponse<AchTransaction>> {
  return withRetry(async () => {
    const { data } = await kadimaClient.post("/ach", {
      ...payload,
      ...(payload.terminalId ? { terminalId: payload.terminalId } : {}),
    });
    return data;
  });
}

/**
 * List ACH transactions.
 * GET /ach
 */
export async function listAchTransactions(
  params?: AchListParams
): Promise<KadimaListResponse<AchTransaction>> {
  return withRetry(async () => {
    const { data } = await kadimaClient.get("/ach", { params });
    return data;
  });
}

/**
 * Get a specific ACH transaction.
 * GET /ach/:id
 */
export async function getAchTransaction(
  id: string
): Promise<KadimaResponse<AchTransaction>> {
  return withRetry(async () => {
    const { data } = await kadimaClient.get(`/ach/${id}`);
    return data;
  });
}

/**
 * Remove/void an ACH transaction.
 * DELETE /ach/:id
 */
export async function removeAchTransaction(
  id: string
): Promise<KadimaResponse> {
  return withRetry(async () => {
    const { data } = await kadimaClient.delete(`/ach/${id}`);
    return data;
  });
}

/**
 * Create ACH transaction using a saved customer account.
 * POST /ach with customerId + accountId
 */
export async function createAchFromVault(params: {
  customerId: string;
  accountId: string;
  amount: number;
  memo?: string;
  terminalId?: string;
}): Promise<KadimaResponse<AchTransaction>> {
  return withRetry(async () => {
    const { data } = await kadimaClient.post("/ach", {
      amount: params.amount,
      customerId: params.customerId,
      accountId: params.accountId,
      memo: params.memo,
      ...(params.terminalId ? { terminalId: params.terminalId } : {}),
    });
    return data;
  });
}

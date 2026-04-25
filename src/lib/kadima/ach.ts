import { vaultClient, withRetry } from "./client";
import type { AchSecCode } from "./sec-code";
import type {
  AchTransaction,
  KadimaResponse,
  KadimaListResponse,
  AchListParams,
} from "./types";

/**
 * Get the DBA ID required for ACH operations.
 */
function getDbaId(): number {
  const dbaId = process.env.KADIMA_DBA_ID;
  if (!dbaId) {
    throw new Error("KADIMA_DBA_ID is required for ACH operations");
  }
  return Number(dbaId);
}

/**
 * Create an ACH transaction with inline customer details.
 * POST /ach  (on Dashboard API, NOT gateway)
 *
 * Per Kadima API docs, required payload:
 *   amount: <number>
 *   transactionType: "Debit" | "Credit"
 *   dba: { id: <int> }
 *   customer: { firstName, lastName, email, ... } or { id: <int> }
 *   account: { routingNumber, accountNumber, type, name } or { id: <int> }
 */
export async function createAchTransaction(params: {
  amount: number;
  firstName: string;
  lastName: string;
  email?: string;
  routingNumber: string;
  accountNumber: string;
  accountType: "checking" | "savings";
  /**
   * NACHA SEC code — required by Kadima as of 2026-05-05. Use
   * `pickSecCode()` from `./sec-code` to resolve from a context type
   * rather than picking a string here directly.
   */
  secCode: AchSecCode;
  memo?: string;
}): Promise<KadimaResponse<AchTransaction>> {
  // Kadima's API expects the field as `SECCode` on the wire (per their
  // published curl example) — we capitalise here at the boundary while
  // keeping our TS types camelCase per convention.
  const requestBody = {
    amount: params.amount,
    transactionType: "Debit",
    dba: { id: getDbaId() },
    customer: {
      firstName: params.firstName,
      lastName: params.lastName,
      ...(params.email ? { email: params.email } : {}),
    },
    account: {
      routingNumber: params.routingNumber,
      accountNumber: params.accountNumber,
      type: params.accountType === "checking" ? "Checking" : "Savings",
      name: `${params.firstName} ${params.lastName}`,
    },
    SECCode: params.secCode,
    ...(params.memo ? { memo: params.memo } : {}),
  };

  console.log("[ach] createAchTransaction:", { amount: requestBody.amount, SECCode: requestBody.SECCode });
  return withRetry(async () => {
    const { data } = await vaultClient.post("/ach", requestBody);
    console.log("[ach] createAchTransaction response:", { id: data?.id, status: data?.status });
    return data;
  });
}

/**
 * List ACH transactions.
 * GET /ach  (on Dashboard API)
 */
export async function listAchTransactions(
  params?: AchListParams
): Promise<KadimaListResponse<AchTransaction>> {
  return withRetry(async () => {
    const { data } = await vaultClient.get("/ach", { params });
    return data;
  });
}

/**
 * Get a specific ACH transaction.
 * GET /ach/:id  (on Dashboard API)
 */
export async function getAchTransaction(
  id: string
): Promise<KadimaResponse<AchTransaction>> {
  return withRetry(async () => {
    const { data } = await vaultClient.get(`/ach/${id}`);
    return data;
  });
}

/**
 * Remove/void an ACH transaction.
 * DELETE /ach/:id  (on Dashboard API)
 */
export async function removeAchTransaction(
  id: string
): Promise<KadimaResponse> {
  return withRetry(async () => {
    const { data } = await vaultClient.delete(`/ach/${id}`);
    return data;
  });
}

/**
 * Create ACH transaction using a saved customer vault account.
 * POST /ach  (on Dashboard API)
 *
 * Per Kadima API docs:
 *   customer: { id: <int> }
 *   account: { id: <int> }
 *   dba: { id: <int> }
 *   transactionType: "Debit"
 */
export async function createAchFromVault(params: {
  customerId: string;
  accountId: string;
  amount: number;
  /**
   * NACHA SEC code — required by Kadima as of 2026-05-05. Use
   * `pickSecCode()` from `./sec-code` to resolve from a context type.
   */
  secCode: AchSecCode;
  memo?: string;
}): Promise<KadimaResponse<AchTransaction>> {
  const requestBody = {
    amount: params.amount,
    transactionType: "Debit",
    dba: { id: getDbaId() },
    customer: { id: Number(params.customerId) },
    account: { id: Number(params.accountId) },
    SECCode: params.secCode,
    ...(params.memo ? { memo: params.memo } : {}),
  };

  console.log("[ach] createAchFromVault:", { amount: requestBody.amount, customerId: params.customerId, SECCode: requestBody.SECCode });
  return withRetry(async () => {
    const { data } = await vaultClient.post("/ach", requestBody);
    console.log("[ach] createAchFromVault response:", { id: data?.id, status: data?.status });
    return data;
  });
}

/**
 * Merchant-scoped ACH operations.
 *
 * Uses per-PM credentials via MerchantCredentials instead of global env vars.
 * The PM's API key scopes ACH operations to their merchant account.
 */

import { withRetry } from "./client";
import type { MerchantCredentials } from "./merchant-context";
import { createMerchantVaultClient } from "./merchant-client";

export async function merchantCreateAchDebit(
  creds: MerchantCredentials,
  params: {
    customerId: string;
    accountId: string;
    amount: number;
    memo?: string;
  }
): Promise<unknown> {
  const client = createMerchantVaultClient(creds);
  const requestBody = {
    amount: params.amount,
    transactionType: "Debit",
    customer: { id: Number(params.customerId) },
    account: { id: Number(params.accountId) },
    ...(params.memo ? { memo: params.memo } : {}),
  };

  console.log("[merchant-ach] createAchDebit:", JSON.stringify({
    pmUserId: creds.pmUserId,
    credSource: creds.source,
    amount: params.amount,
    customerId: params.customerId,
  }));

  return withRetry(async () => {
    const { data } = await client.post("/ach", requestBody);
    return data;
  });
}

export async function merchantCreateAchCredit(
  creds: MerchantCredentials,
  params: {
    customerId: string;
    accountId: string;
    amount: number;
    memo?: string;
  }
): Promise<unknown> {
  const client = createMerchantVaultClient(creds);
  const requestBody = {
    amount: params.amount,
    transactionType: "Credit",
    customer: { id: Number(params.customerId) },
    account: { id: Number(params.accountId) },
    ...(params.memo ? { memo: params.memo } : {}),
  };

  console.log("[merchant-ach] createAchCredit:", JSON.stringify({
    pmUserId: creds.pmUserId,
    credSource: creds.source,
    amount: params.amount,
    customerId: params.customerId,
  }));

  return withRetry(async () => {
    const { data } = await client.post("/ach", requestBody);
    return data;
  });
}

export async function merchantListAchTransactions(
  creds: MerchantCredentials,
  params?: Record<string, unknown>
): Promise<unknown> {
  const client = createMerchantVaultClient(creds);
  return withRetry(async () => {
    const { data } = await client.get("/ach", { params });
    return data;
  });
}

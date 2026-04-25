/**
 * Merchant-scoped ACH operations.
 *
 * Uses per-PM credentials via MerchantCredentials instead of global env vars.
 * The PM's API key scopes ACH operations to their merchant account.
 */

import { withRetry } from "./client";
import type { MerchantCredentials } from "./merchant-context";
import { createMerchantVaultClient } from "./merchant-client";
import type { AchSecCode } from "./sec-code";

export async function merchantCreateAchDebit(
  creds: MerchantCredentials,
  params: {
    customerId: string;
    accountId: string;
    amount: number;
    /**
     * NACHA SEC code — required by Kadima as of 2026-05-05. Use
     * `pickSecCode()` from `./sec-code` to resolve from a context type.
     */
    secCode: AchSecCode;
    memo?: string;
  }
): Promise<unknown> {
  const client = createMerchantVaultClient(creds);
  const requestBody = {
    amount: params.amount,
    transactionType: "Debit",
    customer: { id: Number(params.customerId) },
    account: { id: Number(params.accountId) },
    SECCode: params.secCode,
    ...(params.memo ? { memo: params.memo } : {}),
  };

  console.log("[merchant-ach] createAchDebit:", JSON.stringify({
    pmUserId: creds.pmUserId,
    credSource: creds.source,
    amount: params.amount,
    customerId: params.customerId,
    SECCode: params.secCode,
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
    /**
     * NACHA SEC code — required by Kadima as of 2026-05-05. Use
     * `pickSecCode()` from `./sec-code` to resolve from a context type.
     * For B2B credits (owner / vendor payouts) this is always "CCD".
     */
    secCode: AchSecCode;
    memo?: string;
  }
): Promise<unknown> {
  const client = createMerchantVaultClient(creds);
  const requestBody = {
    amount: params.amount,
    transactionType: "Credit",
    customer: { id: Number(params.customerId) },
    account: { id: Number(params.accountId) },
    SECCode: params.secCode,
    ...(params.memo ? { memo: params.memo } : {}),
  };

  console.log("[merchant-ach] createAchCredit:", JSON.stringify({
    pmUserId: creds.pmUserId,
    credSource: creds.source,
    amount: params.amount,
    customerId: params.customerId,
    SECCode: params.secCode,
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

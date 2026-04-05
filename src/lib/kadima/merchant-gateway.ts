/**
 * Merchant-scoped gateway operations.
 *
 * These functions accept MerchantCredentials and create per-request clients.
 * Use these for tenant payment operations instead of the global gateway.ts functions.
 * The global functions in gateway.ts remain for backward compatibility and
 * platform-level operations.
 */

import { withRetry } from "./client";
import type { MerchantCredentials } from "./merchant-context";
import { createMerchantGatewayClient } from "./merchant-client";
import type { KadimaGatewayResponse } from "./gateway";

export async function merchantCreateSale(
  creds: MerchantCredentials,
  params: {
    amount: number;
    card: { token?: string; name?: string; number?: string; exp?: string; cvv?: string };
    terminalIdOverride?: string;
  }
): Promise<KadimaGatewayResponse> {
  const client = createMerchantGatewayClient(creds);
  const terminalId = Number(params.terminalIdOverride || creds.terminalId);

  if (!terminalId || isNaN(terminalId)) {
    throw new Error(`Invalid terminal ID for merchant sale: "${params.terminalIdOverride || creds.terminalId}"`);
  }

  const requestBody = {
    terminal: { id: terminalId },
    amount: params.amount,
    source: "Internet",
    level: 1,
    card: params.card,
  };

  console.log("[merchant-gateway] createSale:", JSON.stringify({
    pmUserId: creds.pmUserId,
    credSource: creds.source,
    terminalId,
    amount: params.amount,
    cardType: params.card.token ? "token" : "raw",
  }));

  return withRetry(async () => {
    const { data } = await client.post("/payment/sale", requestBody);
    console.log("[merchant-gateway] createSale response:", JSON.stringify({
      id: data?.id,
      status: data?.status,
      type: data?.type,
    }));
    return data;
  });
}

export async function merchantCreateSaleFromVault(
  creds: MerchantCredentials,
  params: {
    cardToken: string;
    amount: number;
    terminalIdOverride?: string;
  }
): Promise<KadimaGatewayResponse> {
  return merchantCreateSale(creds, {
    amount: params.amount,
    card: { token: params.cardToken },
    terminalIdOverride: params.terminalIdOverride,
  });
}

export async function merchantRefundTransaction(
  creds: MerchantCredentials,
  transactionId: string,
  amount?: number
): Promise<KadimaGatewayResponse> {
  const client = createMerchantGatewayClient(creds);
  return withRetry(async () => {
    const { data } = await client.post(
      `/payment/${transactionId}/refund`,
      amount != null ? { amount } : {}
    );
    return data;
  });
}

export async function merchantVoidTransaction(
  creds: MerchantCredentials,
  transactionId: string
): Promise<KadimaGatewayResponse> {
  const client = createMerchantGatewayClient(creds);
  return withRetry(async () => {
    const { data } = await client.post(`/payment/${transactionId}/void`, {});
    return data;
  });
}

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

/**
 * Refund (or void) a transaction via the merchant's gateway.
 * POST /payment/{id}/refund
 *
 * Per Kadima docs, the body MUST include terminal.id. We look up the original
 * transaction first to use its terminal (handles property-level overrides);
 * fall back to the merchant's default terminal if lookup fails.
 *
 * If amount is omitted, the full original amount is refunded/voided.
 * If the transaction hasn't settled, this is automatically a void.
 */
export async function merchantRefundTransaction(
  creds: MerchantCredentials,
  transactionId: string,
  amount?: number
): Promise<KadimaGatewayResponse> {
  const client = createMerchantGatewayClient(creds);
  return withRetry(async () => {
    // Discover the terminal of the original transaction
    let resolvedTerminalId: number = Number(creds.terminalId);
    try {
      const { data: original } = await client.get(`/payment/${transactionId}`);
      const tid = original?.terminal?.id;
      if (tid) resolvedTerminalId = Number(tid);
    } catch {
      // Fall through to creds.terminalId
    }
    if (!resolvedTerminalId || isNaN(resolvedTerminalId)) {
      throw new Error(
        `Cannot refund: no terminal ID resolvable for transaction ${transactionId}`
      );
    }

    const body: Record<string, unknown> = {
      terminal: { id: resolvedTerminalId },
    };
    if (amount != null) body.amount = amount;

    const { data } = await client.post(
      `/payment/${transactionId}/refund`,
      body
    );
    return data;
  });
}

/**
 * Void a transaction via the merchant's gateway.
 *
 * Kadima has no separate /void endpoint — voids are refunds without an amount
 * against a not-yet-settled transaction. Thin wrapper for clarity.
 */
export async function merchantVoidTransaction(
  creds: MerchantCredentials,
  transactionId: string
): Promise<KadimaGatewayResponse> {
  return merchantRefundTransaction(creds, transactionId, undefined);
}

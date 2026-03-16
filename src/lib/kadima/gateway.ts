import { kadimaClient, withRetry } from "./client";
import type {
  CardTransaction,
  KadimaResponse,
  KadimaListResponse,
  TransactionListParams,
} from "./types";

const DEFAULT_TERMINAL_ID = process.env.KADIMA_TERMINAL_ID;

function getTerminalId(override?: string): number {
  const tid = override || DEFAULT_TERMINAL_ID || "";
  return Number(tid);
}

/**
 * Create a card sale transaction.
 * POST /payment/sale
 *
 * Per Kadima API docs, required payload:
 *   terminal: { id: <int> }
 *   amount: <string|number>
 *   source: "Internet" | "Phone" | "Mail"
 *   level: 1 | 2 | 3
 *   card: { name, number, exp, cvv } (direct) or { token } (vault)
 */
export async function createSale(params: {
  amount: number;
  terminalId?: string;
  card: {
    token?: string;
    name?: string;
    number?: string;
    exp?: string;
    cvv?: string;
  };
}): Promise<KadimaResponse<CardTransaction>> {
  const requestBody = {
    terminal: { id: getTerminalId(params.terminalId) },
    amount: params.amount,
    source: "Internet",
    level: 1,
    card: params.card,
  };
  console.log("[gateway] createSale request:", JSON.stringify(requestBody));
  return withRetry(async () => {
    const { data } = await kadimaClient.post("/payment/sale", requestBody);
    console.log("[gateway] createSale response:", JSON.stringify(data));
    return data;
  });
}

/**
 * Create a card auth (hold) transaction.
 * POST /payment/auth
 */
export async function createAuth(params: {
  amount: number;
  terminalId?: string;
  card: {
    token?: string;
    name?: string;
    number?: string;
    exp?: string;
    cvv?: string;
  };
}): Promise<KadimaResponse<CardTransaction>> {
  const requestBody = {
    terminal: { id: getTerminalId(params.terminalId) },
    amount: params.amount,
    source: "Internet",
    level: 1,
    card: params.card,
  };
  return withRetry(async () => {
    const { data } = await kadimaClient.post("/payment/auth", requestBody);
    return data;
  });
}

/**
 * Capture a previously authorized transaction.
 * POST /payment/{id}/capture
 */
export async function captureTransaction(
  transactionId: string,
  amount?: number
): Promise<KadimaResponse<CardTransaction>> {
  return withRetry(async () => {
    const { data } = await kadimaClient.post(
      `/payment/${transactionId}/capture`,
      amount != null ? { amount } : {}
    );
    return data;
  });
}

/**
 * Refund a transaction.
 * POST /payment/{id}/refund
 */
export async function refundTransaction(
  transactionId: string,
  amount?: number
): Promise<KadimaResponse<CardTransaction>> {
  return withRetry(async () => {
    const { data } = await kadimaClient.post(
      `/payment/${transactionId}/refund`,
      amount != null ? { amount } : {}
    );
    return data;
  });
}

/**
 * Void a transaction.
 * POST /payment/{id}/void
 */
export async function voidTransaction(
  transactionId: string
): Promise<KadimaResponse<CardTransaction>> {
  return withRetry(async () => {
    const { data } = await kadimaClient.post(
      `/payment/${transactionId}/void`,
      {}
    );
    return data;
  });
}

/**
 * List card transactions.
 * GET /transaction
 */
export async function listTransactions(
  params?: TransactionListParams
): Promise<KadimaListResponse<CardTransaction>> {
  return withRetry(async () => {
    const { data } = await kadimaClient.get("/transaction", { params });
    return data;
  });
}

/**
 * Get a specific card transaction.
 * GET /transaction/:id
 */
export async function getTransaction(
  id: string
): Promise<KadimaResponse<CardTransaction>> {
  return withRetry(async () => {
    const { data } = await kadimaClient.get(`/transaction/${id}`);
    return data;
  });
}

/**
 * Create a sale using a tokenized card from Customer Vault.
 * Uses card.token from the vault card record.
 */
export async function createSaleFromVault(params: {
  cardToken: string;
  amount: number;
  terminalId?: string;
}): Promise<KadimaResponse<CardTransaction>> {
  return createSale({
    amount: params.amount,
    terminalId: params.terminalId,
    card: { token: params.cardToken },
  });
}

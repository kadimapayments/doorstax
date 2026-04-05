import { kadimaClient, withRetry } from "./client";
import type {
  KadimaListResponse,
  TransactionListParams,
} from "./types";

const DEFAULT_TERMINAL_ID = process.env.KADIMA_TERMINAL_ID;

/**
 * Raw Kadima gateway transaction response.
 * The gateway returns the transaction object directly — NOT wrapped in { success, data }.
 * Status is nested: response.status.status = "Approved" | "Decline" | "Error"
 */
export interface KadimaGatewayResponse {
  id: string;
  amount: string;
  type: string;
  level: number;
  authCode?: string;
  terminal: { id: string };
  card?: {
    name?: string;
    number?: number; // last digits as integer
    exp?: string;
    token?: string;
    bin?: number;
    verification?: { cvv?: string; address?: string };
    networkTransactionId?: string;
    updated?: string; // "Yes" if account updater changed the card
  };
  contact?: { name?: string; phone?: string; email?: string } | null;
  status: { status: string; reason: string | null };
  externalId?: string | null;
  isRecurring?: string;
  split?: string | null;
  refunded?: boolean;
  captured?: boolean;
  history?: Array<{ id: string; type: string; amount: string; createdOn: string }>;
  order?: Record<string, unknown> | null;
  batch?: { id?: number } | null;
  parent?: { id: string | null };
  updatedOn?: string | null;
  createdOn?: string;
}

function getTerminalId(override?: string): number {
  const tid = override || DEFAULT_TERMINAL_ID;
  if (!tid) {
    throw new Error(
      "No terminal ID provided and KADIMA_TERMINAL_ID is not set. " +
      "Every payment must be routed to a specific terminal. " +
      "Set KADIMA_TERMINAL_ID or pass a terminalId explicitly."
    );
  }
  const parsed = Number(tid);
  if (!parsed || isNaN(parsed)) {
    throw new Error(`Invalid terminal ID: "${tid}" — must be a positive integer`);
  }
  return parsed;
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
}): Promise<KadimaGatewayResponse> {
  const requestBody = {
    terminal: { id: getTerminalId(params.terminalId) },
    amount: params.amount,
    source: "Internet",
    level: 1,
    card: params.card,
  };
  console.log("[gateway] createSale request:", JSON.stringify({
    ...requestBody,
    card: {
      ...requestBody.card,
      number: requestBody.card.number ? "REDACTED" : undefined,
      cvv: requestBody.card.cvv ? "REDACTED" : undefined,
    },
  }));
  return withRetry(async () => {
    const { data } = await kadimaClient.post("/payment/sale", requestBody);
    console.log("[gateway] createSale response:", JSON.stringify({ id: data?.id, status: data?.status, type: data?.type }));
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
}): Promise<KadimaGatewayResponse> {
  const requestBody = {
    terminal: { id: getTerminalId(params.terminalId) },
    amount: params.amount,
    source: "Internet",
    level: 1,
    card: params.card,
  };
  console.log("[gateway] createAuth request:", JSON.stringify({
    ...requestBody,
    card: {
      ...requestBody.card,
      number: requestBody.card.number ? "REDACTED" : undefined,
      cvv: requestBody.card.cvv ? "REDACTED" : undefined,
    },
  }));
  return withRetry(async () => {
    const { data } = await kadimaClient.post("/payment/auth", requestBody);
    console.log("[gateway] createAuth response:", JSON.stringify({ id: data?.id, status: data?.status, type: data?.type }));
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
): Promise<KadimaGatewayResponse> {
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
): Promise<KadimaGatewayResponse> {
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
): Promise<KadimaGatewayResponse> {
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
 * GET /payments
 */
export async function listTransactions(
  params?: TransactionListParams
): Promise<KadimaListResponse<KadimaGatewayResponse>> {
  return withRetry(async () => {
    const { data } = await kadimaClient.get("/payments", { params });
    return data;
  });
}

/**
 * Get a specific card transaction.
 * GET /payment/:id
 */
export async function getTransaction(
  id: string
): Promise<KadimaGatewayResponse> {
  return withRetry(async () => {
    const { data } = await kadimaClient.get(`/payment/${id}`);
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
}): Promise<KadimaGatewayResponse> {
  return createSale({
    amount: params.amount,
    terminalId: params.terminalId,
    card: { token: params.cardToken },
  });
}

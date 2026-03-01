import { kadimaClient, withRetry } from "./client";
import type {
  CardTransaction,
  CreateSalePayload,
  CreateAuthPayload,
  CapturePayload,
  RefundPayload,
  KadimaResponse,
  KadimaListResponse,
  TransactionListParams,
} from "./types";

const DEFAULT_TERMINAL_ID = process.env.KADIMA_TERMINAL_ID;

function getTerminalId(override?: string): string {
  return override || DEFAULT_TERMINAL_ID || "";
}

/**
 * Create a card sale transaction.
 * POST /transaction
 * @param terminalId - Optional per-property terminal ID (falls back to env default)
 */
export async function createSale(
  payload: CreateSalePayload,
  terminalId?: string
): Promise<KadimaResponse<CardTransaction>> {
  return withRetry(async () => {
    const { data } = await kadimaClient.post("/transaction", {
      type: "sale",
      terminalId: getTerminalId(terminalId),
      ...payload,
    });
    return data;
  });
}

/**
 * Create a card auth (hold) transaction.
 * POST /transaction
 * @param terminalId - Optional per-property terminal ID
 */
export async function createAuth(
  payload: CreateAuthPayload,
  terminalId?: string
): Promise<KadimaResponse<CardTransaction>> {
  return withRetry(async () => {
    const { data } = await kadimaClient.post("/transaction", {
      type: "auth",
      terminalId: getTerminalId(terminalId),
      ...payload,
    });
    return data;
  });
}

/**
 * Capture a previously authorized transaction.
 * POST /transaction
 */
export async function captureTransaction(
  payload: CapturePayload
): Promise<KadimaResponse<CardTransaction>> {
  return withRetry(async () => {
    const { data } = await kadimaClient.post("/transaction", {
      type: "capture",
      ...payload,
    });
    return data;
  });
}

/**
 * Refund a transaction.
 * POST /transaction
 */
export async function refundTransaction(
  payload: RefundPayload
): Promise<KadimaResponse<CardTransaction>> {
  return withRetry(async () => {
    const { data } = await kadimaClient.post("/transaction", {
      type: "refund",
      ...payload,
    });
    return data;
  });
}

/**
 * Void a transaction.
 * POST /transaction
 */
export async function voidTransaction(
  transactionId: string
): Promise<KadimaResponse<CardTransaction>> {
  return withRetry(async () => {
    const { data } = await kadimaClient.post("/transaction", {
      type: "void",
      transactionId,
    });
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
 */
export async function createSaleFromVault(params: {
  customerId: string;
  cardId: string;
  amount: number;
  terminalId?: string;
}): Promise<KadimaResponse<CardTransaction>> {
  return createSale(
    {
      customerId: params.customerId,
      cardId: params.cardId,
      amount: params.amount,
    },
    params.terminalId
  );
}

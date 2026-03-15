import { vaultClient, withRetry } from "./client";
import type {
  Customer,
  CreateCustomerPayload,
  UpdateCustomerPayload,
  CustomerCard,
  AddCardPayload,
  CustomerAccount,
  AddAccountPayload,
  KadimaResponse,
  KadimaListResponse,
} from "./types";

/**
 * Get the DBA ID for vault operations.
 * This is required by the Kadima API for all customer vault operations.
 */
function getDbaId(): string {
  const dbaId = process.env.KADIMA_DBA_ID;
  if (!dbaId) {
    throw new Error("KADIMA_DBA_ID is required for vault operations");
  }
  return dbaId;
}

// ─── Customers ──────────────────────────────────────────

/**
 * Create a customer in the vault.
 * POST /customer-vault  (on dashboard API)
 *
 * Kadima requires: dba.id, email, phone, identificator
 */
export async function createCustomer(
  payload: CreateCustomerPayload & { identificator?: string }
): Promise<KadimaResponse<Customer>> {
  const dbaId = getDbaId();
  const fullPayload = {
    dba: { id: dbaId },
    ...payload,
  };
  return withRetry(async () => {
    const { data } = await vaultClient.post("/customer-vault", fullPayload);
    return data;
  });
}

/**
 * Get a customer by ID.
 * GET /customer-vault/:id
 */
export async function getCustomer(
  id: string
): Promise<KadimaResponse<Customer>> {
  return withRetry(async () => {
    const { data } = await vaultClient.get(`/customer-vault/${id}`);
    return data;
  });
}

/**
 * Update a customer.
 * PUT /customer-vault/:id
 */
export async function updateCustomer(
  id: string,
  payload: UpdateCustomerPayload
): Promise<KadimaResponse<Customer>> {
  return withRetry(async () => {
    const { data } = await vaultClient.put(`/customer-vault/${id}`, payload);
    return data;
  });
}

/**
 * Delete a customer.
 * DELETE /customer-vault/:id
 */
export async function deleteCustomer(
  id: string
): Promise<KadimaResponse> {
  return withRetry(async () => {
    const { data } = await vaultClient.delete(`/customer-vault/${id}`);
    return data;
  });
}

/**
 * List all customers.
 * GET /customers-vault  (note: plural for list endpoint)
 */
export async function listCustomers(params?: {
  page?: number;
  perPage?: number;
}): Promise<KadimaListResponse<Customer>> {
  return withRetry(async () => {
    const { data } = await vaultClient.get("/customers-vault", { params });
    return data;
  });
}

// ─── Cards ──────────────────────────────────────────────

/**
 * Add a card to a customer.
 * POST /customer-vault/:customerId/card
 */
export async function addCard(
  customerId: string,
  payload: AddCardPayload
): Promise<KadimaResponse<CustomerCard>> {
  return withRetry(async () => {
    const { data } = await vaultClient.post(
      `/customer-vault/${customerId}/card`,
      payload
    );
    return data;
  });
}

/**
 * List customer's cards.
 * GET /customer-vault/:customerId/card
 */
export async function listCards(
  customerId: string
): Promise<KadimaListResponse<CustomerCard>> {
  return withRetry(async () => {
    const { data } = await vaultClient.get(
      `/customer-vault/${customerId}/card`
    );
    return data;
  });
}

/**
 * Delete a card from a customer.
 * DELETE /customer-vault/:customerId/card/:cardId
 */
export async function deleteCard(
  customerId: string,
  cardId: string
): Promise<KadimaResponse> {
  return withRetry(async () => {
    const { data } = await vaultClient.delete(
      `/customer-vault/${customerId}/card/${cardId}`
    );
    return data;
  });
}

// ─── Bank Accounts (ACH) ────────────────────────────────

/**
 * Add a bank account to a customer.
 * POST /customer-vault/:customerId/account
 */
export async function addAccount(
  customerId: string,
  payload: AddAccountPayload
): Promise<KadimaResponse<CustomerAccount>> {
  return withRetry(async () => {
    const { data } = await vaultClient.post(
      `/customer-vault/${customerId}/account`,
      payload
    );
    return data;
  });
}

/**
 * List customer's bank accounts.
 * GET /customer-vault/:customerId/account
 */
export async function listAccounts(
  customerId: string
): Promise<KadimaListResponse<CustomerAccount>> {
  return withRetry(async () => {
    const { data } = await vaultClient.get(
      `/customer-vault/${customerId}/account`
    );
    return data;
  });
}

/**
 * Delete a bank account from a customer.
 * DELETE /customer-vault/:customerId/account/:accountId
 */
export async function deleteAccount(
  customerId: string,
  accountId: string
): Promise<KadimaResponse> {
  return withRetry(async () => {
    const { data } = await vaultClient.delete(
      `/customer-vault/${customerId}/account/${accountId}`
    );
    return data;
  });
}

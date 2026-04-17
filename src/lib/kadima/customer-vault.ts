import { vaultClient, withRetry } from "./client";
import type {
  Customer,
  CreateCustomerPayload,
  UpdateCustomerPayload,
  CustomerCard,
  AddCardPayload,
  CustomerAccount,
  AddAccountPayload,
  BillingInfo,
  CreateBillingInfoPayload,
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

function getTerminalId(): number {
  const tid =
    process.env.KADIMA_HOSTED_TERMINAL_ID || process.env.KADIMA_TERMINAL_ID;
  if (!tid) {
    throw new Error(
      "KADIMA_HOSTED_TERMINAL_ID or KADIMA_TERMINAL_ID is required"
    );
  }
  return Number(tid);
}

// ─── Customers ──────────────────────────────────────────

/**
 * Create a customer in the vault.
 * POST /customer-vault  (on dashboard API)
 *
 * Kadima requires: dba.id, email, phone (per docs), identificator
 */
export async function createCustomer(
  payload: CreateCustomerPayload
): Promise<Customer> {
  const dbaId = getDbaId();
  const fullPayload = {
    dba: { id: Number(dbaId) },
    ...payload,
  };
  return withRetry(async () => {
    const { data } = await vaultClient.post("/customer-vault", fullPayload);
    // Kadima returns the customer object directly (not wrapped)
    return data;
  });
}

/**
 * Get a customer by ID.
 * GET /customer-vault/:id  (singular)
 */
export async function getCustomer(id: string | number): Promise<Customer> {
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
  id: string | number,
  payload: UpdateCustomerPayload
): Promise<Customer> {
  return withRetry(async () => {
    const { data } = await vaultClient.put(`/customer-vault/${id}`, payload);
    return data;
  });
}

/**
 * Delete a customer.
 * DELETE /customer-vault/:id
 */
export async function deleteCustomer(id: string | number): Promise<unknown> {
  return withRetry(async () => {
    const { data } = await vaultClient.delete(`/customer-vault/${id}`);
    return data;
  });
}

/**
 * List all customers.
 * GET /customers-vault  (note: PLURAL for list endpoint)
 *
 * Supports Kadima filter params (e.g. identificator, email).
 */
export async function listCustomers(params?: Record<string, unknown>): Promise<{
  items: Customer[];
  _links?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
}> {
  return withRetry(async () => {
    const { data } = await vaultClient.get("/customers-vault", { params });
    return data;
  });
}

// ─── Billing Information ────────────────────────────────

/**
 * Create billing information for a customer.
 * POST /customer-vault/:customerId/billing-information
 *
 * Required: firstName, lastName, address, country, city, zip
 * This MUST be done before adding a card (card requires billing.id).
 */
export async function createBillingInfo(
  customerId: string | number,
  payload: CreateBillingInfoPayload
): Promise<BillingInfo> {
  return withRetry(async () => {
    const { data } = await vaultClient.post(
      `/customer-vault/${customerId}/billing-information`,
      payload
    );
    return data;
  });
}

/**
 * List billing information for a customer.
 * GET /customer-vault/:customerId/billing-informations  (plural for list)
 */
export async function listBillingInfo(
  customerId: string | number
): Promise<{ items: BillingInfo[]; _links?: unknown; _meta?: unknown }> {
  return withRetry(async () => {
    const { data } = await vaultClient.get(
      `/customer-vault/${customerId}/billing-informations`
    );
    return data;
  });
}

/**
 * Get a single billing info record.
 * GET /customer-vault/:customerId/billing-information/:billingId
 */
export async function getBillingInfo(
  customerId: string | number,
  billingId: string | number
): Promise<BillingInfo> {
  return withRetry(async () => {
    const { data } = await vaultClient.get(
      `/customer-vault/${customerId}/billing-information/${billingId}`
    );
    return data;
  });
}

// ─── Customer Vault Hosted Card Form ─────────────────────

/**
 * Generate a hosted card form for PCI-compliant card vault storage.
 * POST /customer-vault-card/form
 *
 * This returns embeddable HTML/JS (`code`) and a standalone URL (`url`)
 * that handles card entry + vault storage together.
 * Cards submitted through this form are stored directly in the customer vault.
 *
 * @param customerVaultId - The vault customer ID to associate the card with
 * @param returnUrl - URL to redirect after card is saved (optional)
 */
export async function generateVaultCardForm(
  customerVaultId: string | number,
  returnUrl?: string
): Promise<{ code: string; url: string }> {
  const dbaId = getDbaId();
  const terminalId = getTerminalId();

  const payload: Record<string, unknown> = {
    dba: { id: Number(dbaId) },
    terminal: { id: terminalId },
    customerVault: { id: Number(customerVaultId) },
  };
  if (returnUrl) {
    payload.returnUrl = returnUrl;
  }

  console.log("[generateVaultCardForm] Request:", JSON.stringify(payload));

  return withRetry(async () => {
    const { data } = await vaultClient.post(
      "/customer-vault-card/form",
      payload
    );
    console.log("[generateVaultCardForm] Response keys:", Object.keys(data));
    return data;
  });
}

// ─── Cards ──────────────────────────────────────────────

/**
 * Add a card to a customer.
 * POST /customer-vault/:customerId/card  (singular)
 *
 * Per Kadima API, requires billing.id. If billingId is provided,
 * it will be included automatically. terminal.id is also added.
 */
export async function addCard(
  customerId: string | number,
  payload: AddCardPayload,
  billingId?: string | number
): Promise<CustomerCard> {
  const terminalId = getTerminalId();
  const fullPayload: Record<string, unknown> = {
    ...payload,
    terminal: { id: terminalId },
  };
  // Add billing.id if provided and not already in payload
  if (billingId && !payload.billing?.id) {
    fullPayload.billing = { id: Number(billingId) };
  }

  console.log("[addCard] Request:", {
    url: `/customer-vault/${customerId}/card`,
    payload: JSON.stringify(fullPayload),
  });

  return withRetry(async () => {
    const { data } = await vaultClient.post(
      `/customer-vault/${customerId}/card`,
      fullPayload
    );
    console.log("[addCard] Response:", JSON.stringify(data));
    return data;
  });
}

/**
 * List customer's cards.
 * GET /customer-vault/:customerId/cards  (PLURAL for list)
 */
export async function listCards(
  customerId: string | number
): Promise<{ items: CustomerCard[]; _links?: unknown; _meta?: unknown }> {
  return withRetry(async () => {
    const { data } = await vaultClient.get(
      `/customer-vault/${customerId}/cards`
    );
    return data;
  });
}

/**
 * Delete a card from a customer.
 * DELETE /customer-vault/:customerId/card/:cardId  (singular)
 */
export async function deleteCard(
  customerId: string | number,
  cardId: string | number
): Promise<unknown> {
  return withRetry(async () => {
    const { data } = await vaultClient.delete(
      `/customer-vault/${customerId}/card/${cardId}`
    );
    return data;
  });
}

// ─── Bank Accounts (ACH) ────────────────────────────────

/**
 * Create an ACH customer WITH their first bank account in a single call.
 * POST /ach/customer
 *
 * Kadima does NOT allow creating an empty ACH customer — the customer and
 * their first account are born together. This is the ONE entry point to
 * provisioning the ACH side of a new payee (agent, owner, etc.). Returns
 * both the new customer ID and the account ID.
 *
 * Note: /customer-vault (vault) and /ach/customer (ACH) are separate
 * namespaces on Kadima. A vault customer (for card storage) does NOT
 * automatically exist in ACH, and vice versa.
 */
export interface CreateAchCustomerPayload {
  accountName: string; // Display name on the customer record
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  identificator: string; // Our internal ID for idempotent re-linking
  routingNumber: string;
  accountNumber: string;
  accountType?: "checking" | "savings";
}

export interface CreateAchCustomerResult {
  customerId: string;
  accountId: string | null;
  raw: unknown;
}

export async function createAchCustomerWithAccount(
  payload: CreateAchCustomerPayload
): Promise<CreateAchCustomerResult> {
  const dbaId = getDbaId();

  // Build the flat payload that Kadima expects. The probe established that
  // the customer-level fields (accountName, firstName, lastName, email,
  // phone, identificator) live alongside the account-level fields
  // (routingNumber, accountNumber, type) on the same POST body.
  const body: Record<string, unknown> = {
    dba: { id: Number(dbaId) },
    accountName: payload.accountName,
    firstName: payload.firstName,
    lastName: payload.lastName || "Agent",
    email: payload.email,
    identificator: payload.identificator,
    routingNumber: payload.routingNumber,
    accountNumber: payload.accountNumber,
    type: payload.accountType === "savings" ? "Savings" : "Checking",
    name: payload.accountName, // some Kadima routes also want `name` at account level
  };
  if (payload.phone) {
    body.phone = payload.phone;
  }

  console.log("[createAchCustomer] Request:", {
    url: "/ach/customer",
    identificator: payload.identificator,
    firstName: payload.firstName,
    routingNumber: payload.routingNumber,
    // Never log accountNumber in full
    accountLast4: payload.accountNumber.slice(-4),
  });

  return withRetry(async () => {
    const { data } = await vaultClient.post("/ach/customer", body);
    console.log("[createAchCustomer] Response:", JSON.stringify(data));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any;
    const customerId =
      d?.id != null
        ? String(d.id)
        : d?.customer?.id != null
        ? String(d.customer.id)
        : "";
    if (!customerId) {
      throw new Error(
        "Kadima did not return a customer ID for the ACH customer create call"
      );
    }

    // Kadima may nest the account under `account`, or surface `accountId`, or
    // include it in an `accounts` array. Try each in turn.
    let accountId: string | null = null;
    if (d?.account?.id != null) accountId = String(d.account.id);
    else if (d?.accountId != null) accountId = String(d.accountId);
    else if (Array.isArray(d?.accounts) && d.accounts[0]?.id != null) {
      accountId = String(d.accounts[0].id);
    }

    return { customerId, accountId, raw: data };
  });
}

/**
 * Add a bank account to a customer.
 * POST /ach/customer/:customerId/account  (NOT /customer-vault/)
 *
 * Per Kadima API docs, required fields:
 *   name: account holder name
 *   type: "Checking" | "Savings"
 *   accountNumber: full account number
 *   routingNumber: 9-digit routing number
 */
export async function addAccount(
  customerId: string | number,
  payload: AddAccountPayload
): Promise<CustomerAccount> {
  // Map our field names to Kadima's expected format
  const kadimaPayload = {
    name: payload.accountHolderName || "",
    type: payload.accountType === "checking" ? "Checking" : "Savings",
    accountNumber: payload.accountNumber,
    routingNumber: payload.routingNumber,
  };

  console.log("[addAccount] Request:", {
    url: `/ach/customer/${customerId}/account`,
    payload: JSON.stringify(kadimaPayload),
  });

  return withRetry(async () => {
    const { data } = await vaultClient.post(
      `/ach/customer/${customerId}/account`,
      kadimaPayload
    );
    console.log("[addAccount] Response:", JSON.stringify(data));
    return data;
  });
}

/**
 * List customer's bank accounts.
 * GET /ach/customer/:customerId/account  (NOT /customer-vault/)
 */
export async function listAccounts(
  customerId: string | number
): Promise<{ items: CustomerAccount[]; _links?: unknown; _meta?: unknown }> {
  return withRetry(async () => {
    const { data } = await vaultClient.get(
      `/ach/customer/${customerId}/account`
    );
    return data;
  });
}

/**
 * Delete a bank account from a customer.
 * DELETE /ach/customer/:customerId/account/:accountId  (NOT /customer-vault/)
 */
export async function deleteAccount(
  customerId: string | number,
  accountId: string | number
): Promise<unknown> {
  return withRetry(async () => {
    const { data } = await vaultClient.delete(
      `/ach/customer/${customerId}/account/${accountId}`
    );
    return data;
  });
}

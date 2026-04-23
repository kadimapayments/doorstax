/**
 * Merchant-scoped vault operations.
 *
 * These functions accept MerchantCredentials so vault customers are
 * created under the correct PM's DBA, not the global platform DBA.
 *
 * IMPORTANT: The DBA ID is embedded in the merchant's API token scope.
 * When you authenticate with a merchant's API key, Kadima automatically
 * scopes vault operations to that merchant's DBA. We still pass dba.id
 * explicitly where the API requires it, using the merchant's credentials.
 */

import { withRetry } from "./client";
import type { MerchantCredentials } from "./merchant-context";
import { createMerchantVaultClient } from "./merchant-client";
import type {
  Customer,
  CreateCustomerPayload,
  CustomerCard,
  AddCardPayload,
  BillingInfo,
  CreateBillingInfoPayload,
  AddAccountPayload,
} from "./types";

export async function merchantCreateCustomer(
  creds: MerchantCredentials,
  payload: CreateCustomerPayload
): Promise<Customer> {
  const client = createMerchantVaultClient(creds);
  // Note: dba.id is not explicitly passed here because the merchant API key
  // scopes all vault operations to the merchant's DBA automatically.
  // If Kadima rejects this, add dba.id resolution per merchant.
  return withRetry(async () => {
    const { data } = await client.post("/customer-vault", payload);
    return data;
  });
}

export async function merchantListCustomers(
  creds: MerchantCredentials,
  params?: Record<string, unknown>
): Promise<{ items: Customer[]; _links?: unknown; _meta?: unknown }> {
  const client = createMerchantVaultClient(creds);
  return withRetry(async () => {
    const { data } = await client.get("/customers-vault", { params });
    return data;
  });
}

export async function merchantCreateBillingInfo(
  creds: MerchantCredentials,
  customerId: string | number,
  payload: CreateBillingInfoPayload
): Promise<BillingInfo> {
  const client = createMerchantVaultClient(creds);
  return withRetry(async () => {
    const { data } = await client.post(
      `/customer-vault/${customerId}/billing-information`,
      payload
    );
    return data;
  });
}

export async function merchantAddCard(
  creds: MerchantCredentials,
  customerId: string | number,
  payload: AddCardPayload,
  billingId?: string | number
): Promise<CustomerCard> {
  const client = createMerchantVaultClient(creds);
  const terminalId = Number(creds.terminalId);
  const fullPayload: Record<string, unknown> = {
    ...payload,
    terminal: { id: terminalId },
  };
  if (billingId && !payload.billing?.id) {
    fullPayload.billing = { id: Number(billingId) };
  }
  return withRetry(async () => {
    const { data } = await client.post(
      `/customer-vault/${customerId}/card`,
      fullPayload
    );
    return data;
  });
}

export async function merchantListCards(
  creds: MerchantCredentials,
  customerId: string | number
): Promise<{ items: CustomerCard[]; _links?: unknown; _meta?: unknown }> {
  const client = createMerchantVaultClient(creds);
  return withRetry(async () => {
    const { data } = await client.get(`/customer-vault/${customerId}/cards`);
    return data;
  });
}

export async function merchantDeleteCard(
  creds: MerchantCredentials,
  customerId: string | number,
  cardId: string | number
): Promise<unknown> {
  const client = createMerchantVaultClient(creds);
  return withRetry(async () => {
    const { data } = await client.delete(
      `/customer-vault/${customerId}/card/${cardId}`
    );
    return data;
  });
}

export async function merchantAddAccount(
  creds: MerchantCredentials,
  customerId: string | number,
  payload: AddAccountPayload
): Promise<unknown> {
  const client = createMerchantVaultClient(creds);
  return withRetry(async () => {
    const { data } = await client.post(
      `/ach/customer/${customerId}/account`,
      payload
    );
    return data;
  });
}

export async function merchantGenerateVaultCardForm(
  creds: MerchantCredentials,
  customerVaultId: string | number,
  returnUrl?: string,
  billingId?: string | number
): Promise<{ code: string; url: string }> {
  const client = createMerchantVaultClient(creds);
  const terminalId = Number(creds.terminalId);
  const payload: Record<string, unknown> = {
    terminal: { id: terminalId },
    customerVault: { id: Number(customerVaultId) },
  };
  if (returnUrl) {
    payload.returnUrl = returnUrl;
  }
  // When billingId is provided, Kadima links the card to the existing billing
  // record and skips the in-form address-collection step.
  if (billingId) {
    payload.billing = { id: Number(billingId) };
  }
  return withRetry(async () => {
    const { data } = await client.post("/customer-vault-card/form", payload);
    return data;
  });
}

import { vaultClient, withRetry } from "./client";
import type {
  RecurringPayment,
  CreateRecurringPayload,
  UpdateRecurringPayload,
  KadimaResponse,
  KadimaListResponse,
} from "./types";

/**
 * Create a recurring payment for a customer.
 * POST /customer-vault/:customerId/recurring-payment
 *
 * Per Kadima's 2026-05-05 SEC-code mandate, ACH-backed recurring
 * schedules must include `SECCode` on the wire. The wrapper translates
 * the camelCase `secCode` from our typed payload into the capitalised
 * `SECCode` Kadima expects, matching their published curl example.
 */
export async function createRecurringPayment(
  customerId: string,
  payload: CreateRecurringPayload
): Promise<KadimaResponse<RecurringPayment>> {
  // Translate `secCode` → `SECCode` at the wire boundary while keeping
  // our internal types camelCase per TS convention. The rest of the
  // payload passes through unchanged.
  const { secCode, ...rest } = payload;
  const wireBody: Record<string, unknown> = { ...rest };
  if (secCode) wireBody.SECCode = secCode;

  return withRetry(async () => {
    const { data } = await vaultClient.post(
      `/customer-vault/${customerId}/recurring-payment`,
      wireBody
    );
    return data;
  });
}

/**
 * Get a recurring payment.
 * GET /customer-vault/:customerId/recurring-payment/:id
 */
export async function getRecurringPayment(
  customerId: string,
  recurringId: string
): Promise<KadimaResponse<RecurringPayment>> {
  return withRetry(async () => {
    const { data } = await vaultClient.get(
      `/customer-vault/${customerId}/recurring-payment/${recurringId}`
    );
    return data;
  });
}

/**
 * Update a recurring payment.
 * PUT /customer-vault/:customerId/recurring-payment/:id
 */
export async function updateRecurringPayment(
  customerId: string,
  recurringId: string,
  payload: UpdateRecurringPayload
): Promise<KadimaResponse<RecurringPayment>> {
  return withRetry(async () => {
    const { data } = await vaultClient.put(
      `/customer-vault/${customerId}/recurring-payment/${recurringId}`,
      payload
    );
    return data;
  });
}

/**
 * Archive (pause) a recurring payment.
 * POST /customer-vault/:customerId/recurring-payment/:id/archive
 */
export async function archiveRecurringPayment(
  customerId: string,
  recurringId: string
): Promise<KadimaResponse> {
  return withRetry(async () => {
    const { data } = await vaultClient.post(
      `/customer-vault/${customerId}/recurring-payment/${recurringId}/archive`
    );
    return data;
  });
}

/**
 * Delete a recurring payment.
 * DELETE /customer-vault/:customerId/recurring-payment/:id
 */
export async function deleteRecurringPayment(
  customerId: string,
  recurringId: string
): Promise<KadimaResponse> {
  return withRetry(async () => {
    const { data } = await vaultClient.delete(
      `/customer-vault/${customerId}/recurring-payment/${recurringId}`
    );
    return data;
  });
}

/**
 * List recurring payments for a customer.
 * GET /customer-vault/:customerId/recurring-payment
 */
export async function listRecurringPayments(
  customerId: string
): Promise<KadimaListResponse<RecurringPayment>> {
  return withRetry(async () => {
    const { data } = await vaultClient.get(
      `/customer-vault/${customerId}/recurring-payment`
    );
    return data;
  });
}

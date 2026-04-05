/**
 * Per-Merchant Kadima Client Factory
 *
 * Creates scoped axios instances for a specific PM's Kadima merchant account.
 * These are NOT singletons — a new instance is created per request context.
 * This is intentional: credentials may change, and we don't want stale tokens.
 *
 * For platform-level operations (DoorStax billing, boarding), continue using
 * the global clients from ./client.ts.
 */

import axios, { type AxiosInstance } from "axios";
import type { MerchantCredentials } from "./merchant-context";

/**
 * Create a gateway client scoped to a specific merchant.
 * Used for: sales, auth, capture, refund, void
 */
export function createMerchantGatewayClient(creds: MerchantCredentials): AxiosInstance {
  const BASE_URL =
    process.env.KADIMA_API_BASE ||
    "https://sandbox-gateway.kadimadashboard.com";

  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${creds.apiKey}`,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });
}

/**
 * Create a vault/dashboard client scoped to a specific merchant.
 * Used for: customer vault, ACH, recurring payments, hosted card forms
 */
export function createMerchantVaultClient(creds: MerchantCredentials): AxiosInstance {
  const BASE_URL =
    process.env.KADIMA_PROCESSOR_BASE ||
    "https://sandbox.kadimadashboard.com/api";

  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${creds.apiKey}`,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });
}

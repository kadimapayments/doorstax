import axios from "axios";
import { withRetry } from "./client";
import type { HostedFieldsToken, HostedFieldsTokenPayload } from "./types";

const DEFAULT_TERMINAL_ID = process.env.KADIMA_HOSTED_TERMINAL_ID || process.env.KADIMA_TERMINAL_ID;
const APP_DOMAIN =
  process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";

/**
 * Dedicated client for hosted-fields token generation.
 * Uses the PROCESSOR (dashboard) base URL — NOT the gateway URL.
 * The hosted-fields/token endpoint lives on the dashboard API.
 * Uses KADIMA_PROCESSOR_TOKEN for authentication.
 */
function getHostedFieldsClient() {
  const BASE_URL =
    process.env.KADIMA_PROCESSOR_BASE ||
    "https://sandbox.kadimadashboard.com/api";
  const TOKEN =
    process.env.KADIMA_PROCESSOR_TOKEN ||
    process.env.KADIMA_GATEWAY_TOKEN ||
    process.env.KADIMA_API_TOKEN;

  if (!TOKEN) {
    throw new Error("KADIMA_PROCESSOR_TOKEN (or KADIMA_GATEWAY_TOKEN) is required");
  }

  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });
}

/**
 * Generate a hosted fields token for client-side card/ACH collection.
 * POST /hosted-fields/token (on the dashboard/processor API)
 *
 * Required params per Kadima docs:
 *   terminal (integer) — internal terminal ID (NOT the tid)
 *   domain   (string)  — the URL where the form is embedded
 *
 * @param options  — optional saveCard / 3ds flags
 * @param terminalId — override terminal (falls back to env default)
 */
export async function generateHostedFieldsToken(
  options?: HostedFieldsTokenPayload,
  terminalId?: string,
  domain?: string
): Promise<HostedFieldsToken> {
  return withRetry(async () => {
    const client = getHostedFieldsClient();
    const { data } = await client.post("/hosted-fields/token", {
      terminal: Number(terminalId || DEFAULT_TERMINAL_ID),
      domain: domain || APP_DOMAIN,
      ...options,
    });
    return data;
  });
}

/**
 * Retrieve a tokenized card after a successful hosted-fields submission.
 * POST /hosted-fields/card-token (on the dashboard/processor API)
 *
 * Must be called before the hosted-fields access token expires.
 * Returns { token, bin, exp, number } where `number` is the masked card number.
 */
export async function getCardToken(
  accessToken: string
): Promise<{ token: string; bin: string; exp: string; number: string }> {
  return withRetry(async () => {
    const client = getHostedFieldsClient();
    console.log("[getCardToken] Requesting card token");
    const { data } = await client.post("/hosted-fields/card-token", {
      accessToken,
    });
    console.log("[getCardToken] Response received:", { hasData: !!data });
    // Kadima returns raw objects — extract data if wrapped, otherwise return as-is
    return data?.data ?? data;
  });
}

import { kadimaClient, withRetry } from "./client";
import type { HostedFieldsToken, HostedFieldsTokenPayload } from "./types";

const DEFAULT_TERMINAL_ID = process.env.KADIMA_TERMINAL_ID;

/**
 * Generate a hosted fields token for client-side card/ACH collection.
 * POST /hosted-fields/token
 * @param terminalId - Optional per-property terminal ID (falls back to env default)
 */
export async function generateHostedFieldsToken(
  options?: HostedFieldsTokenPayload,
  terminalId?: string
): Promise<HostedFieldsToken> {
  return withRetry(async () => {
    const { data } = await kadimaClient.post("/hosted-fields/token", {
      terminalId: terminalId || DEFAULT_TERMINAL_ID,
      ...options,
    });
    return data;
  });
}

import { kadimaClient, withRetry } from "./client";
import type { HostedFieldsToken, HostedFieldsTokenPayload } from "./types";

const TERMINAL_ID = process.env.KADIMA_TERMINAL_ID;

/**
 * Generate a hosted fields token for client-side card/ACH collection.
 * POST /hosted-fields/token
 */
export async function generateHostedFieldsToken(
  options?: HostedFieldsTokenPayload
): Promise<HostedFieldsToken> {
  return withRetry(async () => {
    const { data } = await kadimaClient.post("/hosted-fields/token", {
      terminalId: TERMINAL_ID,
      ...options,
    });
    return data;
  });
}

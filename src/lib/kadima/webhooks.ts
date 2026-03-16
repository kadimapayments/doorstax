import { createHash } from "crypto";
import type { WebhookEvent } from "./types";

const MERCHANT_WEBHOOK_SECRET = process.env.KADIMA_WEBHOOK_SECRET;
const PROCESSOR_WEBHOOK_SECRET = process.env.KADIMA_PROCESSOR_WEBHOOK_SECRET;

/**
 * Timing-safe comparison of two hex strings.
 */
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verify Kadima webhook signature using SHA-512.
 *
 * Per Kadima API docs:
 *   Header: Webhook-Signature
 *   Algorithm: SHA-512 hash of <webhookSignature><id><module><action><date>
 *
 * The `parsedEvent` must include the top-level `id`, `module`, `action`, and `date`
 * fields from the webhook payload (these are required before verification).
 *
 * Tries the merchant webhook secret first, then the processor secret.
 * Returns which tier matched so the handler can route accordingly.
 */
export function verifyWebhookSignature(
  parsedEvent: { id: number | string; module: string; action: string; date: string },
  signature: string
): { valid: boolean; source: "merchant" | "processor" | null } {
  const { id, module, action, date } = parsedEvent;

  // Try merchant secret first (most common — transaction/vault events)
  if (MERCHANT_WEBHOOK_SECRET) {
    const input = `${MERCHANT_WEBHOOK_SECRET}${id}${module}${action}${date}`;
    const computed = createHash("sha512").update(input).digest("hex");
    if (timingSafeCompare(computed, signature)) {
      return { valid: true, source: "merchant" };
    }
  }

  // Try processor secret (boarding/approval events)
  if (PROCESSOR_WEBHOOK_SECRET) {
    const input = `${PROCESSOR_WEBHOOK_SECRET}${id}${module}${action}${date}`;
    const computed = createHash("sha512").update(input).digest("hex");
    if (timingSafeCompare(computed, signature)) {
      return { valid: true, source: "processor" };
    }
  }

  if (!MERCHANT_WEBHOOK_SECRET && !PROCESSOR_WEBHOOK_SECRET) {
    console.error(
      "No Kadima webhook secrets configured (KADIMA_WEBHOOK_SECRET / KADIMA_PROCESSOR_WEBHOOK_SECRET)"
    );
  }

  return { valid: false, source: null };
}

/**
 * Parse webhook event from raw body.
 */
export function parseWebhookEvent(rawBody: string): WebhookEvent {
  return JSON.parse(rawBody) as WebhookEvent;
}

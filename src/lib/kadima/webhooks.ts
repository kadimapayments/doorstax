import { createHmac } from "crypto";
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
 * Verify Kadima webhook signature using HMAC-SHA256.
 *
 * Tries the merchant webhook secret first, then the processor secret.
 * Returns which tier matched so the handler can route accordingly.
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signature: string
): { valid: boolean; source: "merchant" | "processor" | null } {
  // Try merchant secret first (most common — transaction/vault events)
  if (MERCHANT_WEBHOOK_SECRET) {
    const computed = createHmac("sha256", MERCHANT_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");
    if (timingSafeCompare(computed, signature)) {
      return { valid: true, source: "merchant" };
    }
  }

  // Try processor secret (boarding/approval events)
  if (PROCESSOR_WEBHOOK_SECRET) {
    const computed = createHmac("sha256", PROCESSOR_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");
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

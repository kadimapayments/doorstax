import { createHmac } from "crypto";
import type { WebhookEvent } from "./types";

const WEBHOOK_SECRET = process.env.KADIMA_WEBHOOK_SECRET;

/**
 * Verify Kadima webhook signature using HMAC-SHA256.
 * Compares the x-kadima-signature header against a computed hash of the body.
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signature: string
): boolean {
  if (!WEBHOOK_SECRET) {
    console.error("KADIMA_WEBHOOK_SECRET not configured");
    return false;
  }

  const computed = createHmac("sha256", WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  // Timing-safe comparison
  if (computed.length !== signature.length) return false;

  let result = 0;
  for (let i = 0; i < computed.length; i++) {
    result |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Parse webhook event from raw body.
 */
export function parseWebhookEvent(rawBody: string): WebhookEvent {
  return JSON.parse(rawBody) as WebhookEvent;
}

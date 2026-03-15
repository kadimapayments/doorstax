/**
 * Integration Webhook Delivery
 *
 * Delivers domain events to external webhook subscribers via HTTPS POST.
 * Signs payloads with HMAC-SHA256 for verification.
 * Tracks delivery attempts and disables webhooks after repeated failures.
 */

import crypto from "crypto";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { notify } from "@/lib/notifications";

// ─── Types ──────────────────────────────────────────────────

interface DeliverWebhookOptions {
  webhookId: string;
  eventType: string;
  eventId: string;
  payload: Record<string, unknown>;
}

interface DeliverWebhookResult {
  success: boolean;
  statusCode?: number;
}

// ─── Delivery ───────────────────────────────────────────────

const MAX_FAILURE_COUNT = 10;

/**
 * Deliver a webhook payload to a subscriber's endpoint.
 * Records the delivery attempt and handles failure tracking.
 */
export async function deliverWebhook(
  opts: DeliverWebhookOptions
): Promise<DeliverWebhookResult> {
  const webhook = await db.integrationWebhook.findUnique({
    where: { id: opts.webhookId },
    include: {
      apiKey: { select: { userId: true } },
      integration: { select: { userId: true } },
    },
  });

  if (!webhook || !webhook.isActive) {
    return { success: false };
  }

  // Build payload
  const deliveryId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const body = JSON.stringify({
    id: deliveryId,
    event: opts.eventType,
    timestamp,
    data: opts.payload,
  });

  // Sign payload
  const signature = signWebhookPayload(body, webhook.secret);

  // Create delivery record
  const delivery = await db.integrationWebhookDelivery.create({
    data: {
      webhookId: webhook.id,
      eventType: opts.eventType,
      eventId: opts.eventId,
      payload: opts.payload as Prisma.InputJsonValue,
      attempts: 1,
    },
  });

  // Attempt delivery
  let statusCode: number | undefined;
  let responseBody: string | undefined;
  let success = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-DoorStax-Signature": signature,
        "X-DoorStax-Event": opts.eventType,
        "X-DoorStax-Delivery": deliveryId,
        "X-DoorStax-Timestamp": timestamp,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    statusCode = response.status;

    try {
      responseBody = await response.text();
      // Truncate response body to prevent storing huge payloads
      if (responseBody.length > 1000) {
        responseBody = responseBody.substring(0, 1000) + "...(truncated)";
      }
    } catch {
      responseBody = "(could not read response body)";
    }

    success = response.ok;
  } catch (err) {
    responseBody = err instanceof Error ? err.message : String(err);
  }

  // Update delivery record
  await db.integrationWebhookDelivery.update({
    where: { id: delivery.id },
    data: {
      statusCode,
      responseBody,
      deliveredAt: success ? new Date() : undefined,
    },
  });

  // Update webhook stats
  if (success) {
    await db.integrationWebhook.update({
      where: { id: webhook.id },
      data: {
        failureCount: 0,
        lastDeliveredAt: new Date(),
      },
    });
  } else {
    const newFailureCount = webhook.failureCount + 1;
    const updateData: Record<string, unknown> = {
      failureCount: newFailureCount,
      lastFailedAt: new Date(),
    };

    // Disable webhook after too many consecutive failures
    if (newFailureCount >= MAX_FAILURE_COUNT) {
      updateData.isActive = false;

      // Notify the webhook owner
      const ownerId =
        webhook.apiKey?.userId || webhook.integration?.userId;
      if (ownerId) {
        notify({
          userId: ownerId,
          createdById: ownerId,
          type: "WEBHOOK_DISABLED",
          title: "Webhook Disabled",
          message: `Your webhook to ${webhook.url} has been disabled after ${MAX_FAILURE_COUNT} consecutive delivery failures. Please check the endpoint and re-enable.`,
          severity: "warning",
        }).catch(console.error);
      }
    }

    await db.integrationWebhook.update({
      where: { id: webhook.id },
      data: updateData,
    });
  }

  return { success, statusCode };
}

// ─── Signing ────────────────────────────────────────────────

/**
 * Sign a webhook payload with HMAC-SHA256.
 */
export function signWebhookPayload(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

/**
 * Integration Webhook Event Handler
 *
 * Registered as a wildcard handler — runs on EVERY domain event.
 * Checks for IntegrationWebhook subscribers matching the event type
 * and enqueues a webhook-delivery job for each match.
 */

import { db } from "@/lib/db";
import { enqueueJob } from "@/lib/jobs/dispatcher";
import type { DomainEvent } from "@prisma/client";

export async function handleIntegrationWebhooks(
  event: DomainEvent
): Promise<void> {
  // Find all active webhook subscriptions that include this event type
  const webhooks = await db.integrationWebhook.findMany({
    where: {
      isActive: true,
      eventTypes: { has: event.eventType },
    },
    select: {
      id: true,
    },
  });

  if (webhooks.length === 0) return;

  // Enqueue a delivery job for each subscriber
  for (const webhook of webhooks) {
    await enqueueJob({
      type: "webhook-delivery",
      payload: {
        webhookId: webhook.id,
        eventType: event.eventType,
        eventId: event.id,
        eventPayload: event.payload,
      },
      maxAttempts: 5,
    });
  }
}

/**
 * Job Handler Registry
 *
 * Maps job type strings to handler functions.
 * Each handler receives the job payload and returns an optional result.
 */

import { deliverWebhook } from "@/lib/integration-webhooks";

// ─── Handler Type ───────────────────────────────────────────

type JobHandler = (
  payload: Record<string, unknown>
) => Promise<Record<string, unknown> | void>;

// ─── Handler Registry ───────────────────────────────────────

const jobHandlers: Record<string, JobHandler> = {
  /**
   * Deliver a domain event to an external webhook subscriber.
   * Payload: { webhookId, eventType, eventId, eventPayload }
   */
  "webhook-delivery": async (payload) => {
    const { webhookId, eventType, eventId, eventPayload } = payload as {
      webhookId: string;
      eventType: string;
      eventId: string;
      eventPayload: Record<string, unknown>;
    };

    const result = await deliverWebhook({
      webhookId,
      eventType,
      eventId,
      payload: eventPayload,
    });

    if (!result.success) {
      throw new Error(
        `Webhook delivery failed with status ${result.statusCode}`
      );
    }

    return { statusCode: result.statusCode };
  },
};

/**
 * Look up a handler for a given job type.
 */
export function getJobHandler(type: string): JobHandler | undefined {
  return jobHandlers[type];
}

/**
 * Register a new job handler at runtime.
 */
export function registerJobHandler(type: string, handler: JobHandler): void {
  jobHandlers[type] = handler;
}

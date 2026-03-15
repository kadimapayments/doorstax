import { db } from "@/lib/db";
import { withCronGuard } from "@/lib/cron-guard";

const MAX_ATTEMPTS = 5;
const MAX_AGE_DAYS = 7;

export const GET = withCronGuard("retry-webhooks", async () => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);

  // Find FAILED webhook events eligible for retry
  const failedEvents = await db.webhookEvent.findMany({
    where: {
      status: "FAILED",
      attempts: { lt: MAX_ATTEMPTS },
      createdAt: { gt: cutoff },
    },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  if (failedEvents.length === 0) {
    return { summary: { retried: 0, message: "No failed webhooks to retry" } };
  }

  let retried = 0;

  for (const evt of failedEvents) {
    try {
      // Reset status to RECEIVED so the webhook handler can re-process
      await db.webhookEvent.update({
        where: { id: evt.id },
        data: {
          status: "RECEIVED",
          lastError: `Retry scheduled (attempt ${evt.attempts + 1})`,
        },
      });
      retried++;
    } catch (err) {
      console.error(`[retry-webhooks] Failed to queue retry for ${evt.eventId}:`, err);
    }
  }

  return {
    summary: {
      retried,
      total: failedEvents.length,
      message: `Queued ${retried} webhook events for retry`,
    },
  };
});

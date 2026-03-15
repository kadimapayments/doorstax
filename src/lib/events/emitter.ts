/**
 * Domain Event Emitter
 *
 * Core emit() function that:
 * 1. Persists the event to the database (immutable audit record)
 * 2. Executes registered handlers (failures logged, never thrown)
 * 3. Returns the event ID for reference
 *
 * Callers should fire-and-forget for non-critical events:
 *   emit({ ... }).catch(console.error)
 */

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getHandlers } from "./registry";
import type { EmitOptions } from "./types";

// Ensure handlers are registered before first emit
import "./handlers";

/**
 * Emit a domain event.
 * Stores the event in the database, then runs all registered handlers.
 * Handler failures are captured but never propagate to the caller.
 */
export async function emit(opts: EmitOptions): Promise<string> {
  // 1. Persist the event
  const event = await db.domainEvent.create({
    data: {
      eventType: opts.eventType,
      aggregateType: opts.aggregateType,
      aggregateId: opts.aggregateId,
      payload: opts.payload as Prisma.InputJsonValue,
      emittedBy: opts.emittedBy ?? "system",
      status: "PENDING",
    },
  });

  // 2. Look up handlers
  const eventHandlers = getHandlers(opts.eventType);

  if (eventHandlers.length === 0) {
    // No handlers — mark as processed immediately
    await db.domainEvent.update({
      where: { id: event.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
    return event.id;
  }

  // 3. Execute handlers (failures logged, never thrown)
  const handlerErrors: Record<string, string> = {};
  let successCount = 0;

  for (let i = 0; i < eventHandlers.length; i++) {
    try {
      await eventHandlers[i](event);
      successCount++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      handlerErrors[`handler_${i}`] = errorMsg;
      console.error(
        `[events] Handler ${i} failed for ${opts.eventType}:${event.id}:`,
        err
      );
    }
  }

  // 4. Update event status
  const allFailed = successCount === 0;
  await db.domainEvent.update({
    where: { id: event.id },
    data: {
      status: allFailed ? "FAILED" : "PROCESSED",
      processedAt: new Date(),
      handlerErrors:
        Object.keys(handlerErrors).length > 0
          ? (handlerErrors as Prisma.InputJsonValue)
          : undefined,
    },
  });

  return event.id;
}

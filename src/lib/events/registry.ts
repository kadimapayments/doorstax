/**
 * Event Handler Registry
 *
 * Static map of event types to handler functions.
 * Handlers are registered at import time and looked up by the emitter.
 */

import type { EventHandler } from "./types";

const handlers = new Map<string, EventHandler[]>();

/**
 * Register a handler for a specific event type.
 * Multiple handlers can be registered per event type.
 */
export function on(eventType: string, handler: EventHandler): void {
  const existing = handlers.get(eventType) || [];
  existing.push(handler);
  handlers.set(eventType, existing);
}

/**
 * Register a handler that runs for ALL event types.
 * Used by the integration webhook handler.
 */
export function onAll(handler: EventHandler): void {
  on("*", handler);
}

/**
 * Get all handlers for a given event type (including wildcard handlers).
 */
export function getHandlers(eventType: string): EventHandler[] {
  const specific = handlers.get(eventType) || [];
  const wildcard = handlers.get("*") || [];
  return [...specific, ...wildcard];
}

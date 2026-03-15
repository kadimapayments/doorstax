/**
 * Internal Domain Event System — Type Definitions
 *
 * Immutable, timestamped events stored in the database for audit purposes.
 * Handlers are idempotent and fire-and-forget (never block API requests).
 */

import type { DomainEvent } from "@prisma/client";

// ─── Event Types ────────────────────────────────────────────

export type DomainEventType =
  | "payment.created"
  | "payment.succeeded"
  | "payment.failed"
  | "payment.refunded"
  | "rent.charged"
  | "tenant.created"
  | "lease.created"
  | "lease.expiring"
  | "payout.generated"
  | "chargeback.received"
  | "autopay.enrolled"
  | "autopay.cancelled"
  | "autopay.failed"
  | "reconciliation.completed";

// ─── Emit Options ───────────────────────────────────────────

export interface EmitOptions {
  eventType: DomainEventType;
  aggregateType: string;   // "Payment", "Tenant", "Lease", "Payout"
  aggregateId: string;     // ID of the entity that produced the event
  payload: Record<string, unknown>;
  emittedBy?: string;      // userId or "system"
}

// ─── Event Handler ──────────────────────────────────────────

export type EventHandler = (event: DomainEvent) => Promise<void>;

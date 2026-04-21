import type { RecoveryPlanStatus } from "@prisma/client";

/**
 * Recovery plan state machine.
 *
 * This module is the ONLY place `RecoveryPlan.status` is written. Every
 * mutation in the service layer routes through `assertTransition()` before
 * calling `db.recoveryPlan.update({ status: ... })`. Raw status writes
 * anywhere else in the codebase are a bug.
 *
 * Why a dedicated guard instead of Prisma check constraints: state
 * transitions depend on runtime context (completed payment count, grace
 * windows, failure policy) and fire side-effects (audit logs, notifications,
 * ledger entries). A pure-SQL constraint would miss those invariants.
 *
 * Transitions:
 *
 *   PLAN_OFFERED   → PLAN_ACTIVE       (tenant accepts / PM activates)
 *   PLAN_OFFERED   → PLAN_CANCELLED    (PM withdraws before start)
 *
 *   PLAN_ACTIVE    → PLAN_AT_RISK      (a payment is late but within grace)
 *   PLAN_ACTIVE    → PLAN_FAILED       (miss past grace, policy=FAIL)
 *   PLAN_ACTIVE    → PLAN_COMPLETED    (all required on-time payments made)
 *
 *   PLAN_AT_RISK   → PLAN_ACTIVE       (late payment landed within grace)
 *   PLAN_AT_RISK   → PLAN_FAILED       (grace window elapsed)
 *   PLAN_AT_RISK   → PLAN_COMPLETED    (last required payment landed)
 *
 *   PLAN_FAILED       — terminal
 *   PLAN_COMPLETED    — terminal (forgiveness applied as a separate
 *                       side effect — no BALANCE_FORGIVEN sub-state;
 *                       trace via `forgivenessLedgerEntryId` +
 *                       `forgivenessAppliedAt` on the plan row)
 *   PLAN_CANCELLED    — terminal
 */

const ALLOWED: Record<RecoveryPlanStatus, RecoveryPlanStatus[]> = {
  PLAN_OFFERED: ["PLAN_ACTIVE", "PLAN_CANCELLED"],
  PLAN_ACTIVE: ["PLAN_AT_RISK", "PLAN_FAILED", "PLAN_COMPLETED"],
  PLAN_AT_RISK: ["PLAN_ACTIVE", "PLAN_FAILED", "PLAN_COMPLETED"],
  PLAN_FAILED: [],
  PLAN_COMPLETED: [],
  PLAN_CANCELLED: [],
};

/**
 * Returns true if `from → to` is a legal transition. Same-state is allowed
 * (no-op update); everything else must be in the ALLOWED map.
 */
export function canTransition(
  from: RecoveryPlanStatus,
  to: RecoveryPlanStatus
): boolean {
  if (from === to) return true;
  return ALLOWED[from]?.includes(to) ?? false;
}

export class RecoveryTransitionError extends Error {
  constructor(
    public from: RecoveryPlanStatus,
    public to: RecoveryPlanStatus
  ) {
    super(`Illegal recovery plan transition: ${from} → ${to}`);
    this.name = "RecoveryTransitionError";
  }
}

/**
 * Guard — throws if the transition is illegal. Call this immediately
 * before a status update. The thrown error should be caught by the
 * service function and surfaced to the caller as a 409 Conflict.
 */
export function assertTransition(
  from: RecoveryPlanStatus,
  to: RecoveryPlanStatus
): void {
  if (!canTransition(from, to)) {
    throw new RecoveryTransitionError(from, to);
  }
}

/**
 * Convenience for callers that want to know if a status is a terminal
 * state (no further transitions possible). Used by the reconciliation
 * endpoint to skip completed / failed / cancelled plans.
 */
export function isTerminal(status: RecoveryPlanStatus): boolean {
  return (
    status === "PLAN_FAILED" ||
    status === "PLAN_COMPLETED" ||
    status === "PLAN_CANCELLED"
  );
}

export function isActive(status: RecoveryPlanStatus): boolean {
  return status === "PLAN_ACTIVE" || status === "PLAN_AT_RISK";
}

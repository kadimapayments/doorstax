/**
 * Recovery plan communication templates (V1 — manual send).
 *
 * No automation yet. These are pure template functions; a PM triggers
 * them from the dashboard and the existing `notify()` helper fans them
 * out. When we graduate to automated triggers (scheduled reminders,
 * cron-driven warnings), the same templates get reused.
 *
 * Why keep these centralised:
 *  - Legal review touches recovery communication first; one file to
 *    approve beats hunting across routes.
 *  - Consistent copy ("your recovery plan", "prior overdue balance")
 *    across channels (in-app notice + email) prevents tenant confusion.
 *  - Easy A/B later without digging through route handlers.
 */

export interface RecoveryMessageContext {
  tenantName: string;
  propertyName: string;
  unitNumber?: string | null;
  originalBalance: number;
  forgivenessAmount: number;
  requiredPayments: number;
  completedPayments?: number;
  periodKey?: string; // "YYYY-MM" for payment-specific messages
  dueDate?: string; // formatted due date
}

function money(n: number): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function unitLabel(ctx: RecoveryMessageContext): string {
  return ctx.unitNumber
    ? `${ctx.propertyName} — Unit ${ctx.unitNumber}`
    : ctx.propertyName;
}

// ────────────────────────────────────────────────────────────────
// On plan creation — offer / activation
// ────────────────────────────────────────────────────────────────

export function planOfferedMessage(ctx: RecoveryMessageContext) {
  return {
    title: "Repayment plan offered",
    body: `Hi ${ctx.tenantName}, your property manager has offered a structured repayment plan for ${unitLabel(ctx)}. Make ${ctx.requiredPayments} consecutive on-time rent payments and ${money(ctx.forgivenessAmount)} of your prior overdue balance (${money(ctx.originalBalance)}) will be forgiven. Contact your property manager to accept.`,
  };
}

export function planActivatedMessage(ctx: RecoveryMessageContext) {
  return {
    title: "Repayment plan started",
    body: `Your repayment plan is active. Make ${ctx.requiredPayments} consecutive on-time rent payments at ${unitLabel(ctx)} and ${money(ctx.forgivenessAmount)} will be credited back to your ledger. Any missed payment may end the plan and reinstate the full balance.`,
  };
}

// ────────────────────────────────────────────────────────────────
// Reminders + progress
// ────────────────────────────────────────────────────────────────

export function paymentDueReminderMessage(ctx: RecoveryMessageContext) {
  const remaining =
    ctx.requiredPayments - (ctx.completedPayments ?? 0);
  return {
    title: "Recovery-plan rent due soon",
    body: `Your next recovery-plan payment for ${unitLabel(ctx)} is due ${ctx.dueDate || "soon"}. You have ${remaining} payment${remaining === 1 ? "" : "s"} left to secure ${money(ctx.forgivenessAmount)} in forgiveness.`,
  };
}

export function paymentCountedMessage(ctx: RecoveryMessageContext) {
  const progress = `${ctx.completedPayments ?? 0} of ${ctx.requiredPayments}`;
  return {
    title: "On-time payment counted",
    body: `Thank you — your ${ctx.periodKey || "latest"} payment for ${unitLabel(ctx)} was counted toward your recovery plan. Progress: ${progress}.`,
  };
}

// ────────────────────────────────────────────────────────────────
// Warnings + failures
// ────────────────────────────────────────────────────────────────

export function latePaymentWarningMessage(ctx: RecoveryMessageContext) {
  return {
    title: "Your recovery plan is at risk",
    body: `A rent payment for ${unitLabel(ctx)} is past its due date but still within the grace window. Pay now to keep your plan active and on track for ${money(ctx.forgivenessAmount)} in forgiveness.`,
  };
}

export function planFailedMessage(ctx: RecoveryMessageContext) {
  return {
    title: "Recovery plan ended",
    body: `A required payment for ${unitLabel(ctx)} was missed past the grace window. The recovery plan has ended and your original balance (${money(ctx.originalBalance)}) remains due. Contact your property manager to discuss next steps.`,
  };
}

// ────────────────────────────────────────────────────────────────
// Success
// ────────────────────────────────────────────────────────────────

export function planCompletedMessage(ctx: RecoveryMessageContext) {
  return {
    title: "Recovery plan complete",
    body: `Congratulations — you completed all ${ctx.requiredPayments} on-time payments for ${unitLabel(ctx)}. ${money(ctx.forgivenessAmount)} has been credited to your ledger. Your account is back in good standing.`,
  };
}

export type RecoveryMessage = ReturnType<typeof planOfferedMessage>;

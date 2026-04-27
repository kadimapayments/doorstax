/**
 * Process Scheduled Payments Cron
 *
 * Picks up due ScheduledPayment rows (executed=false AND scheduledDate
 * <= now AND attempts < 3), runs them through executeScheduledPayment,
 * and applies the locked-in failure semantics:
 *
 *   - Success → mark executed=true with paymentId, notify PM + tenant.
 *   - Retryable failure (no method, gateway decline, gateway error)
 *     → bump attempts, set lastAttemptAt + failedReason, notify PM
 *     and tenant. If attempts hits 3, mark executed=true with
 *     notifiedFinalFailure=true and send the "gave up" notice.
 *   - Hard failure (property/merchant not approved) → mark executed=
 *     true immediately, notify PM (tenant doesn't need to know about
 *     internal merchant approval state).
 *
 * Schedule: 0 6 * * * (06:00 UTC daily). One day's gap between
 * attempts gives enough time for tenant payday cycles + transient
 * decline reasons (insufficient funds today, paycheck lands tomorrow).
 *
 * Idempotency: re-running mid-day is safe — already-executed rows
 * are filtered out, and the executor itself re-checks executed=false
 * before creating any Payment row.
 */

import { withCronGuard } from "@/lib/cron-guard";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import {
  executeScheduledPayment,
  type ScheduledExecuteResult,
} from "@/lib/scheduled-payments/execute";

const MAX_ATTEMPTS = 3;

// ─── Notification helpers ───
// We send to PM (landlord User) on every state change and to the
// tenant on success / final failure (not on transient retries — no
// point spamming a tenant about a card decline they may not even
// know happened from a back-office charge).

async function notifySuccess(opts: {
  pmId: string;
  tenantUserId: string;
  tenantEmail?: string | null;
  tenantName: string;
  amount: number;
  method: "card" | "ach";
  paymentId: string;
}) {
  const { pmId, tenantUserId, tenantEmail, tenantName, amount, method, paymentId } =
    opts;
  const amountStr = `$${amount.toFixed(2)}`;
  const methodLabel = method === "ach" ? "bank account" : "card on file";

  await notify({
    userId: pmId,
    createdById: pmId,
    type: "scheduled_payment_success",
    title: "Scheduled payment processed",
    message: `${amountStr} charged to ${tenantName}'s ${methodLabel}.`,
    severity: "info",
    amount,
    actionUrl: `/dashboard/payments?paymentId=${paymentId}`,
  });

  await notify({
    userId: tenantUserId,
    createdById: pmId,
    type: "scheduled_payment_charged",
    title: "Payment received",
    message: `Your scheduled payment of ${amountStr} was processed via ${methodLabel}.`,
    severity: "info",
    amount,
    email: tenantEmail
      ? {
          to: tenantEmail,
          subject: `Payment received — ${amountStr}`,
          html: `<p>Hi ${tenantName},</p><p>Your scheduled payment of <strong>${amountStr}</strong> was received via your ${methodLabel}. No action needed.</p><p>— DoorStax</p>`,
        }
      : undefined,
  });
}

async function notifyRetry(opts: {
  pmId: string;
  tenantName: string;
  amount: number;
  attempt: number;
  reason: string;
  scheduledPaymentId: string;
}) {
  const { pmId, tenantName, amount, attempt, reason, scheduledPaymentId } = opts;
  await notify({
    userId: pmId,
    createdById: pmId,
    type: "scheduled_payment_retry",
    title: `Scheduled payment failed — attempt ${attempt}/${MAX_ATTEMPTS}`,
    message: `${tenantName}'s $${amount.toFixed(2)} scheduled payment failed: ${reason}. Will retry in 24h.`,
    severity: "warning",
    amount,
    actionUrl: `/dashboard/payments/schedule?highlight=${scheduledPaymentId}`,
  });
}

async function notifyFinalFailure(opts: {
  pmId: string;
  tenantUserId: string;
  tenantEmail?: string | null;
  tenantName: string;
  amount: number;
  reason: string;
  retryable: boolean;
  scheduledPaymentId: string;
}) {
  const {
    pmId,
    tenantUserId,
    tenantEmail,
    tenantName,
    amount,
    reason,
    retryable,
    scheduledPaymentId,
  } = opts;
  const amountStr = `$${amount.toFixed(2)}`;

  // PM: urgent, includes the failure reason and a deep link.
  await notify({
    userId: pmId,
    createdById: pmId,
    type: "scheduled_payment_final_failure",
    title: retryable
      ? "Scheduled payment failed — gave up after 3 attempts"
      : "Scheduled payment cannot be processed",
    message: `${tenantName}'s ${amountStr} scheduled payment was not processed. Reason: ${reason}. Reschedule manually after fixing the issue.`,
    severity: "urgent",
    amount,
    actionUrl: `/dashboard/payments/schedule?highlight=${scheduledPaymentId}`,
  });

  // Tenant: only get the in-app + email if the failure was retryable
  // (i.e. money problem on their end). Don't notify on PROPERTY/MERCHANT
  // not-approved — that's an internal landlord state the tenant has
  // no agency over.
  if (retryable) {
    await notify({
      userId: tenantUserId,
      createdById: pmId,
      type: "scheduled_payment_failed",
      title: "Payment didn't process",
      message: `Your scheduled payment of ${amountStr} could not be processed. Please contact your property manager or update your payment method in the portal.`,
      severity: "urgent",
      amount,
      email: tenantEmail
        ? {
            to: tenantEmail,
            subject: `Payment didn't go through — ${amountStr}`,
            html: `<p>Hi ${tenantName},</p><p>We tried to process your scheduled payment of <strong>${amountStr}</strong> but it did not go through.</p><p>Please log into your DoorStax portal to update your card or bank account, or contact your property manager.</p><p>— DoorStax</p>`,
          }
        : undefined,
    });
  }
}

// ─── Main processor ───

export const GET = withCronGuard("process-scheduled-payments", async () => {
  const now = new Date();

  // Pick up rows due now (or earlier — covers the case where a cron
  // run was missed/delayed) and still under the attempt cap. Cap the
  // batch at 200 per run so a runaway never blows the 60s function
  // timeout. If there are more, the next run picks them up.
  const due = await db.scheduledPayment.findMany({
    where: {
      executed: false,
      scheduledDate: { lte: now },
      attempts: { lt: MAX_ATTEMPTS },
    },
    include: {
      tenant: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { scheduledDate: "asc" },
    take: 200,
  });

  let succeeded = 0;
  let retried = 0;
  let finalFailed = 0;
  let hardFailed = 0;
  const errors: Array<{ id: string; reason: string }> = [];

  for (const row of due) {
    const tenantUser = row.tenant?.user;
    const tenantName = tenantUser?.name || "Tenant";
    const tenantEmail = tenantUser?.email ?? null;
    const tenantUserId = tenantUser?.id;
    const amount = Number(row.amount);

    let result: ScheduledExecuteResult;
    try {
      result = await executeScheduledPayment(row.id);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Unknown error";
      errors.push({ id: row.id, reason });
      // Treat as retryable system error.
      await db.scheduledPayment.update({
        where: { id: row.id },
        data: {
          attempts: { increment: 1 },
          lastAttemptAt: now,
          failedReason: `System error: ${reason}`,
        },
      });
      continue;
    }

    if (result.ok) {
      await db.scheduledPayment.update({
        where: { id: row.id },
        data: {
          executed: true,
          executedAt: now,
          paymentId: result.paymentId,
          lastAttemptAt: now,
          // Keep failedReason null on success even if a prior attempt
          // populated it — clears the warning state on the schedule page.
          failedReason: null,
        },
      });
      succeeded += 1;
      if (tenantUserId) {
        await notifySuccess({
          pmId: row.landlordId,
          tenantUserId,
          tenantEmail,
          tenantName,
          amount,
          method: result.method,
          paymentId: result.paymentId,
        });
      }
      continue;
    }

    // ─── Failure branch ───
    const newAttempts = row.attempts + 1;

    // Hard failure → terminal immediately, no retry.
    if (!result.retry) {
      await db.scheduledPayment.update({
        where: { id: row.id },
        data: {
          executed: true,
          executedAt: now,
          attempts: newAttempts,
          lastAttemptAt: now,
          failedReason: result.reason,
          notifiedFinalFailure: true,
        },
      });
      hardFailed += 1;
      if (tenantUserId) {
        await notifyFinalFailure({
          pmId: row.landlordId,
          tenantUserId,
          tenantEmail,
          tenantName,
          amount,
          reason: result.reason,
          retryable: false,
          scheduledPaymentId: row.id,
        });
      }
      continue;
    }

    // Retryable failure → bump attempts. If we've hit the cap, flip
    // executed=true and send the final-failure notice. Otherwise just
    // record the attempt and notify the PM (tenant gets notified only
    // on the final failure, not on every transient retry).
    if (newAttempts >= MAX_ATTEMPTS) {
      await db.scheduledPayment.update({
        where: { id: row.id },
        data: {
          executed: true,
          executedAt: now,
          attempts: newAttempts,
          lastAttemptAt: now,
          failedReason: result.reason,
          notifiedFinalFailure: true,
        },
      });
      finalFailed += 1;
      if (tenantUserId) {
        await notifyFinalFailure({
          pmId: row.landlordId,
          tenantUserId,
          tenantEmail,
          tenantName,
          amount,
          reason: result.reason,
          retryable: true,
          scheduledPaymentId: row.id,
        });
      }
    } else {
      await db.scheduledPayment.update({
        where: { id: row.id },
        data: {
          attempts: newAttempts,
          lastAttemptAt: now,
          failedReason: result.reason,
        },
      });
      retried += 1;
      await notifyRetry({
        pmId: row.landlordId,
        tenantName,
        amount,
        attempt: newAttempts,
        reason: result.reason,
        scheduledPaymentId: row.id,
      });
    }
  }

  return {
    summary: {
      scanned: due.length,
      succeeded,
      retried,
      finalFailed,
      hardFailed,
      errors,
      message: `Processed ${due.length} scheduled payments — ${succeeded} succeeded, ${retried} will retry, ${finalFailed} gave up, ${hardFailed} hard-failed`,
    },
  };
});

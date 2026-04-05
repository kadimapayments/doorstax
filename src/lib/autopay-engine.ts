/**
 * Autopay Engine
 *
 * Extends the existing RecurringBilling + Kadima recurring system.
 * Provides pre-charge notifications, enrollment reminders,
 * failure handling, and cancellation rules.
 */

import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { emit } from "@/lib/events/emitter";
import { autopayUpcomingHtml } from "@/lib/emails/autopay-upcoming";
import { autopayEnrollmentHtml } from "@/lib/emails/autopay-enrollment";
import { autopayPausedHtml } from "@/lib/emails/autopay-paused";

// ─── Pre-Charge Notifications ───────────────────────────────

/**
 * Send notifications to tenants 3 days before their autopay charge.
 * Skips tenants already notified in the current billing cycle.
 */
export async function sendPreChargeNotifications(): Promise<{ sent: number }> {
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find active autopay enrollments with upcoming charges
  const billings = await db.recurringBilling.findMany({
    where: {
      status: "ACTIVE",
      nextChargeDate: {
        lte: threeDaysFromNow,
        gt: new Date(),
      },
    },
    include: {
      tenant: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          unit: {
            select: {
              unitNumber: true,
              rentAmount: true,
              property: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  let sent = 0;

  for (const billing of billings) {
    // Skip if already notified this billing cycle
    if (billing.preChargeNotifiedAt) {
      const notifiedDate = new Date(billing.preChargeNotifiedAt);
      // If notified within the last 25 days, skip (prevents double-notify per cycle)
      const daysSinceNotified = Math.floor(
        (today.getTime() - notifiedDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceNotified < 25) continue;
    }

    const tenant = billing.tenant;
    if (!tenant?.user || !tenant.unit) continue;

    const chargeDate = billing.nextChargeDate!;
    const formattedDate = chargeDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    await notify({
      userId: tenant.user.id,
      createdById: tenant.user.id,
      type: "AUTOPAY_UPCOMING",
      title: "Upcoming Autopay Charge",
      message: `Your autopay payment of $${Number(billing.amount).toFixed(2)} for ${tenant.unit.property?.name || ""} Unit ${tenant.unit.unitNumber} will be processed on ${formattedDate}.`,
      severity: "info",
      amount: Number(billing.amount),
      email: {
        to: tenant.user.email!,
        subject: "Upcoming Autopay Payment",
        html: autopayUpcomingHtml({
          tenantName: tenant.user.name || "Tenant",
          amount: `$${Number(billing.amount).toFixed(2)}`,
          chargeDate: formattedDate,
          paymentMethod: billing.paymentMethod || "Autopay",
          propertyName: tenant.unit.property?.name || "Your Property",
          unitNumber: tenant.unit.unitNumber,
        }),
      },
    }).catch(console.error);

    await db.recurringBilling.update({
      where: { id: billing.id },
      data: { preChargeNotifiedAt: new Date() },
    });

    sent++;
  }

  return { sent };
}

// ─── Enrollment Reminders ───────────────────────────────────

/**
 * Send enrollment reminders to active tenants who don't have autopay.
 * Limits to one reminder per 30 days per tenant.
 */
export async function sendEnrollmentReminders(): Promise<{ sent: number }> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Find active tenants without autopay
  const tenants = await db.tenantProfile.findMany({
    where: {
      autopayEnabled: false,
      status: "ACTIVE",
      unitId: { not: null },
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      unit: {
        select: {
          unitNumber: true,
          rentAmount: true,
          property: { select: { name: true } },
        },
      },
    },
    take: 50, // Batch to avoid overwhelming email provider
  });

  let sent = 0;

  for (const tenant of tenants) {
    if (!tenant.user || !tenant.unit) continue;

    // Check if we recently sent a reminder (via DomainEvent)
    const recentReminder = await db.domainEvent.findFirst({
      where: {
        eventType: "autopay.reminder_sent",
        aggregateType: "TenantProfile",
        aggregateId: tenant.id,
        createdAt: { gt: thirtyDaysAgo },
      },
    });

    if (recentReminder) continue;

    await notify({
      userId: tenant.user.id,
      createdById: tenant.user.id,
      type: "AUTOPAY_ENROLLMENT_REMINDER",
      title: "Set Up Autopay",
      message: `Never miss a payment! Enable autopay for your rent at ${tenant.unit.property?.name || ""} Unit ${tenant.unit.unitNumber} to automatically pay $${Number(tenant.unit.rentAmount).toFixed(2)} each month.`,
      severity: "info",
      email: {
        to: tenant.user.email!,
        subject: "Set Up Automatic Rent Payments",
        html: autopayEnrollmentHtml({
          tenantName: tenant.user.name || "Tenant",
          rentAmount: `$${Number(tenant.unit.rentAmount).toFixed(2)}`,
          propertyName: tenant.unit.property?.name || "Your Property",
          unitNumber: tenant.unit.unitNumber,
        }),
      },
    }).catch(console.error);

    // Track that we sent a reminder
    emit({
      eventType: "autopay.reminder_sent" as never, // Internal tracking event
      aggregateType: "TenantProfile",
      aggregateId: tenant.id,
      payload: { tenantUserId: tenant.user.id },
      emittedBy: "system",
    }).catch(console.error);

    sent++;
  }

  return { sent };
}

// ─── Failure Handling ───────────────────────────────────────

/**
 * Handle a failed autopay attempt.
 * Increments failure count. If max retries exceeded, pauses autopay.
 */
export async function handleAutopayFailure(
  tenantId: string,
  reason: string
): Promise<void> {
  const billing = await db.recurringBilling.findUnique({
    where: { tenantId },
    include: {
      tenant: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          unit: {
            select: {
              unitNumber: true,
              property: {
                select: { name: true, landlordId: true },
              },
            },
          },
        },
      },
    },
  });

  if (!billing || billing.status !== "ACTIVE") return;

  const newFailedAttempts = billing.failedAttempts + 1;

  if (newFailedAttempts >= billing.maxRetries) {
    // Pause autopay — max retries exceeded
    await db.recurringBilling.update({
      where: { id: billing.id },
      data: {
        status: "PAUSED",
        failedAttempts: newFailedAttempts,
        lastFailureReason: reason,
      },
    });

    await db.tenantProfile.update({
      where: { id: tenantId },
      data: { autopayEnabled: false },
    });

    // Notify tenant
    if (billing.tenant?.user) {
      await notify({
        userId: billing.tenant.user.id,
        createdById: billing.tenant.user.id,
        type: "AUTOPAY_PAUSED",
        title: "Autopay Paused",
        message: `Your autopay has been paused after ${newFailedAttempts} failed attempts. Last error: ${reason}. Please update your payment method and re-enable autopay.`,
        severity: "urgent",
        email: {
          to: billing.tenant.user.email!,
          subject: "Your Autopay Has Been Paused",
          html: autopayPausedHtml({
            tenantName: billing.tenant.user.name || "Tenant",
            failedAttempts: newFailedAttempts,
            reason,
            propertyName: billing.tenant.unit?.property?.name || "Your Property",
            unitNumber: billing.tenant.unit?.unitNumber || "—",
          }),
        },
      }).catch(console.error);
    }

    // Notify PM
    if (billing.tenant?.unit?.property?.landlordId) {
      await notify({
        userId: billing.tenant.unit.property.landlordId,
        createdById: billing.tenant.user?.id || "system",
        type: "AUTOPAY_PAUSED",
        title: "Tenant Autopay Paused",
        message: `Autopay for ${billing.tenant.user?.name || "tenant"} at ${billing.tenant.unit.property.name} Unit ${billing.tenant.unit.unitNumber} has been paused after ${newFailedAttempts} failed attempts.`,
        severity: "warning",
      }).catch(console.error);
    }
  } else {
    // Just increment failure count
    await db.recurringBilling.update({
      where: { id: billing.id },
      data: {
        failedAttempts: newFailedAttempts,
        lastFailureReason: reason,
      },
    });

    // Notify tenant of failure
    if (billing.tenant?.user) {
      await notify({
        userId: billing.tenant.user.id,
        createdById: billing.tenant.user.id,
        type: "AUTOPAY_FAILED",
        title: "Autopay Payment Failed",
        message: `Your autopay payment failed: ${reason}. We'll retry automatically. Attempt ${newFailedAttempts} of ${billing.maxRetries}.`,
        severity: "warning",
      }).catch(console.error);
    }
  }

  // Emit event
  emit({
    eventType: "autopay.failed",
    aggregateType: "RecurringBilling",
    aggregateId: billing.id,
    payload: {
      tenantId,
      failedAttempts: newFailedAttempts,
      maxRetries: billing.maxRetries,
      reason,
      paused: newFailedAttempts >= billing.maxRetries,
    },
    emittedBy: "system",
  }).catch(console.error);
}

// ─── Cancellation Rules ─────────────────────────────────────

/**
 * Check if a tenant can cancel autopay.
 * Denies if there's an upcoming charge within 3 days.
 */
export async function canCancelAutopay(
  tenantId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const billing = await db.recurringBilling.findUnique({
    where: { tenantId },
  });

  if (!billing) {
    return { allowed: false, reason: "No autopay enrollment found" };
  }

  if (billing.status === "CANCELLED") {
    return { allowed: false, reason: "Autopay is already cancelled" };
  }

  // Check for upcoming charge within 3 days
  if (billing.nextChargeDate) {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    if (billing.nextChargeDate <= threeDaysFromNow && billing.nextChargeDate > new Date()) {
      return {
        allowed: false,
        reason: "Cannot cancel autopay within 3 days of the next charge. Contact your property manager for assistance.",
      };
    }
  }

  return { allowed: true };
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Calculate the next charge date based on day of month.
 */
export function calculateNextChargeDate(dayOfMonth: number): Date {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);

  // If the day has already passed this month, move to next month
  if (next <= now) {
    next.setMonth(next.getMonth() + 1);
  }

  // Handle months with fewer days (e.g., day 31 in February)
  if (next.getDate() !== dayOfMonth) {
    // Set to last day of the target month
    next.setDate(0);
  }

  return next;
}

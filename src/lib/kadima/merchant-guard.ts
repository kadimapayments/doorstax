/**
 * Merchant Approval Guard
 *
 * Verifies that a PM's merchant application has been approved
 * before allowing payment operations. This prevents charges against
 * unapproved merchant accounts which would fail at Kadima or
 * violate compliance requirements.
 *
 * ─── PM Onboarding Timeline ──────────────────────────────────────
 * Day 0:    PM signs up. 14-day trial starts, 30-day merchant app
 *           window starts. Kadima lead is created; hosted URL is
 *           emailed to the PM.
 * Day 1–14: Free trial. PM explores software, completes onboarding
 *           checklist. Merchant application should be finished
 *           during this period.
 * Day 3+:   Daily reminder cron starts emailing incomplete apps
 *           (max once per 7 days per PM).
 * Day 14:   Trial ends. First subscription charge. PM must have a
 *           payment method on file.
 * Day 14–30: PM is a paying subscriber. Merchant app still has time
 *           to finish.
 * Day 23:   7-day expiry warning email is sent.
 * Day 30:   Merchant application expires (status = EXPIRED) if not
 *           completed. PM can still use the platform for reporting
 *           and management, but cannot process payments until a new
 *           application is started.
 *
 * Key constraints:
 * - Trial: 14 days, no charge
 * - Merchant app: 30 days to complete from signup
 * - Expired apps block payment processing but do NOT cancel the
 *   subscription — the PM keeps their data and can reopen an app.
 */

import { db } from "@/lib/db";

export interface MerchantApprovalResult {
  approved: boolean;
  status: string | null;
  reason: string | null;
}

/**
 * Check if a PM's merchant application is approved.
 * Returns { approved: true } if the application status is APPROVED or SUBMITTED
 * (SUBMITTED is allowed because some PMs may process while underwriting completes).
 *
 * For strict mode, only APPROVED is accepted.
 */
export async function checkMerchantApproval(
  pmUserId: string,
  opts: { strict?: boolean } = {}
): Promise<MerchantApprovalResult> {
  const app = await db.merchantApplication.findUnique({
    where: { userId: pmUserId },
    select: { status: true },
  });

  if (!app) {
    return {
      approved: false,
      status: null,
      reason: "No merchant application found. Complete the merchant onboarding process first.",
    };
  }

  const status = app.status;

  if (status === "APPROVED") {
    return { approved: true, status, reason: null };
  }

  // In non-strict mode, allow SUBMITTED (pending underwriting) to unblock PMs
  // who have completed all steps but are waiting for Kadima approval.
  if (!opts.strict && status === "SUBMITTED") {
    return { approved: true, status, reason: null };
  }

  const messages: Record<string, string> = {
    NOT_STARTED: "Your merchant application has not been started. Complete onboarding before processing payments.",
    IN_PROGRESS: "Your merchant application is still in progress. Submit all steps before processing payments.",
    SUBMITTED: "Your merchant application is pending approval. Payments will be enabled once approved.",
    REJECTED: "Your merchant application was rejected. Contact support for assistance.",
    EXPIRED: "Your merchant application has expired. Please contact support to start a new one.",
  };

  return {
    approved: false,
    status,
    reason: messages[status] || `Merchant application status "${status}" does not allow payment processing.`,
  };
}

/**
 * Check merchant approval for a tenant's PM.
 * Resolves: tenant → unit → property → landlord → merchant application
 */
export async function checkMerchantApprovalForTenant(
  tenantProfileId: string,
  opts: { strict?: boolean } = {}
): Promise<MerchantApprovalResult> {
  const profile = await db.tenantProfile.findUnique({
    where: { id: tenantProfileId },
    select: {
      unit: {
        select: {
          property: {
            select: { landlordId: true },
          },
        },
      },
    },
  });

  if (!profile?.unit?.property?.landlordId) {
    return {
      approved: false,
      status: null,
      reason: "Cannot determine property manager for this tenant.",
    };
  }

  return checkMerchantApproval(profile.unit.property.landlordId, opts);
}

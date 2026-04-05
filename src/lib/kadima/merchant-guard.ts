/**
 * Merchant Approval Guard
 *
 * Verifies that a PM's merchant application has been approved
 * before allowing payment operations. This prevents charges against
 * unapproved merchant accounts which would fail at Kadima or
 * violate compliance requirements.
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

/**
 * Guided Launch Mode — server-side onboarding helpers.
 *
 * Tracks 4 milestones that new PMs must complete before
 * the full app is unlocked:
 *   1. Start merchant application
 *   2. Add first property
 *   3. Add first tenant
 *   4. Send first tenant invite
 */

import { db } from "@/lib/db";

export type OnboardingMilestone =
  | "merchantStarted"
  | "propertyAdded"
  | "tenantAdded"
  | "inviteSent";

export interface OnboardingState {
  merchantStarted: boolean;
  propertyAdded: boolean;
  tenantAdded: boolean;
  inviteSent: boolean;
  complete: boolean;
  completedAt: Date | null;
}

/** Maps milestone key → Prisma column name */
const MILESTONE_FIELD: Record<OnboardingMilestone, string> = {
  merchantStarted: "onboardingMerchantStarted",
  propertyAdded: "onboardingPropertyAdded",
  tenantAdded: "onboardingTenantAdded",
  inviteSent: "onboardingInviteSent",
};

/** Default state: treat as onboarding-complete (safe fallback for non-critical paths). */
const COMPLETE_STATE: OnboardingState = {
  merchantStarted: true,
  propertyAdded: true,
  tenantAdded: true,
  inviteSent: true,
  complete: true,
  completedAt: null,
};

/** Fresh state: treat as onboarding-incomplete (used when we'd rather show the tour than hide it). */
const FRESH_STATE: OnboardingState = {
  merchantStarted: false,
  propertyAdded: false,
  tenantAdded: false,
  inviteSent: false,
  complete: false,
  completedAt: null,
};

/** Fetch the full onboarding state for a PM. */
export async function getOnboardingState(
  userId: string
): Promise<OnboardingState> {
  try {
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        onboardingMerchantStarted: true,
        onboardingPropertyAdded: true,
        onboardingTenantAdded: true,
        onboardingInviteSent: true,
        onboardingComplete: true,
        onboardingCompletedAt: true,
      },
    });

    return {
      merchantStarted: user.onboardingMerchantStarted,
      propertyAdded: user.onboardingPropertyAdded,
      tenantAdded: user.onboardingTenantAdded,
      inviteSent: user.onboardingInviteSent,
      complete: user.onboardingComplete,
      completedAt: user.onboardingCompletedAt,
    };
  } catch (err) {
    console.error("[onboarding] getOnboardingState failed:", err);
    // Default to fresh state — better to show the guided tour than silently skip it
    return FRESH_STATE;
  }
}

/**
 * Mark a single milestone as completed.
 * If all 4 milestones are now done, auto-sets onboardingComplete = true.
 */
export async function completeOnboardingMilestone(
  userId: string,
  milestone: OnboardingMilestone
): Promise<OnboardingState> {
  try {
    const field = MILESTONE_FIELD[milestone];

    // Set the milestone flag
    await db.user.update({
      where: { id: userId },
      data: { [field]: true },
    });

    // Re-fetch to check if all 4 are now true
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        onboardingMerchantStarted: true,
        onboardingPropertyAdded: true,
        onboardingTenantAdded: true,
        onboardingInviteSent: true,
        onboardingComplete: true,
      },
    });

    const allDone =
      user.onboardingMerchantStarted &&
      user.onboardingPropertyAdded &&
      user.onboardingTenantAdded &&
      user.onboardingInviteSent;

    // If all milestones met and not already marked complete, finalize
    if (allDone && !user.onboardingComplete) {
      await db.user.update({
        where: { id: userId },
        data: {
          onboardingComplete: true,
          onboardingCompletedAt: new Date(),
        },
      });
    }

    return getOnboardingState(userId);
  } catch (err) {
    console.error("[onboarding] completeOnboardingMilestone failed:", err);
    return COMPLETE_STATE;
  }
}

/** Quick boolean check — is this PM past onboarding? */
export async function isOnboardingComplete(
  userId: string
): Promise<boolean> {
  try {
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { onboardingComplete: true },
    });
    return user.onboardingComplete;
  } catch (err) {
    console.error("[onboarding] isOnboardingComplete failed:", err);
    // Default to incomplete — better to show the guided tour than silently skip it
    return false;
  }
}

/** Progress summary: { completed, total, milestones }. */
export async function getOnboardingProgress(userId: string) {
  const state = await getOnboardingState(userId);
  const completed = [
    state.merchantStarted,
    state.propertyAdded,
    state.tenantAdded,
    state.inviteSent,
  ].filter(Boolean).length;

  return { completed, total: 4, milestones: state };
}

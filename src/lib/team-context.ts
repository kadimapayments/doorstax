import { db } from "@/lib/db";
import { getPermissions } from "@/lib/permissions";
import type { TeamRole } from "@prisma/client";

export interface TeamContext {
  /** True if the user is a team member (not the landlord owner) */
  isTeamMember: boolean;
  /** The landlord owner's user ID — use this for all data queries */
  landlordId: string;
  /** Team role (null if landlord owner) */
  teamRole: TeamRole | null;
  /** Permission strings, or ["*"] for full access */
  permissions: string[];
}

/**
 * Resolve the team context for a given user.
 * If the user is a team member of a landlord, returns that landlord's ID and the team role.
 * If the user is a standalone landlord, returns their own ID with full permissions.
 */
export async function getTeamContext(userId: string): Promise<TeamContext> {
  // Check if this user is an active team member of any landlord
  const membership = await db.teamMember.findFirst({
    where: { userId, isActive: true },
  });

  if (membership) {
    return {
      isTeamMember: true,
      landlordId: membership.landlordId,
      teamRole: membership.role,
      permissions: getPermissions(membership.role),
    };
  }

  // Standalone landlord — full access
  return {
    isTeamMember: false,
    landlordId: userId,
    teamRole: null,
    permissions: ["*"],
  };
}

/**
 * Check if the team context has a specific permission.
 * Landlord owners (permissions: ["*"]) always return true.
 */
export function can(ctx: TeamContext, permission: string): boolean {
  if (ctx.permissions.includes("*")) return true;
  return ctx.permissions.includes(permission);
}

/**
 * Shorthand for API routes: resolve the effective landlordId for a user.
 * Team members get their employer's ID; standalone landlords get their own.
 */
export async function getEffectiveLandlordId(userId: string): Promise<string> {
  const membership = await db.teamMember.findFirst({
    where: { userId, isActive: true },
    select: { landlordId: true },
  });
  return membership ? membership.landlordId : userId;
}

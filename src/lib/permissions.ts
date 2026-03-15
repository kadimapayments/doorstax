import type { TeamRole } from "@prisma/client";

/**
 * Permission map for team roles.
 * Each role has a set of allowed actions.
 */
const ROLE_PERMISSIONS: Record<TeamRole, string[]> = {
  MANAGER: [
    "properties:read",
    "properties:write",
    "tenants:read",
    "tenants:write",
    "payments:read",
    "payments:write",
    "payments:charge",
    "applications:read",
    "applications:write",
    "tickets:read",
    "tickets:write",
    "tickets:assign",
    "reports:read",
    "listings:read",
    "listings:write",
    "team:read",
    "leases:read",
    "leases:write",
    "expenses:read",
    "expenses:write",
    "leads:read",
    "leads:write",
    "payouts:approve",
  ],
  ACCOUNTING: [
    "properties:read",
    "tenants:read",
    "payments:read",
    "payments:write",
    "payments:charge",
    "reports:read",
    "leases:read",
    "expenses:read",
    "expenses:write",
    "leads:read",
  ],
  CARETAKER: [
    "properties:read",
    "tenants:read",
    "tickets:read",
    "tickets:write",
    "tickets:assign",
  ],
  SERVICE_TECH: [
    "tickets:read",
    "tickets:write",
  ],
};

export function getPermissions(role: TeamRole): string[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(role: TeamRole, permission: string): boolean {
  return getPermissions(role).includes(permission);
}

export function hasAnyPermission(role: TeamRole, permissions: string[]): boolean {
  const rolePerms = getPermissions(role);
  return permissions.some((p) => rolePerms.includes(p));
}

export const ROLE_LABELS: Record<TeamRole, string> = {
  MANAGER: "Manager",
  ACCOUNTING: "Accounting",
  CARETAKER: "Caretaker",
  SERVICE_TECH: "Service Tech",
};

import type { AdminRole } from "@prisma/client";

/**
 * All admin permissions, mapped to admin nav sections + actions.
 */
export const ADMIN_PERMISSIONS = [
  "admin:overview",
  "admin:landlords",
  "admin:tenants",
  "admin:properties",
  "admin:payments",
  "admin:payouts",
  "admin:leases",
  "admin:expenses",
  "admin:tickets",
  "admin:applications",
  "admin:volume",
  "admin:risk",
  "admin:insights",
  "admin:settings",
  "admin:staff",
  "admin:audit",
  "admin:leads",
  "admin:integrations",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

/**
 * Default permission sets per AdminRole.
 */
const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  SUPER_ADMIN: [...ADMIN_PERMISSIONS],
  PLATFORM_ADMIN: [
    "admin:overview",
    "admin:landlords",
    "admin:tenants",
    "admin:properties",
    "admin:payments",
    "admin:leases",
    "admin:tickets",
    "admin:applications",
    "admin:leads",
    "admin:audit",
  ],
  OPERATIONS_MANAGER: [
    "admin:overview",
    "admin:landlords",
    "admin:tenants",
    "admin:properties",
    "admin:payments",
    "admin:leases",
    "admin:expenses",
    "admin:tickets",
    "admin:applications",
    "admin:payouts",
    "admin:leads",
    "admin:insights",
  ],
  FINANCE_MANAGER: [
    "admin:overview",
    "admin:payments",
    "admin:leases",
    "admin:expenses",
    "admin:volume",
    "admin:risk",
    "admin:payouts",
  ],
  SUPPORT_AGENT: [
    "admin:overview",
    "admin:landlords",
    "admin:tenants",
    "admin:tickets",
    "admin:applications",
    "admin:leads",
  ],
  VIEWER: [
    "admin:overview",
    "admin:landlords",
    "admin:tenants",
    "admin:properties",
    "admin:payments",
    "admin:leases",
    "admin:expenses",
    "admin:tickets",
    "admin:applications",
    "admin:volume",
    "admin:insights",
  ],
};

/**
 * Get admin permissions for a role, or use custom overrides if provided.
 */
export function getAdminPermissions(role: AdminRole, customPermissions?: string[]): string[] {
  if (customPermissions && customPermissions.length > 0) {
    return customPermissions;
  }
  return ADMIN_ROLE_PERMISSIONS[role] ?? [];
}

export function hasAdminPermission(
  role: AdminRole,
  permission: string,
  customPermissions?: string[]
): boolean {
  return getAdminPermissions(role, customPermissions).includes(permission);
}

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: "Super Admin",
  PLATFORM_ADMIN: "Platform Admin",
  OPERATIONS_MANAGER: "Operations Manager",
  FINANCE_MANAGER: "Finance Manager",
  SUPPORT_AGENT: "Support Agent",
  VIEWER: "Viewer",
};

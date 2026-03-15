import { db } from "@/lib/db";
import { getAdminPermissions } from "@/lib/admin-permissions";
import type { AdminRole } from "@prisma/client";

export interface AdminContext {
  /** True if the user has an AdminStaff record (not the original owner) */
  isStaff: boolean;
  /** Admin role (null if original owner without AdminStaff record) */
  adminRole: AdminRole | null;
  /** Permission strings, or ["*"] for full access */
  permissions: string[];
}

/**
 * Resolve the admin context for a given admin user.
 * The original platform owner (no AdminStaff record) gets ["*"] full access.
 * SUPER_ADMIN staff members also get ["*"] full access.
 * Other admin staff get scoped permissions from their role.
 */
export async function getAdminContext(userId: string): Promise<AdminContext> {
  const staffRecord = await db.adminStaff.findUnique({
    where: { userId },
  });

  if (staffRecord && staffRecord.isActive) {
    // SUPER_ADMIN staff members also get full access
    if (staffRecord.adminRole === "SUPER_ADMIN") {
      return {
        isStaff: true,
        adminRole: "SUPER_ADMIN",
        permissions: ["*"],
      };
    }

    return {
      isStaff: true,
      adminRole: staffRecord.adminRole,
      permissions: getAdminPermissions(staffRecord.adminRole, staffRecord.customPermissions),
    };
  }

  // No AdminStaff record = original platform owner, full access
  return {
    isStaff: false,
    adminRole: null,
    permissions: ["*"],
  };
}

/**
 * Check if the admin context has a specific permission.
 * Owners and SUPER_ADMINs (permissions: ["*"]) always return true.
 */
export function canAdmin(ctx: AdminContext, permission: string): boolean {
  if (ctx.permissions.includes("*")) return true;
  return ctx.permissions.includes(permission);
}

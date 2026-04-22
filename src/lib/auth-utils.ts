import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { getAdminContext, canAdmin, type AdminContext } from "@/lib/admin-context";
import { validateImpersonationToken } from "@/lib/impersonation-session";
import type { Role } from "@prisma/client";

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Resolve the currently-active impersonation session for `actorId`, if any.
 *
 * The canonical source of truth is the DB-backed ImpersonationSession row
 * (token stored in the `impersonation_token` cookie). We used to trust the
 * legacy `impersonating` JSON cookie, which could go stale and leak one
 * tenant's data to a PM's view of a different tenant — see the Cindy /
 * Walter regression. The legacy cookie is now treated purely as a banner
 * hint for client components; no server-side access decisions rely on it.
 */
async function resolveImpersonation(actorId: string): Promise<
  | { targetUserId: string; targetRole: Role }
  | null
> {
  const cookieStore = await cookies();
  const token = cookieStore.get("impersonation_token")?.value;
  if (!token) return null;
  const session = await validateImpersonationToken(token);
  if (!session) return null;
  if (session.adminId !== actorId) {
    // Token belongs to a different actor — reject rather than trust cookie
    return null;
  }
  return {
    targetUserId: session.targetUserId,
    targetRole: session.targetRole as Role,
  };
}

export async function requireRole(role: Role) {
  const user = await requireAuth();

  // Impersonation paths all flow through the same canonical DB check.
  // This closes the stale-cookie leak where a PM who had impersonated
  // tenant A then impersonated tenant B could still see A's data if
  // the legacy `impersonating` cookie hadn't rolled over.
  const needsImpersonation =
    (role === "TENANT" && (user.role === "PM" || user.role === "ADMIN")) ||
    (role === "PM" && user.role === "ADMIN");

  if (needsImpersonation) {
    const imp = await resolveImpersonation(user.id);
    if (imp && imp.targetRole === role) {
      return { ...user, id: imp.targetUserId, role };
    }
  }

  // LANDLORD is a distinct role that shares PM's surface area. Any page that
  // requires "PM" also admits LANDLORD, and vice versa.
  if (
    (role === "PM" && user.role === "LANDLORD") ||
    (role === "LANDLORD" && user.role === "PM")
  ) {
    return user;
  }

  if (user.role !== role) redirect("/login");
  return user;
}

/**
 * Require the user to be an ADMIN with a specific admin-level permission.
 * SUPER_ADMIN and the original platform owner always pass.
 * Non-admin users are redirected to /login.
 * Staff without the required permission are redirected to /admin.
 */
export async function requireAdminPermission(permission: string): Promise<{
  user: { id: string; name: string; email: string; role: Role; image?: string | null };
  adminCtx: AdminContext;
}> {
  const user = await requireRole("ADMIN");
  const adminCtx = await getAdminContext(user.id);

  if (!canAdmin(adminCtx, permission)) {
    redirect("/admin");
  }

  return { user, adminCtx };
}

export async function requireAnyRole(...roles: Role[]) {
  const user = await requireAuth();
  if (!roles.includes(user.role)) redirect("/login");
  return user;
}

/**
 * Check if the current user has team-level access to a resource.
 * Returns the user if they are the landlord OR a team member with the required permission.
 * Optionally scopes to a specific property.
 */
export async function requireTeamAccess(
  landlordId: string,
  permission: string,
  propertyId?: string
) {
  const user = await requireAuth();

  // Landlord always has full access
  if (user.id === landlordId) return user;

  // Check team membership
  const membership = await db.teamMember.findUnique({
    where: {
      landlordId_userId: { landlordId, userId: user.id },
    },
  });

  if (!membership || !membership.isActive) {
    redirect("/login");
  }

  // Check permission for this role
  if (!hasPermission(membership.role, permission)) {
    redirect("/login");
  }

  // If property-scoped, check that the team member has access to this property
  if (propertyId && membership.propertyIds.length > 0) {
    if (!membership.propertyIds.includes(propertyId)) {
      redirect("/login");
    }
  }

  return user;
}

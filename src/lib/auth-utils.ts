import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
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

export async function requireRole(role: Role) {
  const user = await requireAuth();

  // Allow landlord impersonating a tenant
  if (role === "TENANT" && user.role === "LANDLORD") {
    const cookieStore = await cookies();
    const raw = cookieStore.get("impersonating")?.value;
    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (data.landlordId === user.id && data.tenantUserId) {
          // Return a user-like object with the tenant's userId
          return { ...user, id: data.tenantUserId, role: "TENANT" as Role };
        }
      } catch {
        // Invalid cookie
      }
    }
  }

  if (user.role !== role) redirect("/login");
  return user;
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

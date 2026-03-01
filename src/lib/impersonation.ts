import { cookies } from "next/headers";
import { Session } from "next-auth";

interface ImpersonationCookie {
  tenantId: string;
  tenantUserId: string;
  tenantName: string;
  landlordId: string;
  landlordName: string;
}

/**
 * Returns the effective userId for tenant data fetching.
 * If a landlord is impersonating a tenant, returns the tenant's userId.
 * Otherwise returns the session user's id (for actual tenants).
 */
export async function getEffectiveTenantUserId(
  session: Session
): Promise<string | null> {
  if (session.user.role === "TENANT") {
    return session.user.id;
  }

  if (session.user.role === "LANDLORD") {
    const cookieStore = await cookies();
    const raw = cookieStore.get("impersonating")?.value;
    if (raw) {
      try {
        const data: ImpersonationCookie = JSON.parse(raw);
        // Verify the landlord in the cookie matches the session
        if (data.landlordId === session.user.id && data.tenantUserId) {
          return data.tenantUserId;
        }
      } catch {
        // Invalid cookie
      }
    }
  }

  return null;
}

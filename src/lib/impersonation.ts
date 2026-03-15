import { cookies } from "next/headers";
import { Session } from "next-auth";
import { validateImpersonationToken } from "@/lib/impersonation-session";

/**
 * Returns the effective userId for tenant data fetching.
 * If a landlord is impersonating a tenant, returns the tenant's userId.
 * Otherwise returns the session user's id (for actual tenants).
 *
 * Uses server-side ImpersonationSession tokens, with legacy cookie fallback.
 */
export async function getEffectiveTenantUserId(
  session: Session
): Promise<string | null> {
  if (session.user.role === "TENANT") {
    return session.user.id;
  }

  const cookieStore = await cookies();

  // ─── New token-based impersonation ──────────────────────────
  const tokenCookie = cookieStore.get("impersonation_token")?.value;
  if (tokenCookie) {
    try {
      const impSession = await validateImpersonationToken(tokenCookie);
      if (impSession && impSession.targetRole === "TENANT") {
        return impSession.targetUserId;
      }
    } catch {
      // Fall through
    }
  }

  // ─── Legacy JSON cookie (backward compatibility) ────────────
  if (session.user.role === "PM") {
    const raw = cookieStore.get("impersonating")?.value;
    if (raw) {
      try {
        const data = JSON.parse(raw);
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

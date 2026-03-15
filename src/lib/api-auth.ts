/**
 * API route authentication helper that supports impersonation and API keys.
 *
 * Authentication priority:
 * 1. Session-based auth (NextAuth JWT)
 *    - With impersonation token (server-side)
 *    - With legacy impersonation cookie (backward compat)
 * 2. API key auth (Bearer token or x-api-key header)
 */
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { validateImpersonationToken } from "@/lib/impersonation-session";
import { extractApiKeyFromRequest, validateApiKey } from "@/lib/api-key-auth";
import type { Role } from "@prisma/client";

/**
 * Resolve API key authentication from a Request.
 * Returns a session-like object if a valid API key is found.
 */
export async function resolveApiKeySession(req: Request) {
  const rawKey = extractApiKeyFromRequest(req);
  if (!rawKey) return null;

  const apiKey = await validateApiKey(rawKey);
  if (!apiKey) return null;

  return {
    user: {
      id: apiKey.user.id,
      name: apiKey.user.name,
      email: apiKey.user.email,
      role: apiKey.user.role as Role,
    },
    apiKey: {
      id: apiKey.id,
      permissions: apiKey.permissions,
      rateLimitPerMinute: apiKey.rateLimitPerMinute,
    },
  };
}

/**
 * Returns the session with impersonation resolved.
 * Falls back to API key auth if no session exists.
 */
export async function resolveApiSession(req?: Request) {
  const session = await auth();
  if (!session?.user) {
    // No session — try API key auth if a request object is available
    if (req) {
      return resolveApiKeySession(req);
    }
    return session;
  }

  const cookieStore = await cookies();

  // ─── New token-based impersonation ──────────────────────────
  const tokenCookie = cookieStore.get("impersonation_token")?.value;
  if (tokenCookie) {
    try {
      const impSession = await validateImpersonationToken(tokenCookie);
      if (impSession) {
        return {
          ...session,
          user: {
            ...session.user,
            id: impSession.targetUserId,
            role: impSession.targetRole as Role,
          },
        };
      }
    } catch {
      // Token validation failed — fall through to normal session
    }
  }

  // ─── Legacy JSON cookie (backward compatibility) ────────────
  const user = session.user;
  const raw = cookieStore.get("impersonating")?.value;
  if (raw) {
    try {
      const data = JSON.parse(raw);

      if (user.role === "ADMIN") {
        if (data.type === "landlord" && data.adminId === user.id && data.landlordId) {
          return {
            ...session,
            user: { ...user, id: data.landlordId, role: "PM" as Role },
          };
        }
        if (data.type === "tenant" && data.adminId === user.id && data.tenantUserId) {
          return {
            ...session,
            user: { ...user, id: data.tenantUserId, role: "TENANT" as Role },
          };
        }
      }

      if (user.role === "PM") {
        if (data.landlordId === user.id && data.tenantUserId) {
          return {
            ...session,
            user: { ...user, id: data.tenantUserId, role: "TENANT" as Role },
          };
        }
      }
    } catch {
      // Invalid cookie
    }
  }

  return session;
}

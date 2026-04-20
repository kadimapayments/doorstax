import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { getEffectiveLandlordId } from "@/lib/team-context";

/**
 * Resolves the "effective landlord" for any API route that creates / mutates
 * PM-scoped data (properties, units, tenants, leases, expenses, etc.).
 *
 * Handles three cases:
 *   - Session user is PM / LANDLORD   → returns their own ID (or their
 *                                        team-owner's ID if they're a team
 *                                        member). Normal path.
 *   - Session user is ADMIN and has an active impersonation cookie with
 *     type="landlord"                 → returns the impersonated landlord's
 *                                        ID from the cookie.
 *   - Anything else                   → returns null; caller should 401.
 *
 * Rationale: server pages already unwrap this via `requireRole("PM")` in
 * auth-utils.ts. API routes historically did a raw `session.user.role !== "PM"`
 * check, which breaks admin impersonation because the admin's session role
 * is still "ADMIN" even while they're "viewing as PM". This helper brings
 * API routes in line with the server-page behavior.
 */
export async function resolveApiLandlord(): Promise<
  | { landlordId: string; actorId: string; actorRole: "PM" | "LANDLORD" | "ADMIN" }
  | null
> {
  const session = await auth();
  if (!session?.user) return null;

  const role = session.user.role;

  if (role === "PM" || role === "LANDLORD") {
    const landlordId = await getEffectiveLandlordId(session.user.id);
    return { landlordId, actorId: session.user.id, actorRole: role };
  }

  if (role === "ADMIN") {
    const cookieStore = await cookies();
    const raw = cookieStore.get("impersonating")?.value;
    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (
          data?.type === "landlord" &&
          data?.adminId === session.user.id &&
          typeof data?.landlordId === "string"
        ) {
          return {
            landlordId: data.landlordId,
            actorId: session.user.id,
            actorRole: "ADMIN",
          };
        }
      } catch {
        // Invalid cookie — fall through
      }
    }
  }

  return null;
}

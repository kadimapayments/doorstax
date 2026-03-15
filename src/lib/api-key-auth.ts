/**
 * API Key authentication for external developer access.
 *
 * Key format: dsx_live_<32 hex chars>
 * - Prefix "dsx_live_" stored plaintext for lookup
 * - Full key bcrypt-hashed for verification
 * - Permissions array intersected with user's RBAC role permissions
 */
import { db } from "@/lib/db";
import { hash, compare } from "bcryptjs";
import { randomBytes } from "crypto";

const KEY_PREFIX = "dsx_live_";
const KEY_BYTES = 32;
const BCRYPT_ROUNDS = 10;

/**
 * Generate a new API key for a user. Returns the full key (shown once).
 */
export async function generateApiKey(opts: {
  userId: string;
  name: string;
  permissions: string[];
  expiresAt?: Date;
  rateLimitPerMinute?: number;
}): Promise<{ id: string; fullKey: string }> {
  const rawKey = KEY_PREFIX + randomBytes(KEY_BYTES).toString("hex");
  const prefix = rawKey.slice(0, 12); // "dsx_live_XXX" for lookup
  const keyHash = await hash(rawKey, BCRYPT_ROUNDS);

  const apiKey = await db.apiKey.create({
    data: {
      userId: opts.userId,
      name: opts.name,
      keyHash,
      prefix,
      permissions: opts.permissions,
      expiresAt: opts.expiresAt ?? null,
      rateLimitPerMinute: opts.rateLimitPerMinute ?? 60,
    },
    select: { id: true },
  });

  return { id: apiKey.id, fullKey: rawKey };
}

/**
 * Validate an API key from the request.
 * Returns the ApiKey record (with user) if valid, null otherwise.
 */
export async function validateApiKey(rawKey: string) {
  if (!rawKey.startsWith(KEY_PREFIX)) return null;

  const prefix = rawKey.slice(0, 12);

  // Find candidates by prefix (non-revoked, non-expired)
  const candidates = await db.apiKey.findMany({
    where: {
      prefix,
      revokedAt: null,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  for (const candidate of candidates) {
    const match = await compare(rawKey, candidate.keyHash);
    if (match) {
      // Update last used timestamp (non-blocking)
      db.apiKey
        .update({
          where: { id: candidate.id },
          data: { lastUsedAt: new Date() },
        })
        .catch(() => {});

      return candidate;
    }
  }

  return null;
}

/**
 * Extract API key from request headers.
 * Checks: Authorization: Bearer dsx_live_... OR x-api-key: dsx_live_...
 */
export function extractApiKeyFromRequest(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer dsx_live_")) {
    return authHeader.slice(7); // Remove "Bearer "
  }

  const apiKeyHeader = req.headers.get("x-api-key");
  if (apiKeyHeader?.startsWith("dsx_live_")) {
    return apiKeyHeader;
  }

  return null;
}

/**
 * Check if an API key has a specific permission.
 */
export function hasApiKeyPermission(
  keyPermissions: string[],
  requiredPermission: string
): boolean {
  if (keyPermissions.includes("*")) return true;
  return keyPermissions.includes(requiredPermission);
}

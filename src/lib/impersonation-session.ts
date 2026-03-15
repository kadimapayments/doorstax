/**
 * Server-side impersonation session management.
 *
 * Replaces the previous JSON-cookie approach with a database-backed token.
 * Tokens are hashed with bcrypt and stored in ImpersonationSession.
 */
import { db } from "@/lib/db";
import { hash, compare } from "bcryptjs";
import { randomBytes } from "crypto";
import type { Role } from "@prisma/client";

const TOKEN_BYTES = 32;
const BCRYPT_ROUNDS = 10;
const SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hour

/**
 * Create a new impersonation session and return the raw token (shown once).
 */
export async function createImpersonationSession(opts: {
  adminId: string;
  targetUserId: string;
  targetRole: Role;
}): Promise<string> {
  const rawToken = randomBytes(TOKEN_BYTES).toString("hex");
  const tokenHash = await hash(rawToken, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.impersonationSession.create({
    data: {
      adminId: opts.adminId,
      targetUserId: opts.targetUserId,
      targetRole: opts.targetRole,
      tokenHash,
      expiresAt,
    },
  });

  return rawToken;
}

/**
 * Validate a raw impersonation token.
 * Returns the session if valid, null otherwise.
 */
export async function validateImpersonationToken(rawToken: string) {
  // Find non-expired, non-revoked sessions (search all recent — bcrypt compare needed)
  const candidates = await db.impersonationSession.findMany({
    where: {
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    take: 50, // Reasonable upper bound of active impersonation sessions
  });

  for (const session of candidates) {
    const match = await compare(rawToken, session.tokenHash);
    if (match) {
      return session;
    }
  }

  return null;
}

/**
 * Revoke an impersonation session by admin ID (revokes all active sessions).
 */
export async function revokeImpersonationSessions(adminId: string) {
  await db.impersonationSession.updateMany({
    where: { adminId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

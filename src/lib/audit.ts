import { db } from "@/lib/db";
import { getClientIp } from "@/lib/ip-check";
import type { Prisma } from "@prisma/client";

interface AuditEntry {
  userId?: string | null;
  userName?: string | null;
  userRole?: string | null;
  action: string; // CREATE, UPDATE, DELETE, APPROVE, PROCESS, REFUND, LOGIN, IMPERSONATE
  objectType: string; // Payment, Payout, Tenant, User, Lease, etc.
  objectId?: string | null;
  description?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  req?: Request; // For IP/UA extraction
}

/**
 * Write an audit log entry. Fire-and-forget — never throws.
 */
export async function auditLog(entry: AuditEntry) {
  try {
    await db.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        userName: entry.userName ?? null,
        userRole: entry.userRole ?? null,
        action: entry.action,
        objectType: entry.objectType,
        objectId: entry.objectId ?? null,
        description: entry.description ?? null,
        oldValue: (entry.oldValue as Prisma.InputJsonValue) ?? undefined,
        newValue: (entry.newValue as Prisma.InputJsonValue) ?? undefined,
        ipAddress: entry.req ? getClientIp(entry.req) : null,
        userAgent: entry.req?.headers.get("user-agent")?.slice(0, 256) ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] Failed to write audit log:", err);
    // Never let audit failures break the caller
  }
}

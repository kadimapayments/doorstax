import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { compare } from "bcryptjs";
import { authLimiter, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

/**
 * POST /api/auth/verify-password
 * Verifies the current user's password for session unlock.
 * Rate-limited to 10 requests per 60 seconds per IP.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await authLimiter.limit(ip);
  if (!rl.success) return rateLimitResponse(rl.reset);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { password } = await req.json();
    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        passwordHash: true,
        tempPasswordHash: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    let valid = await compare(password, user.passwordHash);

    // Fallback: accept temp password (consistent with login flow)
    if (!valid && user.tempPasswordHash) {
      valid = await compare(password, user.tempPasswordHash);
    }

    if (!valid) {
      auditLog({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: "UNLOCK_FAILED",
        objectType: "User",
        objectId: user.id,
        description: `Failed session unlock attempt (${user.email})`,
        req,
      });
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    auditLog({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "UNLOCK",
      objectType: "User",
      objectId: user.id,
      description: `Session unlocked (${user.email})`,
      req,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

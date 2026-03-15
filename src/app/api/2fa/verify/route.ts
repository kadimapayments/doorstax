import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { authLimiter, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

// Shared OTP store — in production, use Redis or DB
const otpStore = new Map<string, { code: string; expiresAt: number }>();

export async function POST(req: Request) {
  // ─── Rate Limiting (by IP) ──────────────────────────────────
  const rl = await authLimiter.limit(getClientIp(req));
  if (!rl.success) return rateLimitResponse(rl.reset);

  const session = await resolveApiSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code, phone } = await req.json();
  if (!code) {
    return NextResponse.json({ error: "Code required" }, { status: 400 });
  }

  const stored = otpStore.get(session.user.id);
  if (!stored || stored.expiresAt < Date.now()) {
    return NextResponse.json({ error: "Code expired or not found" }, { status: 400 });
  }

  if (stored.code !== code) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  // Clear the used code
  otpStore.delete(session.user.id);

  // Enable 2FA if phone was provided (setup flow)
  if (phone) {
    await db.user.update({
      where: { id: session.user.id },
      data: { twoFactorEnabled: true, twoFactorPhone: phone },
    });
  }

  return NextResponse.json({ success: true, verified: true });
}

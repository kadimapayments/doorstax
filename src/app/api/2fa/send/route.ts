import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { authLimiter, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

// In-memory OTP store (replace with Redis/DB in production)
const otpStore = new Map<string, { code: string; expiresAt: number }>();

export async function POST(req: Request) {
  // ─── Rate Limiting (by IP) ──────────────────────────────────
  const rl = await authLimiter.limit(getClientIp(req));
  if (!rl.success) return rateLimitResponse(rl.reset);

  const session = await resolveApiSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { phone } = await req.json();
  if (!phone) {
    return NextResponse.json({ error: "Phone number required" }, { status: 400 });
  }

  // Generate 6-digit code
  const code = String(Math.floor(100000 + Math.random() * 900000));
  otpStore.set(session.user.id, {
    code,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  });

  // TODO: Integrate Twilio/SMS provider to actually send the code
  if (process.env.NODE_ENV === "development") {
    console.log(`[2FA] Code for ${session.user.email}: ${code}`);
  }

  return NextResponse.json({ success: true, message: "Verification code sent" });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomBytes, createHash } from "crypto";
import { getResend } from "@/lib/email";
import { passwordResetHtml } from "@/lib/emails/password-reset";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";

/**
 * POST /api/auth/forgot-password
 *
 * Generates a password reset token and emails a reset link.
 * Always returns 200 to prevent email enumeration.
 *
 * Body: { email }
 */
export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const user = await db.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });

    if (user) {
      // Invalidate any existing unused tokens for this user
      await db.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      // Generate new token
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");

      await db.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });

      const resetUrl = `${BASE_URL}/reset-password?token=${rawToken}`;

      try {
        const resend = getResend();
        await resend.emails.send({
          from: "DoorStax <notifications@doorstax.com>",
          to: user.email,
          subject: "Reset Your DoorStax Password",
          html: passwordResetHtml({ name: user.name, resetUrl }),
        });
      } catch (err) {
        console.error("[forgot-password] Failed to send email:", err);
      }
    }

    // Always return success (prevents email enumeration)
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[forgot-password] Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

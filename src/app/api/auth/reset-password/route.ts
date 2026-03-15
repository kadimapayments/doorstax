import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hash } from "bcryptjs";
import { createHash } from "crypto";
import { resetPasswordSchema } from "@/lib/validations/user";
import { z } from "zod";

/**
 * POST /api/auth/reset-password
 *
 * Verifies a password reset token and sets a new password.
 *
 * Body: { token, password, confirmPassword }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { token, password } = parsed.data;
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const resetToken = await db.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invalid or expired reset link. Please request a new one." },
        { status: 400 }
      );
    }

    const newHash = await hash(password, 12);

    await db.$transaction([
      db.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: newHash },
      }),
      db.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("[reset-password] Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

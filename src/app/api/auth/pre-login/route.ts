import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { compare } from "bcryptjs";
import { createHash } from "crypto";
import { getResend } from "@/lib/email";
import { twoFactorCodeHtml } from "@/lib/emails/two-factor-code";

/**
 * POST /api/auth/pre-login
 *
 * Validates credentials. If the user has 2FA enabled, generates a 6-digit
 * code, stores a SHA-256 hash on the User row, and emails the code.
 *
 * Body: { email, password }
 * Response:
 *   - { requires2fa: false }          → credentials valid, no 2FA
 *   - { requires2fa: true, maskedEmail } → code sent, client must collect code
 *   - 401 { error }                   → invalid credentials
 */
export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Generic error (don't reveal whether user exists)
    const genericError = { error: "Invalid email or password" };

    const user = await db.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (!user) {
      return NextResponse.json(genericError, { status: 401 });
    }

    const valid = await compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(genericError, { status: 401 });
    }

    // No 2FA → done
    if (!user.twoFactorEnabled) {
      return NextResponse.json({ requires2fa: false });
    }

    // ── Generate & store 2FA code ──
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const hashedCode = createHash("sha256").update(code).digest("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.user.update({
      where: { id: user.id },
      data: { twoFactorCode: hashedCode, twoFactorCodeExp: expiresAt },
    });

    // ── Send code via email ──
    try {
      const resend = getResend();
      await resend.emails.send({
        from: "DoorStax <notifications@doorstax.com>",
        to: user.email,
        subject: "Your DoorStax Verification Code",
        html: twoFactorCodeHtml({ name: user.name, code }),
      });
    } catch (err) {
      console.error("[pre-login] Failed to send 2FA email:", err);
      // Still return requires2fa so the user can retry
    }

    // Mask the email for the UI
    const [local, domain] = user.email.split("@");
    const maskedEmail =
      local.length <= 2
        ? `${local[0]}*@${domain}`
        : `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;

    return NextResponse.json({ requires2fa: true, maskedEmail });
  } catch (error) {
    console.error("[pre-login] Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

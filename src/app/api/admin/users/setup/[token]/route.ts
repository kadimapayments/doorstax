export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";

/**
 * GET  /api/admin/users/setup/[token] — look up the token, return the target
 *                                        user shell (email, name, role).
 * POST /api/admin/users/setup/[token] — consume the token; accept a password
 *                                        + TOS/privacy checkboxes, set the
 *                                        user's password, mark token used.
 *
 * This is intentionally a public endpoint (no auth gate) because its entire
 * purpose is to let a not-yet-logged-in user finish their account setup via
 * an emailed link. Security lives in: (a) token randomness, (b) 7-day
 * expiry, (c) single-use via usedAt.
 */

async function resolveToken(token: string) {
  const row = await db.userSetupToken.findUnique({
    where: { token },
    include: {
      user: { select: { id: true, email: true, name: true, role: true } },
    },
  });
  if (!row) return { error: "Invalid setup link", status: 404 as const };
  if (row.usedAt) return { error: "This setup link has already been used", status: 410 as const };
  if (row.expiresAt < new Date())
    return { error: "This setup link has expired. Ask the admin for a fresh one.", status: 410 as const };
  return { row };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const res = await resolveToken(token);
  if ("error" in res) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json({
    user: {
      email: res.row.user.email,
      name: res.row.user.name,
      role: res.row.user.role,
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const res = await resolveToken(token);
  if ("error" in res) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const body = (await req.json().catch(() => ({}))) as {
    password?: string;
    acceptTOS?: boolean;
    acceptPrivacy?: boolean;
  };

  if (!body.password || body.password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }
  if (!body.acceptTOS || !body.acceptPrivacy) {
    return NextResponse.json(
      { error: "You must accept the Terms of Service and Privacy Policy" },
      { status: 400 }
    );
  }

  const passwordHash = await hash(body.password, 12);

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: res.row.user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        tosAcceptedAt: new Date(),
        privacyAcceptedAt: new Date(),
      },
    });
    await tx.userSetupToken.update({
      where: { id: res.row.id },
      data: { usedAt: new Date() },
    });
  });

  return NextResponse.json({
    success: true,
    email: res.row.user.email,
  });
}

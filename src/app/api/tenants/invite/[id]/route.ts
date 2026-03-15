import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateInviteToken, hashToken } from "@/lib/invite-tokens";
import { getResend } from "@/lib/email";
import { tenantInviteHtml } from "@/lib/emails/tenant-invite";

interface Ctx {
  params: Promise<{ id: string }>;
}

/* ── POST: resend invite (regenerate token, reset expiry, re-send email) ── */

export async function POST(_req: Request, context: Ctx) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const invite = await db.tenantInvite.findFirst({
    where: { id, landlordId: session.user.id },
    include: {
      unit: {
        select: {
          unitNumber: true,
          property: { select: { name: true } },
        },
      },
    },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (invite.acceptedAt) {
    return NextResponse.json({ error: "Invite already accepted" }, { status: 409 });
  }

  // Regenerate token + extend expiry
  const rawToken = generateInviteToken();
  const tokenHash = await hashToken(rawToken);

  await db.tenantInvite.update({
    where: { id },
    data: {
      tokenHash,
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    },
  });

  // Build invite URL + re-send email
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const inviteUrl = `${baseUrl}/invite/${rawToken}`;

  try {
    await getResend().emails.send({
      from: "DoorStax <notifications@doorstax.com>",
      to: invite.email,
      subject: `Reminder: You're invited to join ${invite.unit.property.name} on DoorStax`,
      html: tenantInviteHtml({
        propertyName: invite.unit.property.name,
        unitName: invite.unit.unitNumber,
        inviteUrl,
        landlordName: session.user.name || "Your Property Manager",
        tenantName: invite.name || undefined,
      }),
    });
  } catch (emailErr) {
    console.error("[invite-resend] Email send failed:", emailErr);
  }

  return NextResponse.json({ success: true });
}

/* ── DELETE: revoke/cancel invite ──────────────────── */

export async function DELETE(_req: Request, context: Ctx) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const invite = await db.tenantInvite.findFirst({
    where: { id, landlordId: session.user.id },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  await db.tenantInvite.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

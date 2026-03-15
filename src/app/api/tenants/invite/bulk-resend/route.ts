import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { generateInviteToken, hashToken } from "@/lib/invite-tokens";
import { getResend } from "@/lib/email";
import { tenantInviteHtml } from "@/lib/emails/tenant-invite";

/**
 * POST /api/tenants/invite/bulk-resend
 * Body: { inviteIds: string[] }
 *
 * Regenerates invite tokens and resends emails for expired or pending invites.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const { inviteIds } = (await req.json()) as { inviteIds: string[] };

  if (!Array.isArray(inviteIds) || inviteIds.length === 0) {
    return NextResponse.json({ error: "No invite IDs provided" }, { status: 400 });
  }

  if (inviteIds.length > 50) {
    return NextResponse.json(
      { error: "Maximum 50 re-invites at once" },
      { status: 400 }
    );
  }

  // Fetch the invites (must belong to this landlord)
  const invites = await db.tenantInvite.findMany({
    where: {
      id: { in: inviteIds },
      landlordId,
      acceptedAt: null, // only re-invite unaccepted
    },
    include: {
      unit: {
        select: {
          unitNumber: true,
          property: { select: { name: true } },
        },
      },
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || "https://sandbox.doorstax.com";
  const resend = getResend();
  let resent = 0;
  const errors: { inviteId: string; message: string }[] = [];

  for (const invite of invites) {
    try {
      // Generate new token
      const rawToken = generateInviteToken();
      const hashed = await hashToken(rawToken);

      // Update invite with new token and extended expiration
      await db.tenantInvite.update({
        where: { id: invite.id },
        data: {
          tokenHash: hashed,
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        },
      });

      // Send email
      const inviteUrl = `${baseUrl}/invite/${rawToken}`;
      const html = tenantInviteHtml({
        propertyName: invite.unit?.property?.name || "Your Property",
        unitName: invite.unit?.unitNumber || "—",
        inviteUrl,
        landlordName: session.user.name || "Your Property Manager",
        tenantName: invite.name || undefined,
      });

      await resend.emails.send({
        from: "DoorStax <noreply@doorstax.com>",
        to: invite.email,
        subject: "You're Invited to DoorStax — Set Up Your Tenant Portal",
        html,
      });

      resent++;
    } catch (err) {
      errors.push({
        inviteId: invite.id,
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    success: true,
    resent,
    skipped: inviteIds.length - invites.length,
    errors,
  });
}

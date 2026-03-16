import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateInviteToken, hashToken } from "@/lib/invite-tokens";
import { z } from "zod";
import { getResend } from "@/lib/email";
import { tenantInviteHtml } from "@/lib/emails/tenant-invite";
import { completeOnboardingMilestone } from "@/lib/onboarding";

/* ── GET: list all invites for the PM's properties ──── */

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invites = await db.tenantInvite.findMany({
    where: { landlordId: session.user.id },
    include: {
      unit: {
        select: {
          unitNumber: true,
          property: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const rows = invites.map((inv) => ({
    id: inv.id,
    name: inv.name || null,
    email: inv.email,
    property: inv.unit.property.name,
    unit: inv.unit.unitNumber,
    status: inv.acceptedAt
      ? "accepted"
      : inv.expiresAt < now
      ? "expired"
      : "pending",
    createdAt: inv.createdAt.toISOString(),
    expiresAt: inv.expiresAt.toISOString(),
    acceptedAt: inv.acceptedAt?.toISOString() || null,
  }));

  return NextResponse.json(rows);
}

/* ── POST: create a new invite ─────────────────────── */

const lineItemSchema = z.object({
  description: z.string().min(1),
  amount: z.number().min(0),
  type: z.enum(["RENT", "DEPOSIT", "FEE", "APPLICATION"]),
});

const inviteSchema = z.object({
  name: z.string().min(1, "Full name is required"),
  email: z.string().email("Valid email required"),
  unitId: z.string().min(1, "Unit is required"),
  leaseStart: z.string().optional(),
  leaseEnd: z.string().optional(),
  lineItems: z.array(lineItemSchema).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = inviteSchema.parse(body);

    // Verify landlord owns the unit
    const unit = await db.unit.findFirst({
      where: {
        id: data.unitId,
        property: { landlordId: session.user.id },
      },
      include: { property: { select: { name: true } } },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Check if email already has a pending invite for this unit
    const existingInvite = await db.tenantInvite.findFirst({
      where: {
        email: data.email,
        unitId: data.unitId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: "An active invite already exists for this email and unit" },
        { status: 409 }
      );
    }

    // Generate secure token
    const rawToken = generateInviteToken();
    const tokenHash = await hashToken(rawToken);

    // Create invite (72-hour expiration)
    const invite = await db.tenantInvite.create({
      data: {
        landlordId: session.user.id,
        unitId: data.unitId,
        name: data.name,
        email: data.email,
        tokenHash,
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        ...(data.lineItems && data.lineItems.length > 0
          ? { initialCharges: data.lineItems }
          : {}),
      },
    });

    // Build invite URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteUrl = `${baseUrl}/invite/${rawToken}`;

    // Send invitation email
    try {
      await getResend().emails.send({
        from: "DoorStax <notifications@doorstax.com>",
        to: data.email,
        subject: `You're invited to join ${unit.property.name} on DoorStax`,
        html: tenantInviteHtml({
          propertyName: unit.property.name,
          unitName: unit.unitNumber,
          inviteUrl,
          landlordName: session.user.name || "Your Property Manager",
          tenantName: data.name,
        }),
      });
    } catch (emailErr) {
      console.error("[invite] Email send failed:", emailErr);
    }

    // Guided Launch Mode: mark invite milestone
    completeOnboardingMilestone(session.user.id, "inviteSent").catch(console.error);

    return NextResponse.json(
      {
        success: true,
        inviteId: invite.id,
        // Only include inviteUrl in development
        ...(process.env.NODE_ENV === "development" && { inviteUrl }),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

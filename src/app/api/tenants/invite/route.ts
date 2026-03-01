import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateInviteToken, hashToken } from "@/lib/invite-tokens";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email("Valid email required"),
  unitId: z.string().min(1, "Unit is required"),
  leaseStart: z.string().optional(),
  leaseEnd: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "LANDLORD") {
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
        email: data.email,
        tokenHash,
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      },
    });

    // Build invite URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteUrl = `${baseUrl}/invite/${rawToken}`;

    // TODO: Send email with inviteUrl via email service
    // For now, return the URL for development
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

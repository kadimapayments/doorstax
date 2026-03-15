import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateInviteToken, hashToken } from "@/lib/invite-tokens";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email("Valid email required"),
  perUnitCost: z.number().min(0, "Per-unit cost must be non-negative"),
  cardRateOverride: z.number().min(0).max(1).optional(),
  achRateOverride: z.number().min(0).optional(),
  commissionRate: z.number().min(0).max(1, "Commission rate must be between 0 and 1"),
  residualSplit: z.number().min(0).max(1, "Residual split must be between 0 and 1"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = inviteSchema.parse(body);

    // Check if there's already a pending invite for this email from this PM
    const existingInvite = await db.agentInvite.findFirst({
      where: {
        parentPmId: session.user.id,
        email: data.email,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: "An active invite already exists for this email" },
        { status: 409 }
      );
    }

    // Check if agent relationship already exists
    const existingAgent = await db.user.findUnique({
      where: { email: data.email },
    });

    if (existingAgent) {
      const existingRelation = await db.agentRelationship.findUnique({
        where: { agentUserId: existingAgent.id },
      });
      if (existingRelation) {
        return NextResponse.json(
          { error: "This user is already an agent" },
          { status: 409 }
        );
      }
    }

    // Generate secure token
    const rawToken = generateInviteToken();
    const tokenHash = await hashToken(rawToken);

    // Create invite (7-day expiration)
    await db.agentInvite.create({
      data: {
        parentPmId: session.user.id,
        email: data.email,
        tokenHash,
        perUnitCost: data.perUnitCost,
        cardRateOverride: data.cardRateOverride ?? null,
        achRateOverride: data.achRateOverride ?? null,
        commissionRate: data.commissionRate,
        residualSplit: data.residualSplit,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Build invite URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteUrl = `${baseUrl}/register?invite=${rawToken}`;

    return NextResponse.json(
      { success: true, inviteUrl },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("POST /api/agents/invite error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

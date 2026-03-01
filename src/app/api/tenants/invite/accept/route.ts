import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/invite-tokens";
import { z } from "zod";

const acceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1, "Name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = acceptSchema.parse(body);

    // Find all non-expired, non-accepted invites and check token
    const invites = await db.tenantInvite.findMany({
      where: {
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        unit: { select: { id: true, rentAmount: true, dueDay: true } },
      },
    });

    let matchedInvite = null;
    for (const invite of invites) {
      const isValid = await verifyToken(data.token, invite.tokenHash);
      if (isValid) {
        matchedInvite = invite;
        break;
      }
    }

    if (!matchedInvite) {
      return NextResponse.json(
        { error: "Invalid or expired invitation" },
        { status: 400 }
      );
    }

    // Check if user with this email already exists
    const existingUser = await db.user.findUnique({
      where: { email: matchedInvite.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in." },
        { status: 409 }
      );
    }

    const passwordHash = await hash(data.password, 12);

    // Create user + tenant profile + mark invite accepted + update unit status
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: matchedInvite.email,
          name: data.name,
          passwordHash,
          role: "TENANT",
          phone: data.phone,
        },
      });

      await tx.tenantProfile.create({
        data: {
          userId: user.id,
          unitId: matchedInvite.unitId,
        },
      });

      await tx.tenantInvite.update({
        where: { id: matchedInvite.id },
        data: { acceptedAt: new Date() },
      });

      await tx.unit.update({
        where: { id: matchedInvite.unitId },
        data: { status: "OCCUPIED" },
      });
    });

    return NextResponse.json({ success: true });
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

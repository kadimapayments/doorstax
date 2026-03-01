import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { inviteTeamMemberSchema } from "@/lib/validations/team";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "LANDLORD") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const members = await db.teamMember.findMany({
    where: { landlordId: session.user.id },
    include: {
      user: { select: { name: true, email: true, phone: true } },
    },
    orderBy: { invitedAt: "desc" },
  });

  return NextResponse.json(members);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "LANDLORD") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = inviteTeamMemberSchema.parse(body);

    // Find user by email
    const invitee = await db.user.findUnique({
      where: { email: data.email },
    });

    if (!invitee) {
      return NextResponse.json(
        { error: "No user found with that email. They must register first." },
        { status: 404 }
      );
    }

    if (invitee.id === session.user.id) {
      return NextResponse.json(
        { error: "You cannot add yourself as a team member" },
        { status: 400 }
      );
    }

    // Check for existing membership
    const existing = await db.teamMember.findUnique({
      where: {
        landlordId_userId: {
          landlordId: session.user.id,
          userId: invitee.id,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "This user is already on your team" },
        { status: 409 }
      );
    }

    const member = await db.teamMember.create({
      data: {
        landlordId: session.user.id,
        userId: invitee.id,
        role: data.role,
        propertyIds: data.propertyIds,
      },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json(member, { status: 201 });
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

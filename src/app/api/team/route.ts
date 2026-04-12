import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { inviteTeamMemberSchema } from "@/lib/validations/team";
import { ROLE_PRESETS } from "@/lib/team/role-presets";
import { ROLE_LABELS } from "@/lib/permissions";
import { z } from "zod";
import type { TeamRole } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const members = await db.teamMember.findMany({
    where: { landlordId: session.user.id },
    include: {
      user: { select: { name: true, email: true, phone: true } },
    },
    orderBy: [{ status: "asc" }, { invitedAt: "desc" }],
  });

  // Resolve property names for each member
  const allPropIds = [...new Set(members.flatMap((m) => m.propertyIds))];
  const properties =
    allPropIds.length > 0
      ? await db.property.findMany({
          where: { id: { in: allPropIds } },
          select: { id: true, name: true },
        })
      : [];
  const propMap = new Map(properties.map((p) => [p.id, p.name]));

  const rows = members.map((m) => ({
    id: m.id,
    email: m.email || m.user?.email || "",
    name: m.name || m.user?.name || "",
    role: m.role,
    roleLabel: ROLE_LABELS[m.role as TeamRole] || m.role,
    status: m.status,
    isActive: m.isActive,
    propertyIds: m.propertyIds,
    propertyNames: m.propertyIds.map((id) => propMap.get(id) || id),
    invitedAt: m.invitedAt.toISOString(),
    acceptedAt: m.acceptedAt?.toISOString() ?? null,
    deactivatedAt: m.deactivatedAt?.toISOString() ?? null,
    notes: m.notes,
    canViewFinancials: m.canViewFinancials,
    canManagePayments: m.canManagePayments,
    canManageTenants: m.canManageTenants,
    canManageUnits: m.canManageUnits,
    canManageLeases: m.canManageLeases,
    canManageMaintenance: m.canManageMaintenance,
    canManageApplications: m.canManageApplications,
    canViewReports: m.canViewReports,
    canManageSettings: m.canManageSettings,
  }));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = inviteTeamMemberSchema.parse(body);

    // Check for duplicate invite by email
    const existing = await db.teamMember.findFirst({
      where: {
        landlordId: session.user.id,
        email: data.email.toLowerCase(),
        status: { not: "DEACTIVATED" },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "This email is already on your team" },
        { status: 409 }
      );
    }

    // Self-invite guard
    if (data.email.toLowerCase() === session.user.email?.toLowerCase()) {
      return NextResponse.json(
        { error: "You cannot add yourself as a team member" },
        { status: 400 }
      );
    }

    // Look up user by email (may not exist yet)
    const invitee = await db.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    // Resolve permission defaults from role preset if none specified
    const preset = ROLE_PRESETS[data.role]?.permissions ?? {};

    const member = await db.teamMember.create({
      data: {
        landlordId: session.user.id,
        userId: invitee?.id ?? null,
        email: data.email.toLowerCase(),
        name: data.name || invitee?.name || null,
        role: data.role as TeamRole,
        status: invitee ? "ACTIVE" : "INVITED",
        isActive: !!invitee,
        acceptedAt: invitee ? new Date() : null,
        propertyIds: data.propertyIds,
        notes: data.notes || null,
        canViewFinancials:
          data.canViewFinancials ?? preset.canViewFinancials ?? false,
        canManagePayments:
          data.canManagePayments ?? preset.canManagePayments ?? false,
        canManageTenants:
          data.canManageTenants ?? preset.canManageTenants ?? true,
        canManageUnits:
          data.canManageUnits ?? preset.canManageUnits ?? true,
        canManageLeases:
          data.canManageLeases ?? preset.canManageLeases ?? true,
        canManageMaintenance:
          data.canManageMaintenance ?? preset.canManageMaintenance ?? true,
        canManageApplications:
          data.canManageApplications ?? preset.canManageApplications ?? false,
        canViewReports:
          data.canViewReports ?? preset.canViewReports ?? false,
        canManageSettings:
          data.canManageSettings ?? preset.canManageSettings ?? false,
      },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    // Send invitation email
    try {
      const { getResend } = await import("@/lib/email");
      const { teamInviteEmail } = await import("@/lib/emails/team-invite");
      const roleLabel =
        ROLE_LABELS[data.role as TeamRole] || data.role;
      const propertyNames =
        data.propertyIds.length > 0
          ? await db.property
              .findMany({
                where: { id: { in: data.propertyIds } },
                select: { name: true },
              })
              .then((ps) => ps.map((p) => p.name))
          : undefined;

      await getResend().emails.send({
        from: "DoorStax <noreply@doorstax.com>",
        to: data.email,
        subject: `You've been invited to join a team on DoorStax`,
        html: teamInviteEmail({
          recipientName: data.name || undefined,
          pmName: session.user.name || "A Property Manager",
          role: roleLabel,
          propertyNames,
        }),
      });
    } catch (err) {
      console.error("[team/invite] Email failed:", err);
    }

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("[team] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

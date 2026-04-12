import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateTeamMemberSchema } from "@/lib/validations/team";
import { z } from "zod";
import type { TeamRole } from "@prisma/client";

async function verifyOwnership(id: string, pmUserId: string) {
  return db.teamMember.findFirst({
    where: { id, landlordId: pmUserId },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const member = await db.teamMember.findFirst({
    where: { id, landlordId: session.user.id },
    include: { user: { select: { name: true, email: true, phone: true } } },
  });
  if (!member) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(member);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await verifyOwnership(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const data = updateTeamMemberSchema.parse(body);

    const updated = await db.teamMember.update({
      where: { id },
      data: {
        ...(data.role !== undefined && { role: data.role as TeamRole }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.propertyIds !== undefined && {
          propertyIds: data.propertyIds,
        }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.canViewFinancials !== undefined && {
          canViewFinancials: data.canViewFinancials,
        }),
        ...(data.canManagePayments !== undefined && {
          canManagePayments: data.canManagePayments,
        }),
        ...(data.canManageTenants !== undefined && {
          canManageTenants: data.canManageTenants,
        }),
        ...(data.canManageUnits !== undefined && {
          canManageUnits: data.canManageUnits,
        }),
        ...(data.canManageLeases !== undefined && {
          canManageLeases: data.canManageLeases,
        }),
        ...(data.canManageMaintenance !== undefined && {
          canManageMaintenance: data.canManageMaintenance,
        }),
        ...(data.canManageApplications !== undefined && {
          canManageApplications: data.canManageApplications,
        }),
        ...(data.canViewReports !== undefined && {
          canViewReports: data.canViewReports,
        }),
        ...(data.canManageSettings !== undefined && {
          canManageSettings: data.canManageSettings,
        }),
      },
    });

    return NextResponse.json(updated);
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await verifyOwnership(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "deactivate") {
    await db.teamMember.update({
      where: { id },
      data: {
        status: "DEACTIVATED",
        isActive: false,
        deactivatedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "reactivate") {
    await db.teamMember.update({
      where: { id },
      data: {
        status: existing.userId ? "ACTIVE" : "INVITED",
        isActive: !!existing.userId,
        deactivatedAt: null,
      },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await verifyOwnership(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.teamMember.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

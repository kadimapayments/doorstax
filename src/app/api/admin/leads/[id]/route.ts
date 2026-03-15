import { NextRequest, NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminPermission("admin:leads");
    const { id } = await params;

    const lead = await db.lead.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        activities: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json(lead);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAdminPermission("admin:leads");
    const { id } = await params;

    const existing = await db.lead.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      status,
      assignedToId,
      notes,
      name,
      email,
      phone,
      company,
      buildings,
      units,
      customFields,
    } = body;

    // Build update data with only provided fields
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone.replace(/\D/g, "").slice(0, 10);
    if (company !== undefined) data.company = company;
    if (buildings !== undefined) data.buildings = buildings ? parseInt(buildings) : null;
    if (units !== undefined) data.units = units ? parseInt(units) : null;
    if (notes !== undefined) data.notes = notes;
    if (status !== undefined) data.status = status;
    if (assignedToId !== undefined) data.assignedToId = assignedToId || null;
    if (customFields !== undefined) data.customFields = customFields;

    const updated = await db.lead.update({
      where: { id },
      data,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        _count: { select: { activities: true } },
      },
    });

    // Log status change activity
    if (status !== undefined && status !== existing.status) {
      await db.leadActivity.create({
        data: {
          leadId: id,
          userId: user.id,
          type: "status_change",
          content: `Status changed from ${existing.status} to ${status}`,
          metadata: { oldStatus: existing.status, newStatus: status },
        },
      });
    }

    // Log assignment change activity
    if (assignedToId !== undefined && assignedToId !== existing.assignedToId) {
      const assignee = assignedToId
        ? await db.user.findUnique({ where: { id: assignedToId }, select: { name: true } })
        : null;
      await db.leadActivity.create({
        data: {
          leadId: id,
          userId: user.id,
          type: "assigned",
          content: assignee
            ? `Lead assigned to ${assignee.name}`
            : "Lead unassigned",
          metadata: {
            oldAssignedToId: existing.assignedToId,
            newAssignedToId: assignedToId || null,
          },
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/admin/leads/[id] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminPermission("admin:leads");
    const { id } = await params;

    const existing = await db.lead.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Activities cascade-delete via the schema onDelete: Cascade
    await db.lead.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission("admin:leads");

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const source = searchParams.get("source");
    const assignedToId = searchParams.get("assignedToId");
    const search = searchParams.get("search");

    const where: Prisma.LeadWhereInput = {};

    if (status) where.status = status as Prisma.EnumLeadStatusFilter["equals"];
    if (source) where.source = source as Prisma.EnumLeadSourceFilter["equals"];
    if (assignedToId) where.assignedToId = assignedToId;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
        { phone: { contains: search.replace(/\D/g, "") } },
      ];
    }

    const leads = await db.lead.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        _count: { select: { activities: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(leads);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAdminPermission("admin:leads");

    const body = await req.json();
    const { name, email, phone, company, buildings, units, source, assignedToId, notes } = body;

    if (!name || !email || !company) {
      return NextResponse.json(
        { error: "Name, email, and company are required" },
        { status: 400 }
      );
    }

    const lead = await db.lead.create({
      data: {
        name,
        email,
        phone: phone ? phone.replace(/\D/g, "").slice(0, 10) : "",
        company,
        buildings: buildings ? parseInt(buildings) : null,
        units: units ? parseInt(units) : null,
        source: source || "MANUAL",
        assignedToId: assignedToId || null,
        notes: notes || null,
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        _count: { select: { activities: true } },
      },
    });

    // Log creation activity
    await db.leadActivity.create({
      data: {
        leadId: lead.id,
        userId: user.id,
        type: "note",
        content: "Lead created manually",
      },
    });

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/leads error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createTicketSchema } from "@/lib/validations/ticket";
import { z } from "zod";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  if (session.user.role === "TENANT") {
    const tenant = await db.tenantProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!tenant) {
      return NextResponse.json([]);
    }

    const tickets = await db.serviceTicket.findMany({
      where: {
        tenantId: tenant.id,
        ...(status ? { status: status as never } : {}),
      },
      include: {
        unit: { select: { unitNumber: true, property: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(tickets);
  }

  if (session.user.role === "LANDLORD") {
    const tickets = await db.serviceTicket.findMany({
      where: {
        landlordId: session.user.id,
        ...(status ? { status: status as never } : {}),
      },
      include: {
        tenant: { include: { user: { select: { name: true } } } },
        unit: { select: { unitNumber: true, property: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(tickets);
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = createTicketSchema.parse(body);
    const images: string[] = body.images || [];

    if (session.user.role === "TENANT") {
      const tenant = await db.tenantProfile.findUnique({
        where: { userId: session.user.id },
        include: { unit: { include: { property: true } } },
      });

      if (!tenant || !tenant.unit) {
        return NextResponse.json(
          { error: "No unit assigned" },
          { status: 400 }
        );
      }

      const ticket = await db.serviceTicket.create({
        data: {
          tenantId: tenant.id,
          unitId: tenant.unit.id,
          landlordId: tenant.unit.property.landlordId,
          title: data.title,
          description: data.description,
          category: data.category,
          priority: data.priority,
          images,
          createdById: session.user.id,
        },
      });

      return NextResponse.json(ticket, { status: 201 });
    }

    if (session.user.role === "LANDLORD") {
      // Landlord creates ticket on behalf of tenant
      const tenantId = body.tenantId;
      const unitId = body.unitId;

      if (!tenantId || !unitId) {
        return NextResponse.json(
          { error: "tenantId and unitId are required" },
          { status: 400 }
        );
      }

      // Verify landlord owns the unit
      const unit = await db.unit.findFirst({
        where: { id: unitId, property: { landlordId: session.user.id } },
      });

      if (!unit) {
        return NextResponse.json({ error: "Unit not found" }, { status: 404 });
      }

      const ticket = await db.serviceTicket.create({
        data: {
          tenantId,
          unitId,
          landlordId: session.user.id,
          title: data.title,
          description: data.description,
          category: data.category,
          priority: data.priority,
          images,
          createdById: session.user.id,
        },
      });

      return NextResponse.json(ticket, { status: 201 });
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Ticket creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

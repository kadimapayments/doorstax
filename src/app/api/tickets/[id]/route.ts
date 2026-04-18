import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateTicketSchema, ticketCommentSchema } from "@/lib/validations/ticket";
import { z } from "zod";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const ticket = await db.serviceTicket.findUnique({
    where: { id },
    include: {
      tenant: { include: { user: { select: { name: true, email: true } } } },
      unit: { select: { unitNumber: true, property: { select: { name: true } } } },
      vendor: { select: { id: true, name: true, userId: true } },
      landlord: { select: { id: true, name: true, companyName: true } },
      comments: {
        include: { author: { select: { name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify access
  if (session.user.role === "PM" && ticket.landlordId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (
    session.user.role === "VENDOR" &&
    ticket.vendor?.userId !== session.user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(ticket);
}

// PUT: update ticket status/assignment
// - PM: full update (status, assignment, cost, dates, etc.)
// - VENDOR: limited status transitions (OPEN → IN_PROGRESS → RESOLVED)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["PM", "VENDOR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const ticket = await db.serviceTicket.findUnique({
      where: { id },
      include: { vendor: { select: { userId: true } } },
    });
    if (!ticket) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Access check
    if (session.user.role === "PM" && ticket.landlordId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (
      session.user.role === "VENDOR" &&
      ticket.vendor?.userId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    // Vendors are restricted to status transitions only
    if (session.user.role === "VENDOR") {
      const newStatus = String(body.status || "");
      const VENDOR_ALLOWED_STATUSES = ["IN_PROGRESS", "RESOLVED"];
      if (!VENDOR_ALLOWED_STATUSES.includes(newStatus)) {
        return NextResponse.json(
          { error: "Vendors can only set IN_PROGRESS or RESOLVED" },
          { status: 403 }
        );
      }
      const updated = await db.serviceTicket.update({
        where: { id },
        data: {
          status: newStatus as "IN_PROGRESS" | "RESOLVED",
          ...(newStatus === "RESOLVED" ? { resolvedAt: new Date() } : {}),
        },
      });
      return NextResponse.json(updated);
    }

    // PM: full validated update
    const data = updateTicketSchema.parse(body);

    const updated = await db.serviceTicket.update({
      where: { id },
      data: {
        ...data,
        ...(data.status === "RESOLVED" ? { resolvedAt: new Date() } : {}),
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

// POST: add comment
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const ticket = await db.serviceTicket.findUnique({
      where: { id },
      include: {
        vendor: { select: { userId: true } },
        tenant: { select: { userId: true } },
      },
    });
    if (!ticket) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Access check on comment creation
    const role = session.user.role;
    const userId = session.user.id;
    const canComment =
      role === "ADMIN" ||
      (role === "PM" && ticket.landlordId === userId) ||
      (role === "VENDOR" && ticket.vendor?.userId === userId) ||
      (role === "TENANT" && ticket.tenant?.userId === userId);
    if (!canComment) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const data = ticketCommentSchema.parse(body);

    const images: string[] = body.images || [];

    const comment = await db.ticketComment.create({
      data: {
        ticketId: id,
        authorId: session.user.id,
        content: data.content,
        images,
      },
      include: { author: { select: { name: true, role: true } } },
    });

    return NextResponse.json(comment, { status: 201 });
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

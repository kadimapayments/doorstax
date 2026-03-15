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

  return NextResponse.json(ticket);
}

// PUT: update ticket status/assignment (landlord only)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const ticket = await db.serviceTicket.findFirst({
      where: { id, landlordId: session.user.id },
    });
    if (!ticket) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
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
    const ticket = await db.serviceTicket.findUnique({ where: { id } });
    if (!ticket) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { acknowledgeMessageSchema } from "@/lib/validations/message";
import { z } from "zod";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const message = await db.message.findUnique({
    where: { id },
    include: {
      sender: { select: { name: true, role: true } },
      recipients: {
        include: {
          user: { select: { name: true, email: true } },
        },
      },
      property: { select: { name: true } },
    },
  });

  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  // Access control
  if (session.user.role === "PM" && message.senderId !== session.user.id) {
    // Check if landlord is a recipient
    const isRecipient = message.recipients.some(
      (r) => r.userId === session.user.id
    );
    if (!isRecipient) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (session.user.role === "TENANT") {
    const isRecipient = message.recipients.some(
      (r) => r.userId === session.user.id
    );
    if (!isRecipient) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Get thread messages (replies)
  const thread = await db.message.findMany({
    where: { threadId: id },
    include: {
      sender: { select: { name: true, role: true } },
      recipients: {
        include: {
          user: { select: { name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ ...message, thread });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const data = acknowledgeMessageSchema.parse(body);

    // Verify message exists
    const message = await db.message.findUnique({
      where: { id },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    if (data.action === "read") {
      const recipient = await db.messageRecipient.upsert({
        where: {
          messageId_userId: {
            messageId: id,
            userId: session.user.id,
          },
        },
        update: {
          readAt: new Date(),
        },
        create: {
          messageId: id,
          userId: session.user.id,
          readAt: new Date(),
        },
      });

      return NextResponse.json(recipient);
    }

    if (data.action === "acknowledge") {
      const now = new Date();
      const recipient = await db.messageRecipient.upsert({
        where: {
          messageId_userId: {
            messageId: id,
            userId: session.user.id,
          },
        },
        update: {
          readAt: now,
          acknowledgedAt: now,
        },
        create: {
          messageId: id,
          userId: session.user.id,
          readAt: now,
          acknowledgedAt: now,
        },
      });

      return NextResponse.json(recipient);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Message update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

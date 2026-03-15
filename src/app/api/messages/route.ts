import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createMessageSchema } from "@/lib/validations/message";
import { z } from "zod";
import { getResend } from "@/lib/email";
import { newMessageHtml } from "@/lib/emails/new-message";

/** Send email notification to message recipients (non-blocking) */
function notifyRecipients(
  recipients: { user: { name: string | null; email: string | null } }[],
  senderName: string,
  subject: string,
  bodyPreview: string,
) {
  for (const r of recipients) {
    if (!r.user.email) continue;
    getResend()
      .emails.send({
        from: "DoorStax <notifications@doorstax.com>",
        to: r.user.email,
        subject: `New message from ${senderName}: ${subject}`,
        html: newMessageHtml({
          recipientName: r.user.name || "there",
          senderName,
          subject,
          previewText: bodyPreview.length > 200 ? bodyPreview.slice(0, 200) + "..." : bodyPreview,
        }),
      })
      .catch((err) => console.error("[message-email] Send failed:", err));
  }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  const includeOpts = {
    sender: { select: { name: true, role: true } },
    recipients: {
      include: {
        user: { select: { name: true, email: true } },
      },
    },
    property: { select: { name: true } },
  };

  const typeFilter = type ? { type: type as "DIRECT" | "ANNOUNCEMENT" } : {};

  if (session.user.role === "PM") {
    // Sent messages
    const sent = await db.message.findMany({
      where: {
        senderId: session.user.id,
        threadId: null,
        ...typeFilter,
      },
      include: includeOpts,
      orderBy: { createdAt: "desc" },
    });

    // Messages where landlord is a recipient (tenant replies to threads)
    const received = await db.message.findMany({
      where: {
        recipients: { some: { userId: session.user.id } },
        threadId: null,
        ...typeFilter,
      },
      include: includeOpts,
      orderBy: { createdAt: "desc" },
    });

    // Merge and deduplicate
    const map = new Map<string, (typeof sent)[0]>();
    for (const m of sent) map.set(m.id, m);
    for (const m of received) {
      if (!map.has(m.id)) map.set(m.id, m);
    }
    const messages = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json(messages);
  }

  if (session.user.role === "TENANT") {
    const messages = await db.message.findMany({
      where: {
        recipients: { some: { userId: session.user.id } },
        threadId: null,
        ...typeFilter,
      },
      include: {
        ...includeOpts,
        recipients: {
          where: { userId: session.user.id },
          include: {
            user: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(messages);
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
    const data = createMessageSchema.parse(body);

    if (data.type === "DIRECT") {
      if (session.user.role === "PM") {
        if (!data.recipientId) {
          return NextResponse.json(
            { error: "recipientId is required for direct messages" },
            { status: 400 }
          );
        }

        const message = await db.message.create({
          data: {
            senderId: session.user.id,
            type: "DIRECT",
            subject: data.subject,
            body: data.body,
            priority: data.priority,
            threadId: data.threadId || null,
            propertyId: data.propertyId || null,
            imageUrl: data.imageUrl || null,
            recipients: {
              create: { userId: data.recipientId },
            },
          },
          include: {
            sender: { select: { name: true, role: true } },
            recipients: {
              include: { user: { select: { name: true, email: true } } },
            },
          },
        });

        notifyRecipients(message.recipients, session.user.name || "Your Property Manager", data.subject, data.body);

        return NextResponse.json(message, { status: 201 });
      }

      if (session.user.role === "TENANT") {
        // Find the landlord via tenant's unit → property → landlordId
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

        const landlordId = tenant.unit.property.landlordId;

        const message = await db.message.create({
          data: {
            senderId: session.user.id,
            type: "DIRECT",
            subject: data.subject,
            body: data.body,
            priority: data.priority,
            threadId: data.threadId || null,
            imageUrl: data.imageUrl || null,
            recipients: {
              create: { userId: landlordId },
            },
          },
          include: {
            sender: { select: { name: true, role: true } },
            recipients: {
              include: { user: { select: { name: true, email: true } } },
            },
          },
        });

        notifyRecipients(message.recipients, session.user.name || "Your Tenant", data.subject, data.body);

        return NextResponse.json(message, { status: 201 });
      }
    }

    if (data.type === "ANNOUNCEMENT") {
      if (session.user.role !== "PM") {
        return NextResponse.json(
          { error: "Only landlords can send announcements" },
          { status: 403 }
        );
      }

      let tenantUserIds: string[] = [];

      if (data.propertyId) {
        // Tenants in a specific property
        const tenants = await db.tenantProfile.findMany({
          where: {
            unit: { propertyId: data.propertyId },
            unitId: { not: null },
          },
          select: { userId: true },
        });
        tenantUserIds = tenants.map((t) => t.userId);
      } else {
        // All tenants across all landlord's properties
        const tenants = await db.tenantProfile.findMany({
          where: {
            unit: { property: { landlordId: session.user.id } },
            unitId: { not: null },
          },
          select: { userId: true },
        });
        tenantUserIds = tenants.map((t) => t.userId);
      }

      if (tenantUserIds.length === 0) {
        return NextResponse.json(
          { error: "No tenants found for the selected scope" },
          { status: 400 }
        );
      }

      const message = await db.message.create({
        data: {
          senderId: session.user.id,
          type: "ANNOUNCEMENT",
          subject: data.subject,
          body: data.body,
          priority: data.priority,
          propertyId: data.propertyId || null,
          imageUrl: data.imageUrl || null,
          recipients: {
            create: tenantUserIds.map((userId) => ({ userId })),
          },
        },
        include: {
          sender: { select: { name: true, role: true } },
          recipients: {
            include: { user: { select: { name: true, email: true } } },
          },
          property: { select: { name: true } },
        },
      });

      notifyRecipients(message.recipients, session.user.name || "Your Property Manager", data.subject, data.body);

      return NextResponse.json(message, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid message type" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Message creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

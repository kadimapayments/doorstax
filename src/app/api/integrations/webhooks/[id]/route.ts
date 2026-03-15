import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit";

/**
 * GET /api/integrations/webhooks/[id]
 *
 * Get webhook details with recent deliveries.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await resolveApiSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const webhook = await db.integrationWebhook.findFirst({
    where: {
      id,
      OR: [
        { apiKey: { userId: session.user.id } },
        { integration: { userId: session.user.id } },
      ],
    },
    include: {
      deliveries: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          eventType: true,
          statusCode: true,
          deliveredAt: true,
          attempts: true,
          createdAt: true,
        },
      },
      _count: { select: { deliveries: true } },
    },
  });

  if (!webhook) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  // Never expose the signing secret
  const { secret: _, ...safeWebhook } = webhook;
  return NextResponse.json(safeWebhook);
}

/**
 * PATCH /api/integrations/webhooks/[id]
 *
 * Update webhook settings.
 *
 * Body: { url?, eventTypes?, isActive? }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await resolveApiSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const webhook = await db.integrationWebhook.findFirst({
    where: {
      id,
      OR: [
        { apiKey: { userId: session.user.id } },
        { integration: { userId: session.user.id } },
      ],
    },
  });

  if (!webhook) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  const body = await req.json();
  const { url, eventTypes, isActive } = body as {
    url?: string;
    eventTypes?: string[];
    isActive?: boolean;
  };

  const updateData: Record<string, unknown> = {};
  if (url !== undefined) updateData.url = url;
  if (eventTypes !== undefined) updateData.eventTypes = eventTypes;
  if (isActive !== undefined) {
    updateData.isActive = isActive;
    // Reset failure count when re-enabling
    if (isActive) updateData.failureCount = 0;
  }

  const updated = await db.integrationWebhook.update({
    where: { id },
    data: updateData,
  });

  auditLog({
    userId: session.user.id,
    action: "UPDATE",
    objectType: "IntegrationWebhook",
    objectId: id,
    description: `Updated webhook: ${Object.keys(updateData).join(", ")}`,
    oldValue: { url: webhook.url, isActive: webhook.isActive },
    newValue: updateData,
    req,
  });

  const { secret: _, ...safeUpdated } = updated;
  return NextResponse.json(safeUpdated);
}

/**
 * DELETE /api/integrations/webhooks/[id]
 *
 * Delete a webhook subscription.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await resolveApiSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const webhook = await db.integrationWebhook.findFirst({
    where: {
      id,
      OR: [
        { apiKey: { userId: session.user.id } },
        { integration: { userId: session.user.id } },
      ],
    },
  });

  if (!webhook) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  await db.integrationWebhook.delete({ where: { id } });

  auditLog({
    userId: session.user.id,
    action: "DELETE",
    objectType: "IntegrationWebhook",
    objectId: id,
    description: `Deleted webhook for ${webhook.url}`,
    req,
  });

  return NextResponse.json({ success: true });
}

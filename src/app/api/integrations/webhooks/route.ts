import { NextResponse } from "next/server";
import crypto from "crypto";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import type { DomainEventType } from "@/lib/events/types";

// Valid event types for webhook subscriptions
const VALID_EVENT_TYPES: DomainEventType[] = [
  "payment.created",
  "payment.succeeded",
  "payment.failed",
  "payment.refunded",
  "rent.charged",
  "tenant.created",
  "lease.created",
  "lease.expiring",
  "payout.generated",
  "chargeback.received",
  "autopay.enrolled",
  "autopay.cancelled",
  "autopay.failed",
  "reconciliation.completed",
];

/**
 * GET /api/integrations/webhooks
 *
 * List webhook subscriptions for the current user.
 */
export async function GET(req: Request) {
  const session = await resolveApiSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find webhooks owned by user's API keys or integrations
  const webhooks = await db.integrationWebhook.findMany({
    where: {
      OR: [
        { apiKey: { userId: session.user.id } },
        { integration: { userId: session.user.id } },
      ],
    },
    include: {
      _count: { select: { deliveries: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ webhooks });
}

/**
 * POST /api/integrations/webhooks
 *
 * Create a new webhook subscription.
 *
 * Body: {
 *   url: string,
 *   eventTypes: string[],
 *   apiKeyId?: string,       // either apiKeyId or integrationId
 *   integrationId?: string,
 * }
 *
 * A signing secret is auto-generated and returned once.
 */
export async function POST(req: Request) {
  const session = await resolveApiSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check permissions (PM or ADMIN role, or API key with integrations:write)
  const role = session.user.role;
  if (role !== "PM" && role !== "ADMIN") {
    // Check API key permissions
    const apiKeySession = session as { apiKey?: { permissions: string[] } };
    if (
      !apiKeySession.apiKey?.permissions?.includes("integrations:write") &&
      !apiKeySession.apiKey?.permissions?.includes("*")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = await req.json();
  const { url, eventTypes, apiKeyId, integrationId } = body as {
    url: string;
    eventTypes: string[];
    apiKeyId?: string;
    integrationId?: string;
  };

  // Validate
  if (!url || !eventTypes || eventTypes.length === 0) {
    return NextResponse.json(
      { error: "url and eventTypes are required" },
      { status: 400 }
    );
  }

  // Validate URL format
  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) {
      return NextResponse.json(
        { error: "URL must use HTTPS or HTTP" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Validate event types
  const invalidTypes = eventTypes.filter(
    (t: string) => !VALID_EVENT_TYPES.includes(t as DomainEventType)
  );
  if (invalidTypes.length > 0) {
    return NextResponse.json(
      { error: `Invalid event types: ${invalidTypes.join(", ")}` },
      { status: 400 }
    );
  }

  // Verify ownership of API key or integration
  if (apiKeyId) {
    const apiKey = await db.apiKey.findFirst({
      where: { id: apiKeyId, userId: session.user.id, revokedAt: null },
    });
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not found or not yours" },
        { status: 404 }
      );
    }
  } else if (integrationId) {
    const integration = await db.integration.findFirst({
      where: { id: integrationId, userId: session.user.id },
    });
    if (!integration) {
      return NextResponse.json(
        { error: "Integration not found or not yours" },
        { status: 404 }
      );
    }
  }

  // Generate signing secret
  const secret = `whsec_${crypto.randomBytes(32).toString("hex")}`;

  const webhook = await db.integrationWebhook.create({
    data: {
      url,
      eventTypes,
      secret,
      apiKeyId: apiKeyId || undefined,
      integrationId: integrationId || undefined,
    },
  });

  auditLog({
    userId: session.user.id,
    action: "CREATE",
    objectType: "IntegrationWebhook",
    objectId: webhook.id,
    description: `Created webhook subscription for ${eventTypes.length} event types`,
    req,
  });

  // Return secret only on creation (never exposed again)
  return NextResponse.json(
    {
      id: webhook.id,
      url: webhook.url,
      eventTypes: webhook.eventTypes,
      secret, // Only returned once!
      isActive: webhook.isActive,
      createdAt: webhook.createdAt,
    },
    { status: 201 }
  );
}

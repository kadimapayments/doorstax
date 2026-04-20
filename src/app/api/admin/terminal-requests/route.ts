import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";
import { assertPropertyApproved } from "@/lib/property-guard";

/**
 * GET /api/admin/terminal-requests
 *   Returns the queue of pending terminal-assignment requests.
 *
 *   Source: DashboardNotice rows of type TERMINAL_REQUEST that are not
 *   yet dismissed. The notices are created by /api/properties when a
 *   PM with an APPROVED/SUBMITTED merchant app creates a new property.
 *
 * POST /api/admin/terminal-requests
 *   Body: { noticeId, propertyId, terminalId }
 *   Assigns the terminal to the property, marks the notice dismissed,
 *   notifies the PM.
 */

export async function GET(_req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:landlords")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // All open terminal requests
  const notices = await db.dashboardNotice.findMany({
    where: { type: "TERMINAL_REQUEST", dismissedAt: null },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Resolve each notice to its PM + property by reading the actionUrl
  // (/dashboard/properties/<id>) and the targetUserId.
  const propertyIds = notices
    .map((n) => {
      const m = n.actionUrl?.match(/\/dashboard\/properties\/([^/?#]+)/);
      return m?.[1] || null;
    })
    .filter((id): id is string => !!id);

  const properties = propertyIds.length
    ? await db.property.findMany({
        where: { id: { in: propertyIds } },
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          state: true,
          kadimaTerminalId: true,
          landlordId: true,
          landlord: {
            select: {
              id: true,
              name: true,
              email: true,
              companyName: true,
            },
          },
        },
      })
    : [];

  const propertyById = new Map(properties.map((p) => [p.id, p]));

  const queue = notices.map((n) => {
    const propertyMatch = n.actionUrl?.match(
      /\/dashboard\/properties\/([^/?#]+)/
    );
    const propertyId = propertyMatch?.[1] || null;
    const property = propertyId ? propertyById.get(propertyId) : null;
    return {
      id: n.id,
      title: n.title,
      message: n.message,
      severity: n.severity,
      createdAt: n.createdAt.toISOString(),
      pmId: n.targetUserId,
      pmName: property?.landlord?.name ?? "",
      pmEmail: property?.landlord?.email ?? "",
      companyName: property?.landlord?.companyName ?? null,
      propertyId,
      propertyName: property?.name ?? null,
      propertyAddress: property
        ? `${property.address}, ${property.city}, ${property.state}`
        : null,
      currentTerminalId: property?.kadimaTerminalId ?? null,
    };
  });

  return NextResponse.json({ queue, count: queue.length });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:landlords")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { noticeId, propertyId, terminalId } = body as {
    noticeId?: string;
    propertyId?: string;
    terminalId?: string;
  };

  if (!propertyId || !terminalId) {
    return NextResponse.json(
      { error: "propertyId and terminalId are required" },
      { status: 400 }
    );
  }

  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      name: true,
      landlordId: true,
      landlord: { select: { name: true } },
    },
  });
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  // Underwriter gate: can't provision a Kadima terminal to a property
  // that hasn't cleared the risk review yet. Existing pre-review
  // properties default to "APPROVED" at the schema level, so legacy
  // terminal-assignments keep working.
  const propertyGuard = await assertPropertyApproved(propertyId);
  if (!propertyGuard.ok) {
    return NextResponse.json(
      { error: propertyGuard.reason },
      { status: 403 }
    );
  }

  await db.property.update({
    where: { id: propertyId },
    data: { kadimaTerminalId: terminalId.trim() },
  });

  // Mark the notice as dismissed
  if (noticeId) {
    await db.dashboardNotice
      .update({
        where: { id: noticeId },
        data: { dismissedAt: new Date() },
      })
      .catch(() => {});
  }

  // Notify the PM
  try {
    const { notify } = await import("@/lib/notifications");
    await notify({
      userId: property.landlordId,
      createdById: session.user.id,
      type: "TERMINAL_ASSIGNED",
      title: "Terminal Provisioned",
      message: `Your Kadima terminal for ${property.name} has been assigned. You can now process payments at this property.`,
      severity: "info",
      actionUrl: `/dashboard/properties/${propertyId}`,
    });
  } catch {}

  return NextResponse.json({ ok: true });
}

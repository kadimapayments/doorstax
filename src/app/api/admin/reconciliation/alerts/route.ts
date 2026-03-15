import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import type { ReconciliationAlertStatus } from "@prisma/client";

/**
 * GET /api/admin/reconciliation/alerts
 *
 * List reconciliation alerts with filters.
 * Admin-only endpoint.
 *
 * Query params:
 * - status: OPEN | ACKNOWLEDGED | RESOLVED
 * - severity: INFO | WARNING | CRITICAL
 * - alertType: MISSING_LOCAL | MISSING_GATEWAY | AMOUNT_MISMATCH | DUPLICATE | STATUS_MISMATCH
 * - page: page number (default: 1)
 * - limit: items per page (default: 50)
 */
export async function GET(req: Request) {
  const session = await resolveApiSession(req);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const severity = url.searchParams.get("severity");
  const alertType = url.searchParams.get("alertType");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50")));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (severity) where.severity = severity;
  if (alertType) where.alertType = alertType;

  const [alerts, total] = await Promise.all([
    db.reconciliationAlert.findMany({
      where,
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
      skip,
      take: limit,
      include: {
        report: {
          select: { reportDate: true },
        },
      },
    }),
    db.reconciliationAlert.count({ where }),
  ]);

  return NextResponse.json({
    alerts,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

/**
 * PATCH /api/admin/reconciliation/alerts
 *
 * Acknowledge or resolve a reconciliation alert.
 * Admin-only endpoint.
 *
 * Body: { alertId, status: "ACKNOWLEDGED" | "RESOLVED", note?: string }
 */
export async function PATCH(req: Request) {
  const session = await resolveApiSession(req);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { alertId, status, note } = body as {
    alertId: string;
    status: ReconciliationAlertStatus;
    note?: string;
  };

  if (!alertId || !status) {
    return NextResponse.json(
      { error: "alertId and status are required" },
      { status: 400 }
    );
  }

  if (!["ACKNOWLEDGED", "RESOLVED"].includes(status)) {
    return NextResponse.json(
      { error: "status must be ACKNOWLEDGED or RESOLVED" },
      { status: 400 }
    );
  }

  const alert = await db.reconciliationAlert.findUnique({
    where: { id: alertId },
  });

  if (!alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  const updated = await db.reconciliationAlert.update({
    where: { id: alertId },
    data: {
      status,
      ...(status === "RESOLVED"
        ? {
            resolvedAt: new Date(),
            resolvedById: session.user.id,
            resolvedNote: note,
          }
        : {}),
    },
  });

  auditLog({
    userId: session.user.id,
    action: "UPDATE",
    objectType: "ReconciliationAlert",
    objectId: alertId,
    description: `Alert ${status.toLowerCase()}: ${alert.alertType}`,
    oldValue: { status: alert.status },
    newValue: { status, note },
    req,
  });

  return NextResponse.json(updated);
}

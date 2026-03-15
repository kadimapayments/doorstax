import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";

/**
 * GET /api/admin/reconciliation
 *
 * List reconciliation reports with pagination.
 * Admin-only endpoint.
 *
 * Query params:
 * - from: ISO date string (inclusive)
 * - to: ISO date string (inclusive)
 * - page: page number (default: 1)
 * - limit: items per page (default: 20)
 */
export async function GET(req: Request) {
  const session = await resolveApiSession(req);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (from || to) {
    where.reportDate = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to + "T23:59:59.999Z") } : {}),
    };
  }

  const [reports, total] = await Promise.all([
    db.reconciliationReport.findMany({
      where,
      orderBy: { reportDate: "desc" },
      skip,
      take: limit,
      include: {
        _count: { select: { alerts: true } },
      },
    }),
    db.reconciliationReport.count({ where }),
  ]);

  return NextResponse.json({
    reports,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

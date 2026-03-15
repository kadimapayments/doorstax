import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";

/**
 * GET /api/admin/reconciliation/[id]
 *
 * Get a single reconciliation report with all its alerts.
 * Admin-only endpoint.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await resolveApiSession(req);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const report = await db.reconciliationReport.findUnique({
    where: { id },
    include: {
      alerts: {
        orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  return NextResponse.json(report);
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:applications")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const screenings = await db.screeningInvitation.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      sentBy: { select: { name: true, email: true, companyName: true } },
      unit: {
        select: {
          unitNumber: true,
          property: { select: { name: true } },
        },
      },
    },
  });

  const rows = screenings.map((s) => ({
    id: s.id,
    email: s.email,
    status: s.status,
    pmName: s.sentBy?.name || s.sentBy?.email || "—",
    pmCompany: s.sentBy?.companyName || null,
    property: s.unit?.property?.name || "—",
    unit: s.unit?.unitNumber || "—",
    sentAt: s.sentAt.toISOString(),
    applyLink: s.applyLink,
  }));

  const stats = {
    total: rows.length,
    sent: rows.filter((r) => r.status === "SENT").length,
    opened: rows.filter((r) => r.status === "OPENED").length,
    completed: rows.filter((r) => r.status === "COMPLETED").length,
  };

  return NextResponse.json({ rows, stats });
}

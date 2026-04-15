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
  if (!canAdmin(adminCtx, "admin:overview")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const proposals = await db.proposalQuote.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      agentUser: { select: { name: true, email: true } },
      agent: { select: { agentId: true } },
      lead: { select: { id: true, name: true, status: true } },
    },
  });

  const rows = proposals.map((p) => ({
    id: p.id,
    quoteId: p.quoteId,
    prospectName: p.prospectName,
    prospectEmail: p.prospectEmail,
    prospectCompany: p.prospectCompany,
    unitCount: p.unitCount,
    softwareCost: p.softwareCost,
    totalPaymentEarnings: p.totalPaymentEarnings,
    netCostOrProfit: p.netCostOrProfit,
    tierName: p.tierName,
    status: p.status,
    sentAt: p.sentAt?.toISOString() ?? null,
    openCount: p.openCount,
    clickedAt: p.clickedAt?.toISOString() ?? null,
    convertedAt: p.convertedAt?.toISOString() ?? null,
    convertedPmId: p.convertedPmId,
    pdfUrl: p.pdfUrl,
    agentName: p.agentUser?.name ?? "",
    agentId: p.agent?.agentId ?? null,
    leadId: p.lead?.id ?? null,
    leadName: p.lead?.name ?? null,
    leadStatus: p.lead?.status ?? null,
    createdAt: p.createdAt.toISOString(),
  }));

  const stats = {
    total: rows.length,
    sent: rows.filter((r) => r.status === "SENT").length,
    opened: rows.filter((r) => ["OPENED", "CLICKED", "CONVERTED"].includes(r.status)).length,
    clicked: rows.filter((r) => ["CLICKED", "CONVERTED"].includes(r.status)).length,
    converted: rows.filter((r) => r.status === "CONVERTED").length,
    openRate: rows.length > 0
      ? Math.round((rows.filter((r) => r.openCount > 0).length / rows.length) * 100)
      : 0,
    conversionRate: rows.length > 0
      ? Math.round((rows.filter((r) => r.status === "CONVERTED").length / rows.length) * 100)
      : 0,
  };

  return NextResponse.json({ rows, stats });
}

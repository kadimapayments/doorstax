import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { generatePayoutReportPdf } from "@/lib/payout-report-generator";

/**
 * GET /api/reports/payouts?month=3&year=2026&format=pdf|json
 *
 * PM-only endpoint returning either a consolidated payout PDF
 * or JSON data for the report UI page.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const sp = req.nextUrl.searchParams;
  const now = new Date();
  const month = Number(sp.get("month")) || now.getMonth() + 1; // 1-indexed
  const year = Number(sp.get("year")) || now.getFullYear();
  const format = sp.get("format") || "json";

  // ── PDF format ──
  if (format === "pdf") {
    try {
      const buffer = await generatePayoutReportPdf(landlordId, month, year);
      const monthName = new Date(year, month - 1).toLocaleString("en-US", {
        month: "long",
      });
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="payout-report-${monthName}-${year}.pdf"`,
        },
      });
    } catch (err) {
      console.error("Payout report PDF error:", err);
      return NextResponse.json(
        { error: "Failed to generate PDF" },
        { status: 500 }
      );
    }
  }

  // ── JSON format ──
  const periodStart = new Date(year, month - 1, 1);

  const payouts = await db.ownerPayout.findMany({
    where: {
      landlordId,
      periodStart: { gte: periodStart },
      periodEnd: { lte: new Date(year, month, 1) },
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          properties: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { owner: { name: "asc" } },
  });

  const serialized = payouts.map((p) => ({
    id: p.id,
    ownerId: p.ownerId,
    ownerName: p.owner.name,
    properties:
      p.owner.properties?.map(
        (prop: { id: string; name: string }) => prop.name
      ) || [],
    periodStart: p.periodStart.toISOString(),
    periodEnd: p.periodEnd.toISOString(),
    grossRent: Number(p.grossRent),
    processingFees: Number(p.processingFees),
    managementFee: Number(p.managementFee),
    expenses: Number(p.expenses),
    platformFee: Number(p.platformFee),
    payoutFee: Number(p.payoutFee),
    unitFee: Number(p.unitFee),
    netPayout: Number(p.netPayout),
    status: p.status,
    paymentMethod: p.paymentMethod,
    paidAt: p.paidAt?.toISOString() || null,
  }));

  const totalGross = serialized.reduce((s, p) => s + p.grossRent, 0);
  const totalNet = serialized.reduce((s, p) => s + p.netPayout, 0);
  const totalFees = totalGross - totalNet;

  const statusCounts: Record<string, number> = {};
  for (const p of serialized) {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  }

  return NextResponse.json({
    period: { month, year },
    totalGross,
    totalFees,
    totalNet,
    statusCounts,
    payouts: serialized,
  });
}

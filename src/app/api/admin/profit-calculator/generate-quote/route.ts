import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { generateProfitQuotePdf } from "@/lib/profit-quote-pdf";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:overview")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const quoteId = "Q-" + Date.now().toString(36).toUpperCase();

  const pdfBuffer = await generateProfitQuotePdf({
    prospectName: body.prospectName || "Prospect",
    prospectEmail: body.prospectEmail,
    prospectCompany: body.prospectCompany,
    units: body.units || 100,
    avgRent: body.avgRent || 1500,
    occupancyPct: body.occupancyPct || 92,
    cardPct: body.cardPct || 30,
    mgmtFeePct: body.mgmtFeePct || 8,
    tierName: body.tier?.name || body.tierName || "Starter",
    softwareCost: body.softwareCost || 150,
    perUnitCost: body.tier?.perUnitCost || body.perUnitCost || 3,
    pmCardEarnings: body.pmCardEarnings || 0,
    pmAchEarnings: body.pmAchEarnings || 0,
    totalPmPaymentEarnings: body.totalPmPaymentEarnings || 0,
    pmNetCostOrProfit: body.pmNetCostOrProfit || 0,
    pmPaymentsCoverSoftware: body.pmPaymentsCoverSoftware || false,
    mgmtFeeEarnings: body.mgmtFeeEarnings || 0,
    pmTotalNetIncome: body.pmTotalNetIncome || 0,
    quoteId,
    preparedBy: session.user.name || "DoorStax Sales",
    preparedDate: new Date(),
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=DoorStax_Quote_${(body.prospectName || "Prospect").replace(/\s+/g, "_")}.pdf`,
    },
  });
}

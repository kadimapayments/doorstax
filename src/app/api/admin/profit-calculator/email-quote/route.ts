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
  if (!body.prospectName || !body.prospectEmail) {
    return NextResponse.json(
      { error: "Name and email required" },
      { status: 400 }
    );
  }

  const quoteId = "Q-" + Date.now().toString(36).toUpperCase();
  const pdfBuffer = await generateProfitQuotePdf({
    prospectName: body.prospectName,
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

  // Send email
  try {
    const { getResend } = await import("@/lib/email");
    const {
      emailStyles,
      emailHeader,
      emailFooter,
      emailButton,
      esc,
    } = await import("@/lib/emails/_layout");

    const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";
    const sc = body.softwareCost || 150;
    const pe = body.totalPmPaymentEarnings || 0;
    const net = body.pmNetCostOrProfit || 0;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${emailStyles()}</style></head><body><div class="container"><div class="card">${emailHeader()}<h1>Your Customized Pricing Proposal</h1><p>Hi ${esc(body.prospectName)},</p><p>Thank you for your interest in DoorStax. We've prepared a customized pricing proposal for your ${body.units || 100}-unit portfolio.</p><div class="highlight"><table><tr><td>Software Cost</td><td>$${sc.toFixed(2)}/mo</td></tr><tr><td>Payment Earnings</td><td style="color:#10b981;">+$${pe.toFixed(2)}/mo</td></tr><tr><td style="font-weight:700;">Net Cost/Profit</td><td style="font-weight:700;color:${net >= 0 ? "#10b981" : "#ef4444"};">${net >= 0 ? "+" : ""}$${net.toFixed(2)}/mo</td></tr></table></div><p>See the full breakdown in the attached PDF.</p>${emailButton("Start Your 14-Day Free Trial", BASE + "/register")}<p style="font-size:12px;color:#999;">Questions? Reply to this email or visit doorstax.com</p></div>${emailFooter()}</div></body></html>`;

    await getResend().emails.send({
      from: "DoorStax <leads@doorstax.com>",
      to: body.prospectEmail,
      subject: `Your DoorStax Pricing Proposal — ${body.units || 100} Units`,
      html,
      attachments: [
        {
          filename: `DoorStax_Quote_${body.prospectName.replace(/\s+/g, "_")}.pdf`,
          content: pdfBuffer,
        },
      ],
    });
  } catch (err) {
    console.error("[profit-calc] Email failed:", err);
    return NextResponse.json(
      { error: "Email send failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, quoteId });
}

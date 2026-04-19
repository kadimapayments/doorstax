import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";
import { generateProfitQuotePdf } from "@/lib/profit-quote-pdf";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:overview")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const targetEmail: string | undefined = body.email;

  const proposal = await db.proposalQuote.findUnique({
    where: { id },
    include: {
      agentUser: { select: { name: true, email: true } },
      agent: { select: { agentId: true, phone: true } },
    },
  });

  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  const emailTo = (targetEmail && targetEmail.trim()) || proposal.prospectEmail;
  const isDifferentEmail = emailTo.toLowerCase() !== proposal.prospectEmail.toLowerCase();

  // Regenerate the PDF with current data
  const pdfBuffer = await generateProfitQuotePdf({
    prospectName: proposal.prospectName,
    prospectEmail: emailTo,
    prospectCompany: proposal.prospectCompany || undefined,
    units: proposal.unitCount,
    avgRent: proposal.avgRent,
    occupancyPct: proposal.occupancyRate,
    cardPct: proposal.cardPaymentPercent,
    mgmtFeePct: proposal.mgmtFeePercent,
    tierName: proposal.tierName,
    softwareCost: proposal.softwareCost,
    perUnitCost: 3,
    pmCardEarnings: 0,
    pmAchEarnings: 0,
    totalPmPaymentEarnings: proposal.totalPaymentEarnings,
    pmNetCostOrProfit: proposal.netCostOrProfit,
    pmPaymentsCoverSoftware: proposal.netCostOrProfit >= 0,
    mgmtFeeEarnings: 0,
    pmTotalNetIncome: proposal.totalPaymentEarnings,
    quoteId: proposal.quoteId,
    preparedBy: proposal.agentUser?.name || "DoorStax Sales",
    preparedDate: new Date(),
    validUntil: proposal.expiresAt,
    agentEmail: proposal.agentUser?.email || "",
    agentId: proposal.agent?.agentId || "",
    agentPhone: proposal.agent?.phone || "",
  });

  // Send the email
  try {
    const { getResend } = await import("@/lib/email");
    const { emailStyles, emailHeader, emailFooter, emailButton, esc } =
      await import("@/lib/emails/_layout");

    const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";
    const sc = proposal.softwareCost;
    const pe = proposal.totalPaymentEarnings;
    const net = proposal.netCostOrProfit;

    const ctaUrl = `${BASE}/api/track/proposal-click?q=${proposal.quoteId}`;
    const trackingPixel = `<img src="${BASE}/api/track/proposal-open?q=${proposal.quoteId}" width="1" height="1" style="display:none" />`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${emailStyles()}</style></head><body><div class="container"><div class="card">${emailHeader()}<h1>Your Customized Pricing Proposal</h1><p>Hi ${esc(proposal.prospectName)},</p><p>Here is your pricing proposal for your ${proposal.unitCount}-unit portfolio.</p><div class="highlight"><table><tr><td>Platform Investment</td><td>$${sc.toFixed(2)}/mo</td></tr><tr><td>Payment Revenue</td><td style="color:#10b981;">+$${pe.toFixed(2)}/mo</td></tr><tr><td style="font-weight:700;">Net Result</td><td style="font-weight:700;color:${net >= 0 ? "#10b981" : "#6c5ce7"};">${net >= 0 ? "+" : ""}$${net.toFixed(2)}/mo</td></tr></table></div><p>See the full breakdown in the attached PDF.</p>${emailButton("Start Your 14-Day Free Trial", ctaUrl)}<p style="font-size:12px;color:#999;">Questions? Reply to this email or visit doorstax.com</p></div>${emailFooter()}</div>${trackingPixel}</body></html>`;

    await getResend().emails.send({
      from: "DoorStax <leads@doorstax.com>",
      to: emailTo,
      subject: `Your DoorStax Pricing Proposal — ${proposal.unitCount} Units`,
      html,
      attachments: [
        {
          filename: `DoorStax_Quote_${proposal.prospectName.replace(/\s+/g, "_")}.pdf`,
          content: pdfBuffer,
        },
      ],
    });
  } catch (err) {
    console.error("[proposal-resend] Email failed:", err);
    return NextResponse.json({ error: "Email send failed" }, { status: 500 });
  }

  // Update the proposal record. Email already went out, so we can't
  // "cancel" on DB failure — but we MUST surface this so the admin
  // doesn't resend again thinking the last send didn't register.
  try {
    await db.proposalQuote.update({
      where: { id },
      data: {
        sentAt: new Date(),
        // Only bump status back to SENT if it was DRAFT/EXPIRED
        ...(["DRAFT", "EXPIRED"].includes(proposal.status)
          ? { status: "SENT" }
          : {}),
        // Update prospect email if resending to a different address
        ...(isDifferentEmail ? { prospectEmail: emailTo } : {}),
      },
    });
  } catch (e) {
    console.error("[proposal-resend] Update failed AFTER email send:", e);
    return NextResponse.json(
      {
        error:
          "Proposal was emailed but sentAt could not be updated — don't resend, the prospect has it",
        sentTo: emailTo,
        emailSent: true,
      },
      { status: 500 }
    );
  }

  // Log activity on the linked lead if any
  if (proposal.leadId) {
    await db.leadActivity.create({
      data: {
        leadId: proposal.leadId,
        userId: session.user.id,
        type: "email_sent",
        content: `Pricing proposal ${proposal.quoteId} resent to ${emailTo}${isDifferentEmail ? " (new email)" : ""}`,
        metadata: { quoteId: proposal.quoteId, resent: true, email: emailTo },
      },
    }).catch(() => {});

    // Update lastContactedAt
    await db.lead.update({
      where: { id: proposal.leadId },
      data: { lastContactedAt: new Date() },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, sentTo: emailTo });
}

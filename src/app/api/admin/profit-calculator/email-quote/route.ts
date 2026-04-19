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
  const { db } = await import("@/lib/db");

  // Look up agent info
  const agentProfile = await db.agentProfile
    .findUnique({
      where: { userId: session.user.id },
      select: { id: true, agentId: true, phone: true },
    })
    .catch(() => null);

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
    agentEmail: session.user.email || "",
    agentId: agentProfile?.agentId || "",
    agentPhone: agentProfile?.phone || "",
  });

  // Upload PDF to blob
  let pdfUrl: string | null = null;
  try {
    const { put } = await import("@vercel/blob");
    const blob = await put("proposals/" + quoteId + ".pdf", pdfBuffer, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    pdfUrl = blob.url;
  } catch {}

  // Send email with tracking pixel BEFORE persisting the ProposalQuote.
  // Previous ordering (create-then-send) meant a Resend failure left a
  // SENT row in the DB that never actually went out — the admin could
  // legitimately believe the prospect had been emailed. Email first,
  // then commit the record only on success.
  try {
    const { getResend } = await import("@/lib/email");
    const { emailStyles, emailHeader, emailFooter, emailButton, esc } =
      await import("@/lib/emails/_layout");

    const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";
    const sc = body.softwareCost || 150;
    const pe = body.totalPmPaymentEarnings || 0;
    const net = body.pmNetCostOrProfit || 0;

    // CTA goes through click tracker
    const ctaUrl = `${BASE}/api/track/proposal-click?q=${quoteId}`;
    // Open tracking pixel
    const trackingPixel = `<img src="${BASE}/api/track/proposal-open?q=${quoteId}" width="1" height="1" style="display:none" />`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${emailStyles()}</style></head><body><div class="container"><div class="card">${emailHeader()}<h1>Your Customized Pricing Proposal</h1><p>Hi ${esc(body.prospectName)},</p><p>Thank you for your interest in DoorStax. We've prepared a customized pricing proposal for your ${body.units || 100}-unit portfolio.</p><div class="highlight"><table><tr><td>Platform Investment</td><td>$${sc.toFixed(2)}/mo</td></tr><tr><td>Payment Revenue</td><td style="color:#10b981;">+$${pe.toFixed(2)}/mo</td></tr><tr><td style="font-weight:700;">Net Result</td><td style="font-weight:700;color:${net >= 0 ? "#10b981" : "#6c5ce7"};">${net >= 0 ? "+" : ""}$${net.toFixed(2)}/mo</td></tr></table></div><p>See the full breakdown in the attached PDF.</p>${emailButton("Start Your 14-Day Free Trial", ctaUrl)}<p style="font-size:12px;color:#999;">Questions? Reply to this email or visit doorstax.com</p></div>${emailFooter()}</div>${trackingPixel}</body></html>`;

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

  // Email succeeded — persist the ProposalQuote as SENT.
  try {
    await db.proposalQuote.create({
      data: {
        quoteId,
        agentUserId: session.user.id,
        agentProfileId: agentProfile?.id || null,
        prospectName: body.prospectName,
        prospectEmail: body.prospectEmail,
        prospectCompany: body.prospectCompany || null,
        unitCount: body.units || 100,
        avgRent: body.avgRent || 1500,
        occupancyRate: body.occupancyPct || 92,
        cardPaymentPercent: body.cardPct || 30,
        mgmtFeePercent: body.mgmtFeePct || 8,
        pmAchRate: body.pmAchRate || 5,
        tierName: body.tier?.name || body.tierName || "Starter",
        softwareCost: body.softwareCost || 150,
        totalPaymentEarnings: body.totalPmPaymentEarnings || 0,
        netCostOrProfit: body.pmNetCostOrProfit || 0,
        pdfUrl,
        status: "SENT",
        sentAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  } catch (e) {
    // Email went out but we couldn't record it. Surface this — the admin
    // needs to know the prospect was emailed so they don't re-send.
    console.error("[email-quote] Proposal record failed AFTER email send:", e);
    return NextResponse.json(
      {
        error:
          "Email was sent but the record could not be saved — please note the quoteId manually: " +
          quoteId,
        quoteId,
        emailSent: true,
      },
      { status: 500 }
    );
  }

  // ─── Lead Sync: link proposal to lead, update lead status ───
  try {
    let leadId: string | null = body.leadId || null;

    if (!leadId) {
      // Check if a lead exists with this email
      const existingLead = await db.lead.findFirst({
        where: { email: { equals: body.prospectEmail, mode: "insensitive" } },
      });
      if (existingLead) {
        leadId = existingLead.id;
      } else {
        // Auto-create a new lead from the proposal
        const newLead = await db.lead.create({
          data: {
            name: body.prospectName,
            email: body.prospectEmail,
            phone: "",
            company: body.prospectCompany || "",
            source: "MANUAL",
            status: "PROPOSAL_SENT",
            notes: "Auto-created from pricing proposal " + quoteId,
          },
        });
        leadId = newLead.id;
      }
    }

    // Update lead status to reflect proposal sent
    if (leadId) {
      await db.lead.update({
        where: { id: leadId },
        data: {
          status: "PROPOSAL_SENT",
          lastContactedAt: new Date(),
        },
      }).catch(() => {});

      // Link proposal to lead
      await db.proposalQuote.update({
        where: { quoteId },
        data: { leadId },
      }).catch(() => {});

      // Log activity on the lead
      await db.leadActivity.create({
        data: {
          leadId,
          userId: session.user.id,
          type: "email_sent",
          content: `Pricing proposal ${quoteId} emailed (${body.units || 100} units, $${(body.softwareCost || 150).toFixed(2)}/mo)`,
          metadata: { quoteId, units: body.units, softwareCost: body.softwareCost },
        },
      }).catch(() => {});
    }
  } catch (leadErr) {
    console.error("[email-quote] Lead sync failed:", leadErr);
    // Non-blocking — the quote was already sent
  }

  return NextResponse.json({ ok: true, quoteId });
}

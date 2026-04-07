import { withCronGuard } from "@/lib/cron-guard";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { emailStyles, emailHeader, emailFooter } from "@/lib/emails/_layout";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";

/**
 * Daily Payment Summary
 * Sends each PM an email summary of payments received today.
 * Only sends if there were payments that day.
 * Schedule: 0 23 * * * (daily at 11 PM UTC / 6 PM ET)
 */
export const GET = withCronGuard("daily-payment-summary", async () => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const pms = await db.user.findMany({
    where: { role: "PM" },
    select: { id: true, name: true, email: true },
  });

  let emailsSent = 0;

  for (const pm of pms) {
    const payments = await db.payment.findMany({
      where: {
        landlordId: pm.id,
        status: "COMPLETED",
        paidAt: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        tenant: { include: { user: { select: { name: true } } } },
        unit: { select: { unitNumber: true, property: { select: { name: true } } } },
      },
      orderBy: { paidAt: "desc" },
    });

    if (payments.length === 0) continue;

    const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalSurcharges = payments.reduce((sum, p) => sum + Number(p.surchargeAmount || 0), 0);
    const cardPayments = payments.filter((p) => p.paymentMethod === "card");
    const achPayments = payments.filter((p) => p.paymentMethod === "ach");

    const paymentLines = payments.map((p) => {
      const tenant = p.tenant?.user?.name || "Unknown";
      const property = p.unit?.property?.name || "";
      const unit = p.unit?.unitNumber || "";
      const method = p.paymentMethod === "card" ? "Card" : "ACH";
      return `• ${tenant} — ${property} #${unit} — $${Number(p.amount).toFixed(2)} (${method})`;
    }).join("<br/>");

    const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${emailStyles("")}</style></head><body>
<div class="container"><div class="card">
${emailHeader()}
<h1>Daily Payment Summary</h1>
<p>Hi ${pm.name},</p>
<p>Here's your payment summary for ${dateStr}.</p>
<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;text-align:center;">
<div style="font-size:12px;color:#888;text-transform:uppercase;">Total Collected</div>
<div style="font-size:28px;font-weight:700;color:#16a34a;margin-top:4px;">$${totalCollected.toFixed(2)}</div>
</div>
<div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0;">
<table style="width:100%;border-collapse:collapse;">
<tr><td style="padding:6px 0;font-size:13px;color:#555;">Payments</td><td style="padding:6px 0;font-size:13px;text-align:right;font-weight:600;color:#333;">${payments.length}</td></tr>
<tr><td style="padding:6px 0;font-size:13px;color:#555;">Card</td><td style="padding:6px 0;font-size:13px;text-align:right;font-weight:600;color:#333;">${cardPayments.length} ($${cardPayments.reduce((s, p) => s + Number(p.amount), 0).toFixed(2)})</td></tr>
<tr><td style="padding:6px 0;font-size:13px;color:#555;">ACH</td><td style="padding:6px 0;font-size:13px;text-align:right;font-weight:600;color:#333;">${achPayments.length} ($${achPayments.reduce((s, p) => s + Number(p.amount), 0).toFixed(2)})</td></tr>
${totalSurcharges > 0 ? `<tr><td style="padding:6px 0;font-size:13px;color:#555;">Surcharges</td><td style="padding:6px 0;font-size:13px;text-align:right;font-weight:600;color:#333;">$${totalSurcharges.toFixed(2)}</td></tr>` : ""}
</table></div>
<div style="margin:20px 0;">
<p style="font-size:12px;font-weight:600;color:#888;text-transform:uppercase;margin-bottom:8px;">Payment Details</p>
<div style="font-size:12px;color:#555;line-height:1.8;">${paymentLines}</div>
</div>
<div class="btn-container" style="text-align:center;margin:24px 0;">
<a href="${BASE_URL}/dashboard/payments" class="btn">View All Payments</a>
</div>
</div>${emailFooter()}</div></body></html>`;

    if (pm.email) {
      try {
        const { getResend } = await import("@/lib/email");
        const resend = getResend();
        await resend.emails.send({
          from: "DoorStax <noreply@doorstax.com>",
          to: pm.email,
          subject: `Daily Summary: $${totalCollected.toFixed(2)} collected (${payments.length} payment${payments.length !== 1 ? "s" : ""})`,
          html,
        });
        emailsSent++;
      } catch (err) {
        console.error("[daily-summary] Email failed for", pm.email, err);
      }
    }

    notify({
      userId: pm.id,
      createdById: pm.id,
      type: "DAILY_SUMMARY",
      title: "Daily Payment Summary",
      message: `${payments.length} payment${payments.length !== 1 ? "s" : ""} received today totaling $${totalCollected.toFixed(2)}.`,
      severity: "info",
      amount: totalCollected,
      actionUrl: "/dashboard/payments",
    }).catch(console.error);
  }

  return {
    summary: {
      pmsChecked: pms.length,
      emailsSent,
    },
  };
});

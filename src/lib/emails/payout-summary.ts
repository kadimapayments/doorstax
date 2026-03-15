import { getResend } from "@/lib/email";
import { emailStyles, emailHeader, emailFooter } from "./_layout";

interface PayoutRow {
  ownerName: string;
  grossRent: number;
  netPayout: number;
  status: string;
}

export async function sendPayoutSummaryEmail(opts: {
  pmEmail: string;
  pmName: string;
  companyName: string;
  period: string;
  payouts: PayoutRow[];
  totalGross: number;
  totalNet: number;
  dashboardUrl: string;
}) {
  const {
    pmEmail,
    pmName,
    companyName,
    period,
    payouts,
    totalGross,
    totalNet,
    dashboardUrl,
  } = opts;

  const fmt = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const rows = payouts
    .map(
      (p) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;">${p.ownerName}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;text-align:right;">${fmt(p.grossRent)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;text-align:right;font-weight:600;">${fmt(p.netPayout)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;text-align:center;">
          <span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:9999px;font-size:12px;">${p.status}</span>
        </td>
      </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .summary-table { width:100%; border-collapse:collapse; margin:20px 0; }
    .summary-table th { padding:10px 12px; background:#f8fafc; border-bottom:2px solid #e2e8f0; text-align:left; font-size:13px; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; }
    .summary-table th:nth-child(2), .summary-table th:nth-child(3) { text-align:right; }
    .summary-table th:nth-child(4) { text-align:center; }
    .totals-row td { font-weight:700; border-top:2px solid #e2e8f0; padding:10px 12px; font-size:14px; }
    .stats { display:flex; gap:16px; margin:20px 0; }
    .stat-card { flex:1; background:#f8fafc; border-radius:8px; padding:16px; text-align:center; }
    .stat-value { font-size:24px; font-weight:700; color:#1e293b; }
    .stat-label { font-size:12px; color:#64748b; margin-top:4px; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>Monthly Payout Summary</h1>
      <p>Hi ${pmName},</p>
      <p><strong>${payouts.length}</strong> draft payout${payouts.length !== 1 ? "s" : ""} have been automatically generated for <strong>${period}</strong>. Please review and approve them in your dashboard.</p>

      <table style="width:100%;border-collapse:collapse;margin:20px 0;" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:33%;padding:12px;background:#f0fdf4;border-radius:8px 0 0 8px;text-align:center;">
            <div style="font-size:12px;color:#64748b;">Total Gross</div>
            <div style="font-size:20px;font-weight:700;color:#16a34a;">${fmt(totalGross)}</div>
          </td>
          <td style="width:33%;padding:12px;background:#f8fafc;text-align:center;">
            <div style="font-size:12px;color:#64748b;">Total Fees</div>
            <div style="font-size:20px;font-weight:700;color:#dc2626;">${fmt(totalGross - totalNet)}</div>
          </td>
          <td style="width:33%;padding:12px;background:#eff6ff;border-radius:0 8px 8px 0;text-align:center;">
            <div style="font-size:12px;color:#64748b;">Total Net</div>
            <div style="font-size:20px;font-weight:700;color:#2563eb;">${fmt(totalNet)}</div>
          </td>
        </tr>
      </table>

      <table class="summary-table" cellpadding="0" cellspacing="0">
        <thead>
          <tr>
            <th>Owner</th>
            <th>Gross Rent</th>
            <th>Net Payout</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="totals-row">
            <td style="padding:10px 12px;">Total (${payouts.length} owners)</td>
            <td style="padding:10px 12px;text-align:right;">${fmt(totalGross)}</td>
            <td style="padding:10px 12px;text-align:right;">${fmt(totalNet)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <div class="btn-container">
        <a href="${dashboardUrl}" class="btn">Review Payouts</a>
      </div>
      <p style="font-size:13px;color:#64748b;">Payouts are generated as drafts. Review each payout, then approve and process to distribute funds to your owners.</p>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>
  `.trim();

  await getResend().emails.send({
    from: `${companyName} via DoorStax <payouts@doorstax.com>`,
    to: pmEmail,
    subject: `${period} Payout Summary — ${payouts.length} Draft${payouts.length !== 1 ? "s" : ""} Generated`,
    html,
  });
}

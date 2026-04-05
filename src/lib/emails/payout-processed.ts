import { emailStyles, emailHeader, emailFooter } from "./_layout";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";

export function payoutProcessedHtml(opts: {
  ownerName: string;
  netPayout: string;
  periodLabel: string;
  grossRent: string;
  managementFee: string;
  processingFees: string;
  expenses: string;
  bankLast4?: string;
}) {
  const { ownerName, netPayout, periodLabel, grossRent, managementFee, processingFees, expenses, bankLast4 } = opts;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .highlight { background: #f0fdf4; }
    .highlight .value { color: #16a34a; }
    .details { background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .details table { width: 100%; border-collapse: collapse; }
    .details td { padding: 6px 0; font-size: 13px; color: #555; border-bottom: 1px solid #eee; }
    .details td:last-child { text-align: right; font-weight: 600; color: #333; }
    .details tr:last-child td { border-bottom: none; font-weight: 700; color: #16a34a; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>Payout Processed</h1>
      <p>Hi ${ownerName},</p>
      <p>Your owner payout for <strong>${periodLabel}</strong> has been processed and is on its way to your bank account.</p>
      <div class="highlight">
        <div class="label">Net Payout</div>
        <div class="value">${netPayout}</div>
      </div>
      <div class="details">
        <table>
          <tr><td>Gross Rent Collected</td><td>${grossRent}</td></tr>
          <tr><td>Management Fee</td><td>-${managementFee}</td></tr>
          <tr><td>Processing Fees</td><td>-${processingFees}</td></tr>
          <tr><td>Expenses</td><td>-${expenses}</td></tr>
          <tr><td>Net Payout</td><td>${netPayout}</td></tr>
        </table>
      </div>
      ${bankLast4 ? `<p style="font-size:13px;color:#666;">Funds will be deposited to your bank account ending in ${bankLast4} within 1–3 business days.</p>` : ""}
      <div class="btn-container">
        <a href="${BASE_URL}/owner" class="btn">View Statement</a>
      </div>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

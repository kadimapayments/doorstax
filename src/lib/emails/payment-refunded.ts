import { emailStyles, emailHeader, emailFooter, emailButton } from "./_layout";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";

export function paymentRefundedHtml(opts: {
  tenantName: string;
  amount: string;
  originalDate: string;
  refundDate: string;
  paymentMethod: string;
  propertyName: string;
  reason?: string;
}) {
  const { tenantName, amount, originalDate, refundDate, paymentMethod, propertyName, reason } = opts;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .highlight { background: #eff6ff; }
    .highlight .value { color: #2563eb; }
    .details { background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .details table { width: 100%; border-collapse: collapse; }
    .details td { padding: 6px 0; font-size: 13px; color: #555; }
    .details td:last-child { text-align: right; font-weight: 600; color: #333; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>Payment Refunded</h1>
      <p>Hi ${tenantName},</p>
      <p>A refund has been issued for your recent payment.</p>
      <div class="highlight">
        <div class="label">Refund Amount</div>
        <div class="value">${amount}</div>
      </div>
      <div class="details">
        <table>
          <tr><td>Original Payment</td><td>${originalDate}</td></tr>
          <tr><td>Refund Processed</td><td>${refundDate}</td></tr>
          <tr><td>Payment Method</td><td>${paymentMethod}</td></tr>
          <tr><td>Property</td><td>${propertyName}</td></tr>
          ${reason ? `<tr><td>Reason</td><td>${reason}</td></tr>` : ""}
        </table>
      </div>
      <p style="font-size:13px;color:#666;">Refunds typically take 5–10 business days to appear on your statement. If you have questions, contact your property manager.</p>
      ${emailButton("View Payment History", `${BASE_URL}/tenant/history`)}
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

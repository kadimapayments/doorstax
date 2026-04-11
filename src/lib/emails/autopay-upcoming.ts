import { emailStyles, emailHeader, emailFooter, emailButton } from "./_layout";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";

export function autopayUpcomingHtml(opts: {
  tenantName: string;
  amount: string;
  chargeDate: string;
  paymentMethod: string;
  propertyName: string;
  unitNumber: string;
}) {
  const { tenantName, amount, chargeDate, paymentMethod, propertyName, unitNumber } = opts;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .highlight .value { color: #5B00FF; }
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
      <h1>Upcoming Autopay Payment</h1>
      <p>Hi ${tenantName},</p>
      <p>This is a reminder that your automatic rent payment will be processed soon.</p>
      <div class="highlight">
        <div class="label">Amount</div>
        <div class="value">${amount}</div>
      </div>
      <div class="details">
        <table>
          <tr><td>Charge Date</td><td>${chargeDate}</td></tr>
          <tr><td>Payment Method</td><td>${paymentMethod}</td></tr>
          <tr><td>Property</td><td>${propertyName}</td></tr>
          <tr><td>Unit</td><td>${unitNumber}</td></tr>
        </table>
      </div>
      <p style="font-size:13px;color:#666;">If you need to make changes to your payment method or cancel autopay, please do so before the charge date.</p>
      ${emailButton("Manage Autopay", `${BASE_URL}/tenant/autopay`)}
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

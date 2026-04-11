import { emailStyles, emailHeader, emailFooter, emailButton } from "./_layout";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";

export function paymentReceivedHtml(opts: {
  tenantName: string;
  amount: string;
  paymentMethod: string;
  propertyName: string;
  date: string;
}) {
  const { tenantName, amount, paymentMethod, propertyName, date } = opts;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .highlight { background: #f0fdf4; text-align: center; }
    .highlight .value { color: #16a34a; }
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
      <h1>Payment Received</h1>
      <p>Hi ${tenantName},</p>
      <p>Your rent payment has been successfully processed.</p>
      <div class="highlight">
        <div class="label">Amount Paid</div>
        <div class="value">${amount}</div>
      </div>
      <div class="details">
        <table>
          <tr><td>Property</td><td>${propertyName}</td></tr>
          <tr><td>Payment Method</td><td>${paymentMethod}</td></tr>
          <tr><td>Date</td><td>${date}</td></tr>
        </table>
      </div>
      ${emailButton("View Payment History", `${BASE_URL}/tenant`)}
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

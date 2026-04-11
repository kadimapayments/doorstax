import { emailStyles, emailHeader, emailFooter, emailButton } from "./_layout";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";

export function paymentFailedHtml(opts: {
  tenantName: string;
  amount: string;
  reason: string;
  propertyName: string;
}) {
  const { tenantName, amount, reason, propertyName } = opts;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .alert { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center; }
    .alert .label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .alert .value { font-size: 24px; font-weight: 700; color: #dc2626; margin-top: 4px; }
    .reason { background: #f8f9fa; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #555; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>Payment Failed</h1>
      <p>Hi ${tenantName},</p>
      <p>Unfortunately, your rent payment for <strong>${propertyName}</strong> could not be processed.</p>
      <div class="alert">
        <div class="label">Amount</div>
        <div class="value">${amount}</div>
      </div>
      <div class="reason"><strong>Reason:</strong> ${reason || "The payment was declined by your financial institution."}</div>
      <p>Please update your payment method or try again. If the issue persists, contact your property manager.</p>
      ${emailButton("Retry Payment", `${BASE_URL}/tenant`)}
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

export function paymentFailedPmHtml(opts: {
  pmName: string;
  tenantName: string;
  amount: string;
  reason: string;
  propertyName: string;
}) {
  const { pmName, tenantName, amount, reason, propertyName } = opts;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .alert { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .alert table { width: 100%; border-collapse: collapse; }
    .alert td { padding: 6px 0; font-size: 13px; color: #555; }
    .alert td:last-child { text-align: right; font-weight: 600; color: #333; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>Tenant Payment Failed</h1>
      <p>Hi ${pmName},</p>
      <p>A tenant payment has failed and may require your attention.</p>
      <div class="alert">
        <table>
          <tr><td>Tenant</td><td>${tenantName}</td></tr>
          <tr><td>Property</td><td>${propertyName}</td></tr>
          <tr><td>Amount</td><td>${amount}</td></tr>
          <tr><td>Reason</td><td>${reason || "Declined"}</td></tr>
        </table>
      </div>
      ${emailButton("View Payments", `${BASE_URL}/dashboard/payments`)}
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

import { emailStyles, emailHeader, emailFooter, emailButton } from "./_layout";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";

export function chargebackNotificationHtml(opts: {
  pmName: string;
  tenantName: string;
  amount: string;
  transactionDate: string;
  chargebackDate: string;
  reason: string;
  propertyName: string;
  unitNumber: string;
}) {
  const { pmName, tenantName, amount, transactionDate, chargebackDate, reason, propertyName, unitNumber } = opts;
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
    .urgent { background: #dc2626; color: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; display: inline-block; margin-bottom: 8px; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <span class="urgent">Action Required</span>
      <h1>Chargeback Received</h1>
      <p>Hi ${pmName},</p>
      <p>A chargeback has been filed against a tenant payment. This requires your immediate attention.</p>
      <div class="alert">
        <table>
          <tr><td>Tenant</td><td>${tenantName}</td></tr>
          <tr><td>Amount</td><td>${amount}</td></tr>
          <tr><td>Original Transaction</td><td>${transactionDate}</td></tr>
          <tr><td>Chargeback Filed</td><td>${chargebackDate}</td></tr>
          <tr><td>Reason</td><td>${reason}</td></tr>
          <tr><td>Property</td><td>${propertyName} — Unit ${unitNumber}</td></tr>
        </table>
      </div>
      <p style="font-size:13px;color:#666;">You may need to provide documentation to contest this chargeback. Review the details in your dashboard.</p>
      ${emailButton("Review Chargeback", `${BASE_URL}/dashboard/payments`, "#dc2626")}
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

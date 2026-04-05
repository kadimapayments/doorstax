import { emailStyles, emailHeader, emailFooter } from "./_layout";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";

export function autopayPausedHtml(opts: {
  tenantName: string;
  failedAttempts: number;
  reason: string;
  propertyName: string;
  unitNumber: string;
}) {
  const { tenantName, failedAttempts, reason, propertyName, unitNumber } = opts;
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
      <h1>Autopay Has Been Paused</h1>
      <p>Hi ${tenantName},</p>
      <p>Your automatic rent payment has been paused after <strong>${failedAttempts} failed attempt${failedAttempts !== 1 ? "s" : ""}</strong>.</p>
      <div class="alert">
        <table>
          <tr><td>Last Error</td><td>${reason}</td></tr>
          <tr><td>Property</td><td>${propertyName} — Unit ${unitNumber}</td></tr>
        </table>
      </div>
      <p>To resume autopay, please update your payment method and re-enable automatic payments.</p>
      <div class="btn-container">
        <a href="${BASE_URL}/tenant/autopay" class="btn">Update Payment Method</a>
      </div>
      <p style="font-size:12px;color:#999;">You will need to pay rent manually until autopay is re-enabled.</p>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

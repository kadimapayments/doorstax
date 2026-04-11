import { emailStyles, emailHeader, emailFooter, emailButton } from "./_layout";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";

export function autopayEnrollmentHtml(opts: {
  tenantName: string;
  rentAmount: string;
  propertyName: string;
  unitNumber: string;
}) {
  const { tenantName, rentAmount, propertyName, unitNumber } = opts;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .benefits { margin: 20px 0; }
    .benefits li { font-size: 14px; color: #555; margin-bottom: 8px; line-height: 1.5; }
    .benefits li strong { color: #333; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>Never Miss a Payment</h1>
      <p>Hi ${tenantName},</p>
      <p>Set up automatic rent payments for ${propertyName} — Unit ${unitNumber} and never worry about missing a due date.</p>
      <div class="highlight">
        <div class="label">Monthly Rent</div>
        <div class="value">${rentAmount}</div>
      </div>
      <div class="benefits">
        <ul style="padding-left:20px;">
          <li><strong>Automatic:</strong> Payment processed on your due date each month</li>
          <li><strong>Flexible:</strong> Choose card or bank transfer</li>
          <li><strong>Cancel anytime:</strong> Disable autopay from your dashboard</li>
          <li><strong>Reminders:</strong> Get notified before each charge</li>
        </ul>
      </div>
      ${emailButton("Enable Autopay", `${BASE_URL}/tenant/autopay`)}
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

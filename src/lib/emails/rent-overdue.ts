import { emailStyles, emailHeader, emailFooter, emailButton } from "./_layout";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";

export function rentOverdueHtml(opts: {
  tenantName: string;
  amount: string;
  dueDate: string;
  daysLate: number;
  propertyName: string;
  unitNumber: string;
  lateFee?: string;
}) {
  const { tenantName, amount, dueDate, daysLate, propertyName, unitNumber, lateFee } = opts;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .alert { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .alert .value { color: #dc2626; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>Overdue Rent Notice</h1>
      <p>Hi ${tenantName},</p>
      <p>Your rent payment is <strong>${daysLate} day${daysLate !== 1 ? "s" : ""} past due</strong>. Please make your payment as soon as possible to avoid additional fees.</p>
      <div class="alert">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px 0;font-size:13px;color:#555;">Amount Due</td><td style="padding:6px 0;font-size:13px;text-align:right;font-weight:600;color:#dc2626;">${amount}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#555;">Due Date</td><td style="padding:6px 0;font-size:13px;text-align:right;font-weight:600;color:#333;">${dueDate}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#555;">Days Late</td><td style="padding:6px 0;font-size:13px;text-align:right;font-weight:600;color:#dc2626;">${daysLate}</td></tr>
          ${lateFee ? `<tr><td style="padding:6px 0;font-size:13px;color:#555;">Late Fee</td><td style="padding:6px 0;font-size:13px;text-align:right;font-weight:600;color:#dc2626;">${lateFee}</td></tr>` : ""}
          <tr><td style="padding:6px 0;font-size:13px;color:#555;">Property</td><td style="padding:6px 0;font-size:13px;text-align:right;font-weight:600;color:#333;">${propertyName} — Unit ${unitNumber}</td></tr>
        </table>
      </div>
      ${emailButton("Pay Now", `${BASE_URL}/tenant/pay`, "#dc2626")}
      <p style="font-size:12px;color:#999;">If you believe this is an error or need to discuss payment arrangements, please contact your property manager.</p>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

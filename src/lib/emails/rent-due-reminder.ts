import { emailStyles, emailHeader, emailFooter } from "./_layout";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";

export function rentDueReminderHtml(opts: {
  tenantName: string;
  amount: string;
  dueDate: string;
  propertyName: string;
  unitNumber: string;
}) {
  const { tenantName, amount, dueDate, propertyName, unitNumber } = opts;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .highlight { background: #fff7ed; }
    .highlight .value { color: #ea580c; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>Rent Payment Reminder</h1>
      <p>Hi ${tenantName},</p>
      <p>This is a friendly reminder that your rent payment is coming up.</p>
      <div class="highlight">
        <div class="label">Amount Due</div>
        <div class="value">${amount}</div>
      </div>
      <div class="highlight" style="background:#f8f9fa;">
        <table>
          <tr><td>Property</td><td>${propertyName}</td></tr>
          <tr><td>Unit</td><td>${unitNumber}</td></tr>
          <tr><td>Due Date</td><td>${dueDate}</td></tr>
        </table>
      </div>
      <div class="btn-container">
        <a href="${BASE_URL}/tenant/pay" class="btn">Pay Now</a>
      </div>
      <p style="font-size:12px;color:#999;text-align:center;">If you've already paid or have autopay enabled, please disregard this reminder.</p>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

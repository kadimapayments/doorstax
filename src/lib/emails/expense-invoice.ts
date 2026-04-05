import { emailStyles, emailHeader, emailFooter } from "./_layout";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";

export function expenseInvoiceHtml(opts: {
  tenantName: string;
  amount: string;
  description: string;
  category: string;
  propertyName: string;
  unitNumber: string;
  dueDate: string;
}) {
  const { tenantName, amount, description, category, propertyName, unitNumber, dueDate } = opts;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .invoice { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .invoice .value { color: #ea580c; }
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
      <h1>New Charge on Your Account</h1>
      <p>Hi ${tenantName},</p>
      <p>Your property manager has added a charge to your account.</p>
      <div class="invoice">
        <div class="label" style="font-size:12px;color:#888;text-transform:uppercase;">Amount Due</div>
        <div class="value" style="font-size:24px;font-weight:700;margin-top:4px;">${amount}</div>
      </div>
      <div class="details" style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0;">
        <table>
          <tr><td>Description</td><td>${description}</td></tr>
          <tr><td>Category</td><td style="text-transform:capitalize;">${category.toLowerCase().replace("_", " ")}</td></tr>
          <tr><td>Property</td><td>${propertyName}${unitNumber ? " — Unit " + unitNumber : ""}</td></tr>
          <tr><td>Due By</td><td>${dueDate}</td></tr>
        </table>
      </div>
      <div class="btn-container" style="text-align:center;margin:24px 0;">
        <a href="${BASE_URL}/tenant/pay" class="btn">Pay Now</a>
      </div>
      <p style="font-size:12px;color:#999;">If you have questions about this charge, please contact your property manager.</p>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

import { emailStyles, emailHeader, emailFooter } from "./_layout";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";

export function leaseExpirationHtml(opts: {
  recipientName: string;
  propertyName: string;
  unitNumber: string;
  endDate: string;
  daysRemaining: number;
  rentAmount: string;
  role: "pm" | "tenant";
}) {
  const { recipientName, propertyName, unitNumber, endDate, daysRemaining, rentAmount, role } = opts;

  const urgencyColor = daysRemaining <= 7 ? "#dc2626" : daysRemaining <= 14 ? "#d97706" : "#5B00FF";
  const urgencyLabel = daysRemaining <= 7 ? "Urgent" : daysRemaining <= 14 ? "Action Needed" : "Upcoming Expiration";

  const ctaHref = role === "pm" ? `${BASE_URL}/dashboard/leases` : `${BASE_URL}/tenant/leases`;
  const ctaLabel = role === "pm" ? "View Leases" : "View Lease Details";

  const bodyText = role === "pm"
    ? `The lease for <strong>${propertyName} - Unit ${unitNumber}</strong> is expiring in <strong>${daysRemaining} days</strong>. Please review and take action — renew, amend, or prepare for turnover.`
    : `Your lease at <strong>${propertyName} - Unit ${unitNumber}</strong> is expiring in <strong>${daysRemaining} days</strong>. Please contact your property manager to discuss renewal options.`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .highlight { text-align: center; }
    .highlight .value { color: ${urgencyColor}; }
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
      <h1>${urgencyLabel}: Lease Expiring Soon</h1>
      <p>Hi ${recipientName},</p>
      <p>${bodyText}</p>
      <div class="highlight">
        <div class="label">Days Remaining</div>
        <div class="value">${daysRemaining}</div>
      </div>
      <div class="details">
        <table>
          <tr><td>Property</td><td>${propertyName}</td></tr>
          <tr><td>Unit</td><td>${unitNumber}</td></tr>
          <tr><td>Lease End Date</td><td>${endDate}</td></tr>
          <tr><td>Monthly Rent</td><td>${rentAmount}</td></tr>
        </table>
      </div>
      <div class="btn-container">
        <a href="${ctaHref}" class="btn">${ctaLabel}</a>
      </div>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

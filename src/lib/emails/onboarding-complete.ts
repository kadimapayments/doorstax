import { emailStyles, emailHeader, emailFooter, emailButton } from "./_layout";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";

export function onboardingCompleteHtml(opts: {
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  hasPaymentMethod: boolean;
  roommateRequestCount: number;
  landlordName: string;
  tenantProfileId: string;
}) {
  const {
    tenantName,
    propertyName,
    unitNumber,
    hasPaymentMethod,
    roommateRequestCount,
    landlordName,
    tenantProfileId,
  } = opts;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .check { color: #22c55e; font-weight: 600; }
    .skip { color: #f59e0b; font-weight: 600; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>Tenant Onboarding Complete</h1>
      <p>Hi ${landlordName},</p>
      <p><strong>${tenantName}</strong> has completed their onboarding and is now set up on DoorStax.</p>
      <div class="highlight">
        <table>
          <tr><td>Property</td><td>${propertyName}</td></tr>
          <tr><td>Unit</td><td>${unitNumber}</td></tr>
          <tr><td>Payment Method</td><td><span class="${hasPaymentMethod ? "check" : "skip"}">${hasPaymentMethod ? "✓ Stored" : "⏭ Skipped"}</span></td></tr>
          <tr><td>Roommate Requests</td><td>${roommateRequestCount > 0 ? `<span class="skip">${roommateRequestCount} pending approval</span>` : "None"}</td></tr>
        </table>
      </div>
      ${roommateRequestCount > 0 ? `<p>There are <strong>${roommateRequestCount} roommate request(s)</strong> awaiting your approval. Please review them from your dashboard.</p>` : ""}
      ${emailButton("View Tenants", `${BASE_URL}/dashboard/tenants`)}
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

import { emailStyles, emailHeader, emailFooter, emailButton } from "./_layout";

export function tenantInviteHtml(opts: {
  propertyName: string;
  unitName: string;
  inviteUrl: string;
  landlordName: string;
  tenantName?: string;
}) {
  const { propertyName, unitName, inviteUrl, landlordName, tenantName } = opts;
  const greeting = tenantName ? `Hi ${tenantName},` : "Hi there,";
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .btn { padding: 14px 40px; font-size: 16px; }
    .btn-container { margin: 28px 0; }
    .note { font-size: 12px; color: #999; text-align: center; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>You're Invited!</h1>
      <p>${greeting}</p>
      <p><strong>${landlordName}</strong> has invited you to set up your tenant portal on DoorStax.</p>
      <div class="highlight">
        <table>
          <tr><td>Property</td><td>${propertyName}</td></tr>
          <tr><td>Unit</td><td>${unitName}</td></tr>
        </table>
      </div>
      <p>With DoorStax you can pay rent online, view your lease details, and communicate directly with your property manager.</p>
      ${emailButton("Accept Invitation", inviteUrl)}
      <p class="note">This invitation expires in 72 hours.</p>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

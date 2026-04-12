import {
  emailStyles,
  emailHeader,
  emailFooter,
  emailButton,
  esc,
} from "./_layout";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";

export function teamInviteEmail(data: {
  recipientName?: string;
  pmName: string;
  pmCompany?: string;
  role: string;
  propertyNames?: string[];
}): string {
  const { recipientName, pmName, pmCompany, role, propertyNames } = data;
  const greeting = recipientName
    ? `Hi ${esc(recipientName)},`
    : "Hi there,";
  const from = pmCompany
    ? `<strong>${esc(pmName)}</strong> at ${esc(pmCompany)}`
    : `<strong>${esc(pmName)}</strong>`;
  const accessLine =
    propertyNames && propertyNames.length > 0
      ? `You'll have access to: <strong>${propertyNames.map(esc).join(", ")}</strong>`
      : "You'll have access to <strong>all properties</strong>";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .role-card { background: linear-gradient(135deg, #5B00FF 0%, #7C3AFF 100%); border-radius: 10px; padding: 16px 20px; margin: 20px 0; text-align: center; }
    .role-card h3 { color: #ffffff; font-size: 16px; margin: 0 0 4px; font-weight: 700; }
    .role-card p { color: rgba(255,255,255,0.85); font-size: 13px; margin: 0; }
    .note { font-size: 12px; color: #999; text-align: center; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>You've Been Invited to Join a Team</h1>
      <p>${greeting}</p>
      <p>${from} has invited you to join their team on DoorStax as a <strong>${esc(role)}</strong>.</p>

      <div class="role-card">
        <h3>${esc(role)}</h3>
        <p>${accessLine}</p>
      </div>

      <p>With DoorStax you can help manage properties, tenants, leases, and maintenance — all from one dashboard.</p>

      ${emailButton("Accept Invitation", `${BASE_URL}/login`)}

      <p class="note">
        DoorStax is a property management platform. This invitation gives
        you access to manage properties on behalf of ${esc(pmName)}.
      </p>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

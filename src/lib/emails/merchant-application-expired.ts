import {
  emailStyles,
  emailHeader,
  emailFooter,
  emailButton,
  esc,
} from "./_layout";

export function merchantApplicationExpiredEmail(data: {
  pmName: string;
  supportUrl?: string;
}): string {
  const { pmName, supportUrl } = data;
  const supportLink = supportUrl || "mailto:support@doorstax.com";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .alert { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 16px; margin: 0 0 20px; font-size: 13px; color: #991b1b; }
    .note { font-size: 12px; color: #999; text-align: center; margin-top: 16px; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>Merchant Application Expired</h1>
      <p>Hi ${esc(pmName)},</p>
      <div class="alert">
        Your merchant application was not completed within the 30-day
        window and has expired.
      </div>
      <p>
        To start accepting payments on DoorStax, you'll need to begin a new
        application. Our team can help you get set up quickly and answer
        any questions you have about what's required.
      </p>
      <p>
        Your DoorStax account, properties, tenants, and data are still
        safe. You can continue using the platform for reporting and
        management \u2014 payment processing will resume as soon as a new
        application is approved.
      </p>

      ${emailButton("Contact Support", supportLink)}

      <p class="note">
        If you believe this is an error, please reach out to our team.
      </p>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

import { emailStyles, emailHeader, emailFooter, emailButton } from "./_layout";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";

export function welcomePmHtml(opts: { pmName: string }) {
  const { pmName } = opts;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .steps { margin: 24px 0; }
    .step { display: flex; gap: 12px; margin-bottom: 16px; }
    .step-num { width: 28px; height: 28px; background: #5B00FF; color: white; border-radius: 50%; text-align: center; line-height: 28px; font-weight: 700; font-size: 13px; flex-shrink: 0; }
    .step-text { font-size: 14px; color: #555; line-height: 1.5; }
    .step-text strong { color: #333; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>Welcome to DoorStax!</h1>
      <p>Hi ${pmName},</p>
      <p>Your property management account has been created. Here's how to get started:</p>
      <div class="steps">
        <div class="step">
          <div class="step-num">1</div>
          <div class="step-text"><strong>Add your properties</strong> — Enter your buildings, units, and rent amounts.</div>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <div class="step-text"><strong>Complete merchant setup</strong> — Apply for payment processing so tenants can pay online.</div>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <div class="step-text"><strong>Invite your tenants</strong> — Send email invitations so tenants can create their portal accounts.</div>
        </div>
        <div class="step">
          <div class="step-num">4</div>
          <div class="step-text"><strong>Collect rent</strong> — Tenants pay via card or bank transfer. You track everything from your dashboard.</div>
        </div>
      </div>
      ${emailButton("Go to Dashboard", `${BASE_URL}/dashboard`)}
      <p style="font-size:12px;color:#999;text-align:center;">Need help? Visit our <a href="${BASE_URL}/dashboard/help" style="color:#5B00FF;">Help Center</a> or contact support.</p>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

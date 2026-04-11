import { emailStyles, emailHeader, emailFooter, emailButton } from "./_layout";

export function applicationVerificationEmail(data: {
  propertyName: string;
  unitName: string;
  applyLink: string;
  expiresIn: string;
}): string {
  const { propertyName, unitName, applyLink, expiresIn } = data;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .property-card { background: linear-gradient(135deg, #5B00FF 0%, #7C3AFF 100%); border-radius: 10px; padding: 16px 20px; margin: 20px 0; text-align: center; }
    .property-card h3 { color: #ffffff; font-size: 16px; margin: 0 0 4px 0; font-weight: 700; }
    .property-card p { color: rgba(255,255,255,0.85); font-size: 13px; margin: 0; }
    .btn { padding: 14px 40px; font-size: 16px; }
    .btn-container { margin: 28px 0; }
    .expiry { font-size: 12px; color: #999; text-align: center; margin-top: 16px; }
    .security { font-size: 11px; color: #bbb; text-align: center; margin-top: 12px; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>Your Application Link</h1>
      <p>You requested to apply for:</p>

      <div class="property-card">
        <h3>${propertyName}</h3>
        <p>${unitName}</p>
      </div>

      <p>Click the button below to access the application form and complete your rental application.</p>

      ${emailButton("Start Application", applyLink)}

      <p class="expiry">This link expires in ${expiresIn} and can only be used once.</p>
      <p class="security">If you didn't request this, you can safely ignore this email.</p>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

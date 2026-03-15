import { emailStyles, emailHeader, emailFooter } from "./_layout";

export function twoFactorCodeHtml(opts: { name: string; code: string }) {
  const { name, code } = opts;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .code-box { text-align: center; background: #f8f6ff; border-radius: 8px; padding: 24px; margin: 24px 0; }
    .code-box .label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .code-box .code { font-size: 32px; font-weight: 700; color: #5B00FF; letter-spacing: 8px; margin-top: 8px; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>Your Verification Code</h1>
      <p>Hi ${name},</p>
      <p>Enter this code to complete your sign-in:</p>
      <div class="code-box">
        <div class="label">Verification Code</div>
        <div class="code">${code}</div>
      </div>
      <p>This code expires in 10 minutes. If you did not attempt to log in, please ignore this email or contact support.</p>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

import { emailStyles, emailHeader, emailFooter } from "./_layout";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";

export function passwordResetHtml(opts: { name: string; resetUrl: string }) {
  const { name, resetUrl } = opts;
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
      <h1>Reset Your Password</h1>
      <p>Hi ${name},</p>
      <p>We received a request to reset your DoorStax password. Click the button below to set a new password:</p>
      <div class="btn-container">
        <a href="${resetUrl}" class="btn">Reset Password</a>
      </div>
      <p class="note">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      <p style="font-size:12px;color:#999;word-break:break-all;">If the button doesn't work, copy and paste this URL: ${resetUrl}</p>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

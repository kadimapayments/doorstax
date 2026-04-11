import { getResend } from "@/lib/email";
import { emailStyles, emailHeader, emailFooter, emailButton } from "./_layout";

export async function sendOwnerStatement(opts: {
  ownerEmail: string;
  ownerName: string;
  period: string;
  statementUrl: string;
  companyName: string;
  netPayout: string;
}) {
  const { ownerEmail, ownerName, period, statementUrl, companyName, netPayout } = opts;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .highlight { text-align: center; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>Owner Payout Statement</h1>
      <p>Hi ${ownerName},</p>
      <p>Your payout statement for <strong>${period}</strong> is ready. Here's a summary of your distribution from ${companyName}.</p>
      <div class="highlight">
        <div class="label">Net Payout</div>
        <div class="value">${netPayout}</div>
      </div>
      ${emailButton("View Statement", statementUrl)}
      <p>You can also view all your statements in your owner portal at any time.</p>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>
  `.trim();

  await getResend().emails.send({
    from: `${companyName} via DoorStax <statements@doorstax.com>`,
    to: ownerEmail,
    subject: `Your ${period} Owner Payout Statement`,
    html,
  });
}

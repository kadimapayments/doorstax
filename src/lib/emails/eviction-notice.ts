import { emailStyles, emailHeader, emailFooter } from "./_layout";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";

export function evictionNoticeHtml(opts: {
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  reason: string;
  reasonDetails?: string;
  noticeType?: string;
  noticeDays?: number;
  outstandingBalance?: string;
  cureDeadline?: string;
}) {
  const { tenantName, propertyName, unitNumber, reason, reasonDetails, noticeType, noticeDays, outstandingBalance, cureDeadline } = opts;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .urgent-banner { background: #dc2626; color: white; padding: 12px 16px; border-radius: 8px; text-align: center; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px; }
    .alert { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .alert table { width: 100%; border-collapse: collapse; }
    .alert td { padding: 8px 0; font-size: 13px; color: #555; border-bottom: 1px solid #fee2e2; }
    .alert td:last-child { text-align: right; font-weight: 600; color: #333; }
    .alert tr:last-child td { border-bottom: none; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <div class="urgent-banner">Eviction Notice</div>
      <p>Dear ${tenantName},</p>
      <p>This is to notify you that an eviction proceeding has been initiated for your unit.</p>
      <div class="alert">
        <table>
          <tr><td>Property</td><td>${propertyName} — Unit ${unitNumber}</td></tr>
          <tr><td>Reason</td><td style="text-transform:capitalize;">${reason.toLowerCase()}</td></tr>
          ${reasonDetails ? `<tr><td>Details</td><td>${reasonDetails}</td></tr>` : ""}
          ${noticeType ? `<tr><td>Notice Type</td><td style="text-transform:capitalize;">${noticeType.toLowerCase()}</td></tr>` : ""}
          ${noticeDays ? `<tr><td>Notice Period</td><td>${noticeDays} days</td></tr>` : ""}
          ${cureDeadline ? `<tr><td>Cure Deadline</td><td style="color:#dc2626;font-weight:700;">${cureDeadline}</td></tr>` : ""}
          ${outstandingBalance ? `<tr><td>Outstanding Balance</td><td style="color:#dc2626;font-weight:700;">${outstandingBalance}</td></tr>` : ""}
        </table>
      </div>
      <p>Please contact your property manager immediately to discuss this matter. If the issue can be resolved during the notice period, the eviction may be cancelled.</p>
      <div class="btn-container" style="text-align:center;margin:24px 0;">
        <a href="${BASE_URL}/tenant" class="btn" style="background:#dc2626;">View Your Account</a>
      </div>
      <p style="font-size:12px;color:#999;">This is an automated notification from the DoorStax platform. This email does not constitute legal advice. For questions about your rights, consult a qualified attorney in your jurisdiction.</p>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

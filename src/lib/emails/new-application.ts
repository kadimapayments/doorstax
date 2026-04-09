import { emailStyles, emailHeader, emailFooter } from "./_layout";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";

export function newApplicationEmail(data: {
  pmName: string;
  applicantName: string;
  applicantEmail?: string;
  applicantPhone?: string;
  propertyName: string;
  unitName: string;
  submittedAt: string;
}): string {
  const { pmName, applicantName, applicantEmail, applicantPhone, propertyName, unitName, submittedAt } = data;

  const contactLines: string[] = [];
  if (applicantEmail) contactLines.push(`<tr><td style="padding:4px 0;font-size:13px;color:rgba(255,255,255,0.7)">Email</td><td style="padding:4px 0;font-size:13px;color:#fff;text-align:right">${applicantEmail}</td></tr>`);
  if (applicantPhone) contactLines.push(`<tr><td style="padding:4px 0;font-size:13px;color:rgba(255,255,255,0.7)">Phone</td><td style="padding:4px 0;font-size:13px;color:#fff;text-align:right">${applicantPhone}</td></tr>`);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .applicant-card { background: linear-gradient(135deg, #5B00FF 0%, #7C3AFF 100%); border-radius: 10px; padding: 20px; margin: 20px 0; }
    .applicant-card h3 { color: #ffffff; font-size: 18px; margin: 0 0 8px 0; font-weight: 700; }
    .applicant-card table { width: 100%; border-collapse: collapse; }
    .btn { padding: 14px 40px; font-size: 16px; }
    .btn-container { margin: 28px 0; }
    .meta { font-size: 12px; color: #999; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>New Application Received</h1>
      <p>Hi ${pmName},</p>
      <p>A new rental application has been submitted for your review.</p>

      <div class="applicant-card">
        <h3>${applicantName}</h3>
        <table>
          ${contactLines.join("")}
        </table>
      </div>

      <div class="highlight">
        <table>
          <tr><td>Property</td><td>${propertyName}</td></tr>
          <tr><td>Unit</td><td>${unitName}</td></tr>
          <tr><td>Submitted</td><td>${submittedAt}</td></tr>
        </table>
      </div>

      <div class="btn-container">
        <a href="${BASE_URL}/dashboard/applications" class="btn">Review Application</a>
      </div>

      <p class="meta">You can review, approve, or deny this application from your dashboard.</p>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

import { emailStyles, emailHeader, emailFooter, emailButton } from "./_layout";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";

export function screeningCompleteHtml(opts: {
  pmName: string;
  applicantName: string;
  propertyName: string;
}) {
  const { pmName, applicantName, propertyName } = opts;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles()}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>Screening Results Ready</h1>
      <p>Hi ${pmName},</p>
      <p>The tenant screening for <strong>${applicantName}</strong> has been completed and results are now available.</p>
      <div class="highlight">
        <table>
          <tr><td>Applicant</td><td>${applicantName}</td></tr>
          <tr><td>Property</td><td>${propertyName}</td></tr>
        </table>
      </div>
      ${emailButton("View Results", `${BASE_URL}/dashboard/screening`)}
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

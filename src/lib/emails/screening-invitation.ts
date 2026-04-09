import { emailStyles, emailHeader, emailFooter } from "./_layout";

export function screeningInvitationEmail(data: {
  propertyName: string;
  unitName: string;
  pmName: string;
  pmCompany?: string;
  applyLink: string;
  screeningIncludes: string[];
  payerType: "landlord" | "renter";
}): string {
  const {
    propertyName,
    unitName,
    pmName,
    pmCompany,
    applyLink,
    screeningIncludes,
    payerType,
  } = data;

  const senderLabel = pmCompany || pmName;
  const payerNote =
    payerType === "landlord"
      ? "There is no cost to you for this screening."
      : "A small screening fee will be collected during the application process.";

  const includesList = screeningIncludes
    .map(
      (item) =>
        `<li style="padding:4px 0;font-size:13px;color:#555;">${item}</li>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .property-card { background: linear-gradient(135deg, #5B00FF 0%, #7C3AFF 100%); border-radius: 10px; padding: 20px; margin: 20px 0; text-align: center; }
    .property-card h3 { color: #ffffff; font-size: 16px; margin: 0 0 4px 0; font-weight: 700; }
    .property-card p { color: rgba(255,255,255,0.85); font-size: 13px; margin: 0; }
    .includes-list { list-style: none; padding: 0; margin: 0; }
    .includes-list li { padding-left: 20px; position: relative; }
    .includes-list li::before { content: "\\2713"; position: absolute; left: 0; color: #5B00FF; font-weight: 700; }
    .btn { padding: 14px 40px; font-size: 16px; }
    .btn-container { margin: 28px 0; }
    .payer-note { background: #f0fdf4; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #166534; margin: 16px 0; }
    .payer-note.renter { background: #fef3c7; color: #92400e; }
    .unique-note { font-size: 11px; color: #999; text-align: center; margin-top: 16px; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>You've Been Invited to Apply</h1>
      <p><strong>${senderLabel}</strong> has invited you to complete a tenant screening application for:</p>

      <div class="property-card">
        <h3>${propertyName}</h3>
        <p>${unitName}</p>
      </div>

      ${
        screeningIncludes.length > 0
          ? `
      <p style="font-size:13px;font-weight:600;color:#333;margin-bottom:8px;">This screening includes:</p>
      <ul class="includes-list">
        ${includesList}
      </ul>`
          : ""
      }

      <div class="payer-note${payerType === "renter" ? " renter" : ""}">
        ${payerNote}
      </div>

      <div class="btn-container">
        <a href="${applyLink}" class="btn">Start Application</a>
      </div>

      <p class="unique-note">This link is unique to your application. Do not share it with others.</p>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

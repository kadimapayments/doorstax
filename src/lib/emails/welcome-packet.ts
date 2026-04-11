import { emailStyles, emailHeader, emailFooter, emailButton, esc } from "./_layout";

export function welcomePacketHtml(opts: {
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  landlordName: string;
  subject: string;
  body: string;
  dashboardUrl: string;
}) {
  const {
    tenantName,
    propertyName,
    unitNumber,
    landlordName,
    body,
    dashboardUrl,
  } = opts;

  // Convert plain text body to HTML paragraphs. The body is PM-provided
  // free text, so every value is HTML-escaped before being wrapped in
  // structural tags to prevent injection.
  const bodyHtml = String(body || "")
    .split("\n\n")
    .map((paragraph) => {
      const lines = paragraph.split("\n");
      if (lines.some((l) => l.trim().startsWith("- "))) {
        const listItems = lines
          .filter((l) => l.trim().startsWith("- "))
          .map((l) => `<li>${esc(l.trim().substring(2))}</li>`)
          .join("");
        return `<ul style="margin:8px 0;padding-left:24px;color:#333;">${listItems}</ul>`;
      }
      const escaped = esc(paragraph).replace(/\n/g, "<br>");
      return `<p>${escaped}</p>`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .welcome-body { font-size: 14px; line-height: 1.7; color: #333; }
    .welcome-body p { margin: 12px 0; }
    .welcome-body ul { margin: 8px 0; }
    .welcome-body li { margin: 4px 0; }
    .btn { padding: 14px 40px; font-size: 16px; }
    .btn-container { margin: 28px 0; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>Welcome Home!</h1>
      <p>Hi ${esc(tenantName)},</p>
      <div class="highlight">
        <table>
          <tr><td>Property</td><td>${esc(propertyName)}</td></tr>
          <tr><td>Unit</td><td>${esc(unitNumber)}</td></tr>
          <tr><td>Managed by</td><td>${esc(landlordName)}</td></tr>
        </table>
      </div>
      <div class="welcome-body">
        ${bodyHtml}
      </div>
      ${emailButton("Open Tenant Portal", dashboardUrl)}
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

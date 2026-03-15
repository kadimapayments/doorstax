import { getResend } from "@/lib/email";
import { emailStyles, emailHeader, emailFooter } from "./_layout";

export async function sendNewLeadEmail(opts: {
  adminEmail?: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  company: string;
  buildings?: number | null;
  units?: number | null;
  dashboardUrl: string;
}) {
  const {
    adminEmail,
    leadName,
    leadEmail,
    leadPhone,
    company,
    buildings,
    units,
    dashboardUrl,
  } = opts;

  const to = adminEmail || process.env.ADMIN_EMAIL || "admin@doorstax.com";

  const detailRows = [
    { label: "Name", value: leadName },
    { label: "Email", value: leadEmail },
    { label: "Phone", value: leadPhone },
    { label: "Company", value: company },
    ...(buildings ? [{ label: "Buildings", value: String(buildings) }] : []),
    ...(units ? [{ label: "Units", value: String(units) }] : []),
  ]
    .map(
      (r) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;color:#888;width:120px;">${r.label}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;color:#333;font-weight:500;">${r.value}</td>
      </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .lead-table { width:100%; border-collapse:collapse; margin:20px 0; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>New Lead Submission</h1>
      <p>A new lead has been submitted through the DoorStax website.</p>

      <div class="highlight">
        <table class="lead-table" cellpadding="0" cellspacing="0">
          <tbody>
            ${detailRows}
          </tbody>
        </table>
      </div>

      <div class="btn-container">
        <a href="${dashboardUrl}" class="btn">View in Dashboard</a>
      </div>
      <p style="font-size:13px;color:#64748b;">This lead was captured from the website contact form and has been saved to your CRM.</p>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>
  `.trim();

  await getResend().emails.send({
    from: "DoorStax Leads <leads@doorstax.com>",
    to,
    subject: `New Lead: ${company} — ${leadName}`,
    html,
  });
}

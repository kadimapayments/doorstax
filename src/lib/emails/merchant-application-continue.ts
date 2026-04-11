import {
  emailStyles,
  emailHeader,
  emailFooter,
  emailButton,
  esc,
} from "./_layout";

export function merchantApplicationContinueEmail(data: {
  pmName: string;
  companyName?: string;
  applicationUrl: string;
  stepsCompleted?: string;
  stepsRemaining?: string;
  isReminder?: boolean;
}): string {
  const {
    pmName,
    companyName,
    applicationUrl,
    stepsCompleted,
    stepsRemaining,
    isReminder,
  } = data;

  const headline = isReminder
    ? "Finish Your Merchant Application"
    : "Continue Your Merchant Application";

  const intro = isReminder
    ? "Your merchant application is still waiting. Complete it to start accepting rent payments from your tenants through DoorStax."
    : "Thanks for getting started with DoorStax. Your merchant application is in progress — finish it to start accepting rent payments from your tenants.";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .company { font-size: 13px; color: #666; margin: 4px 0 20px; }
    .status-card { border-radius: 8px; padding: 12px 16px; margin: 0 0 12px; font-size: 13px; }
    .status-done { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
    .status-todo { background: #fefce8; border: 1px solid #fde68a; color: #854d0e; }
    .status-label { font-weight: 600; display: block; margin-bottom: 2px; }
    .help { font-size: 12px; color: #999; text-align: center; margin-top: 16px; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>${esc(headline)}</h1>
      <p>Hi ${esc(pmName)},</p>
      ${companyName ? `<p class="company">Application for <strong>${esc(companyName)}</strong></p>` : ""}
      <p>${esc(intro)}</p>

      ${
        stepsCompleted
          ? `<div class="status-card status-done">
              <span class="status-label">\u2713 Completed</span>
              ${esc(stepsCompleted)}
            </div>`
          : ""
      }
      ${
        stepsRemaining
          ? `<div class="status-card status-todo">
              <span class="status-label">Remaining</span>
              ${esc(stepsRemaining)}
            </div>`
          : ""
      }

      <p style="margin-top:20px;">
        Click below to continue where you left off. The application takes
        about 10\u201315 minutes to complete.
      </p>

      ${emailButton("Continue Application", applicationUrl)}

      <p class="help">
        This link is unique to your application. Do not share it with others.
      </p>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

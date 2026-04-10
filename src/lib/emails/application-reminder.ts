import { emailStyles, emailHeader, emailFooter } from "./_layout";

export function applicationReminderEmail(data: {
  propertyName: string;
  unitName: string;
  applyLink: string;
  reminderNumber: number;
  isLastReminder: boolean;
}): string {
  const { propertyName, unitName, applyLink, reminderNumber, isLastReminder } = data;

  let heading: string;
  let bodyText: string;
  let urgencyNote: string;

  if (isLastReminder) {
    heading = "Last Chance — Complete Your Application";
    bodyText = `Your application link for <strong>${propertyName} \u2014 ${unitName}</strong> expires soon.`;
    urgencyNote = "Complete your application now or this opportunity may pass. Other applicants are likely applying.";
  } else if (reminderNumber === 1) {
    heading = "Complete Your Application";
    bodyText = `You started an application for <strong>${propertyName} \u2014 ${unitName}</strong> but haven't finished yet.`;
    urgencyNote = "The unit is still available \u2014 pick up where you left off.";
  } else {
    heading = "Still Interested?";
    bodyText = `Your application for <strong>${propertyName} \u2014 ${unitName}</strong> is still waiting.`;
    urgencyNote = "Other applicants may be applying \u2014 don't miss out.";
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .property-card { background: linear-gradient(135deg, #5B00FF 0%, #7C3AFF 100%); border-radius: 10px; padding: 16px 20px; margin: 20px 0; text-align: center; }
    .property-card h3 { color: #ffffff; font-size: 16px; margin: 0 0 4px 0; font-weight: 700; }
    .property-card p { color: rgba(255,255,255,0.85); font-size: 13px; margin: 0; }
    .btn { padding: 14px 40px; font-size: 16px; }
    .btn-container { margin: 28px 0; }
    .urgency { background: ${isLastReminder ? "#fef3c7" : "#f0f9ff"}; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: ${isLastReminder ? "#92400e" : "#1e40af"}; margin: 16px 0; }
    .opt-out { font-size: 11px; color: #bbb; text-align: center; margin-top: 16px; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>${heading}</h1>
      <p>${bodyText}</p>

      <div class="property-card">
        <h3>${propertyName}</h3>
        <p>${unitName}</p>
      </div>

      <div class="urgency">${urgencyNote}</div>

      <div class="btn-container">
        <a href="${applyLink}" class="btn">Complete Application</a>
      </div>

      <p class="opt-out">If you're no longer interested, you can safely ignore this email.</p>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

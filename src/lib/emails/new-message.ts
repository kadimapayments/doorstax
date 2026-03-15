import { emailStyles, emailHeader, emailFooter } from "./_layout";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";

export function newMessageHtml(opts: {
  recipientName: string;
  senderName: string;
  subject: string;
  previewText: string;
  messagesUrl?: string;
}) {
  const { recipientName, senderName, subject, previewText, messagesUrl } = opts;
  const url = messagesUrl || `${BASE_URL}/dashboard/messages`;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .msg-box { background: #f8f9fa; border-left: 3px solid #5B00FF; border-radius: 0 8px 8px 0; padding: 16px; margin: 20px 0; }
    .msg-box .subject { font-size: 14px; font-weight: 600; color: #333; margin-bottom: 8px; }
    .msg-box .preview { font-size: 13px; color: #666; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>New Message</h1>
      <p>Hi ${recipientName},</p>
      <p>You have a new message from <strong>${senderName}</strong>.</p>
      <div class="msg-box">
        <div class="subject">${subject}</div>
        <div class="preview">${previewText}</div>
      </div>
      <div class="btn-container">
        <a href="${url}" class="btn">View Message</a>
      </div>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

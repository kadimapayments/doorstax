/**
 * Shared email layout — branded header, footer, and base styles
 * used by all DoorStax transactional email templates.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";

/* ── Base CSS shared across every template ─────────────── */

export function emailStyles(extra = "") {
  return `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f8f9fa; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 24px; }
    .header img { display: inline-block; }
    h1 { font-size: 20px; color: #1a1a1a; margin: 0 0 8px 0; }
    p { font-size: 14px; color: #666; line-height: 1.6; margin: 0 0 16px 0; }
    .highlight { background: #f8f6ff; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .highlight table { width: 100%; border-collapse: collapse; }
    .highlight td { padding: 6px 0; font-size: 13px; color: #555; }
    .highlight td:last-child { text-align: right; font-weight: 600; color: #333; }
    .highlight .label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .highlight .value { font-size: 24px; font-weight: 700; color: #5B00FF; margin-top: 4px; }
    .btn { display: inline-block; padding: 12px 32px; background: #5B00FF; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; }
    .btn-container { text-align: center; margin: 24px 0; }
    .footer { text-align: center; padding: 24px 0 0; }
    .footer p { font-size: 12px; color: #999; margin: 0 0 8px 0; }
    .footer .badges { margin: 12px 0 8px 0; }
    .footer .badges img { display: inline-block; margin: 0 3px; vertical-align: middle; border-radius: 4px; background: #fff; padding: 2px; }
    .footer .powered { font-size: 11px; color: #bbb; margin-top: 8px; }
    .footer .powered a { color: #999; text-decoration: none; font-weight: 600; }
    .footer .powered a:hover { color: #5B00FF; }
    ${extra}
  `.trim();
}

/* ── Branded header with logo image ───────────────────── */

export function emailHeader() {
  return `
      <div class="header">
        <a href="${BASE_URL}" target="_blank" rel="noopener noreferrer">
          <img
            src="${BASE_URL}/doorstax-logo.png"
            alt="DoorStax"
            width="140"
            height="auto"
            style="display:inline-block;"
          />
        </a>
      </div>`;
}

/* ── HTML escape helper ─────────────────────────────────────── */

/**
 * Escape user-supplied strings before interpolating into email HTML to
 * prevent XSS / template injection. Use whenever a template renders a
 * value that originates from PM, tenant, or applicant input.
 */
export function esc(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ── Bulletproof CTA button (Outlook-safe VML + standard HTML) ─── */

/**
 * Renders a centered call-to-action button that works in Outlook webmail
 * (which strips background-color from <a> tags) as well as all other
 * email clients. Uses the VML roundrect fallback for MSO and a standard
 * styled <a> everywhere else. Width is fixed to 260px so the VML
 * container can render correctly.
 */
export function emailButton(
  text: string,
  href: string,
  color: string = "#5B00FF"
): string {
  const safeHref = String(href).replace(/"/g, "&quot;");
  const safeText = String(text).replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `
    <div style="text-align:center;margin:24px 0;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="17%" strokecolor="${color}" fillcolor="${color}">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:bold;">${safeText}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${safeHref}" style="display:inline-block;background-color:${color};color:#ffffff !important;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;line-height:48px;text-align:center;text-decoration:none;width:260px;border-radius:8px;-webkit-text-size-adjust:none;">${safeText}</a>
      <!--<![endif]-->
    </div>
  `.trim();
}

/* ── Branded footer with badges + Kadima branding ────── */

export function emailFooter() {
  return `
    <div class="footer">
      <div style="margin:12px 0 8px 0;">
        <a href="${BASE_URL}" target="_blank" rel="noopener noreferrer">
          <img src="${BASE_URL}/doorstax-emblem.png" alt="DoorStax" width="28" height="28" style="display:inline-block;vertical-align:middle;" />
        </a>
      </div>
      <p>Sent via DoorStax Payment Network<br>This is an automated email — please do not reply.</p>
      <p class="powered">Powered by <a href="https://kadimapayments.com" target="_blank" rel="noopener noreferrer">Kadima Payments</a></p>
      <p style="font-size:10px;color:#ccc;margin-top:4px;">&copy; ${new Date().getFullYear()} DoorStax &middot; <a href="${BASE_URL}/terms" style="color:#bbb;text-decoration:none;">Terms</a> &middot; <a href="${BASE_URL}/privacy" style="color:#bbb;text-decoration:none;">Privacy</a></p>
    </div>`;
}

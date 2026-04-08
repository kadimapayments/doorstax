"use client";

import DocLayout from "@/components/doc-layout";
import CodeBlock from "@/components/code-block";

export default function EmailNotificationsPage() {
  return (
    <DocLayout
      title="Email Notifications"
      description="20+ branded email templates for every transaction and lifecycle event."
      breadcrumbs={[
        { label: "Docs", href: "/" },
        { label: "Guides" },
        { label: "Email Notifications" },
      ]}
    >
      {/* Overview */}
      <h2>Overview</h2>
      <p className="text-text-secondary mb-6 leading-relaxed">
        DoorStax sends branded transactional emails for every significant event
        in the platform. All templates are built using a shared layout system
        defined in <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">_layout.ts</code> that
        provides consistent styling with <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">emailStyles</code>,
        <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">emailHeader</code>, and
        <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">emailFooter</code> helpers.
        Each template is a standalone function that returns an HTML string.
      </p>

      {/* Template Reference */}
      <h2>Template Reference</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        The following table lists every email template in the system, along with
        its trigger event and recipient.
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">Template</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Trigger</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Recipient</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">tenant-invite</td>
              <td className="py-3 px-4 text-text-secondary">PM invites tenant</td>
              <td className="py-3 px-4 text-text-secondary">Tenant</td>
              <td className="py-3 px-4 text-text-secondary">Invitation to join the DoorStax tenant portal</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">payment-received</td>
              <td className="py-3 px-4 text-text-secondary">Successful payment</td>
              <td className="py-3 px-4 text-text-secondary">Tenant + PM</td>
              <td className="py-3 px-4 text-text-secondary">Payment confirmation with receipt details</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-red">payment-failed</td>
              <td className="py-3 px-4 text-text-secondary">Failed payment</td>
              <td className="py-3 px-4 text-text-secondary">Tenant + PM</td>
              <td className="py-3 px-4 text-text-secondary">Payment failure notification with retry info</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-amber">rent-due-reminder</td>
              <td className="py-3 px-4 text-text-secondary">3 days before due (cron)</td>
              <td className="py-3 px-4 text-text-secondary">Tenant</td>
              <td className="py-3 px-4 text-text-secondary">Upcoming rent due date reminder</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-red">rent-overdue</td>
              <td className="py-3 px-4 text-text-secondary">1/5/15/30 days late (cron)</td>
              <td className="py-3 px-4 text-text-secondary">Tenant + PM</td>
              <td className="py-3 px-4 text-text-secondary">Escalating overdue rent notifications</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">autopay-upcoming</td>
              <td className="py-3 px-4 text-text-secondary">3 days before autopay charge</td>
              <td className="py-3 px-4 text-text-secondary">Tenant</td>
              <td className="py-3 px-4 text-text-secondary">Pre-charge notification for autopay tenants</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-amber">autopay-paused</td>
              <td className="py-3 px-4 text-text-secondary">Max retries exceeded</td>
              <td className="py-3 px-4 text-text-secondary">Tenant</td>
              <td className="py-3 px-4 text-text-secondary">Autopay suspended due to repeated failures</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">autopay-enrollment</td>
              <td className="py-3 px-4 text-text-secondary">Monthly enrollment reminder</td>
              <td className="py-3 px-4 text-text-secondary">Tenant</td>
              <td className="py-3 px-4 text-text-secondary">Encourages non-autopay tenants to enroll</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">payment-refunded</td>
              <td className="py-3 px-4 text-text-secondary">Refund processed</td>
              <td className="py-3 px-4 text-text-secondary">Tenant</td>
              <td className="py-3 px-4 text-text-secondary">Refund confirmation with amount and reason</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-red">chargeback-notification</td>
              <td className="py-3 px-4 text-text-secondary">Chargeback filed</td>
              <td className="py-3 px-4 text-text-secondary">PM</td>
              <td className="py-3 px-4 text-text-secondary">Alert that a chargeback has been initiated</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-amber">expense-invoice</td>
              <td className="py-3 px-4 text-text-secondary">Tenant-payable expense created</td>
              <td className="py-3 px-4 text-text-secondary">Tenant</td>
              <td className="py-3 px-4 text-text-secondary">Invoice for a charge assigned to the tenant</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-red">eviction-notice</td>
              <td className="py-3 px-4 text-text-secondary">Eviction case created</td>
              <td className="py-3 px-4 text-text-secondary">Tenant</td>
              <td className="py-3 px-4 text-text-secondary">Formal eviction notice email</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">payout-processed</td>
              <td className="py-3 px-4 text-text-secondary">Owner payout sent</td>
              <td className="py-3 px-4 text-text-secondary">Owner</td>
              <td className="py-3 px-4 text-text-secondary">Payout confirmation with breakdown</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-amber">lease-expiration</td>
              <td className="py-3 px-4 text-text-secondary">90/60/30/14/7 days before expiry</td>
              <td className="py-3 px-4 text-text-secondary">PM + Tenant</td>
              <td className="py-3 px-4 text-text-secondary">Tiered lease expiration reminders</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">welcome-pm</td>
              <td className="py-3 px-4 text-text-secondary">New PM registration</td>
              <td className="py-3 px-4 text-text-secondary">PM</td>
              <td className="py-3 px-4 text-text-secondary">Welcome email with onboarding steps</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">password-reset</td>
              <td className="py-3 px-4 text-text-secondary">Password reset request</td>
              <td className="py-3 px-4 text-text-secondary">User</td>
              <td className="py-3 px-4 text-text-secondary">Secure password reset link</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">owner-statement</td>
              <td className="py-3 px-4 text-text-secondary">Monthly statement generated</td>
              <td className="py-3 px-4 text-text-secondary">Owner</td>
              <td className="py-3 px-4 text-text-secondary">Monthly financial statement with PDF attachment</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">onboarding-complete</td>
              <td className="py-3 px-4 text-text-secondary">Tenant finishes onboarding</td>
              <td className="py-3 px-4 text-text-secondary">PM</td>
              <td className="py-3 px-4 text-text-secondary">Notification that tenant setup is complete</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">two-factor-code</td>
              <td className="py-3 px-4 text-text-secondary">2FA verification</td>
              <td className="py-3 px-4 text-text-secondary">User</td>
              <td className="py-3 px-4 text-text-secondary">One-time verification code for login</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">new-message</td>
              <td className="py-3 px-4 text-text-secondary">New message received</td>
              <td className="py-3 px-4 text-text-secondary">User</td>
              <td className="py-3 px-4 text-text-secondary">In-app message notification</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-amber">acquiring-agreement</td>
              <td className="py-3 px-4 text-text-secondary">Signed merchant agreement</td>
              <td className="py-3 px-4 text-text-secondary">Admin</td>
              <td className="py-3 px-4 text-text-secondary">Merchant acquiring agreement confirmation</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Customization */}
      <h2>Customization</h2>
      <p className="text-text-secondary mb-6 leading-relaxed">
        All email templates use DoorStax branding with a purple accent color
        scheme. The header includes the DoorStax logo, and the footer includes
        Kadima payment branding, support links, and unsubscribe options. Emails
        are rendered as inline-styled HTML for maximum email client compatibility.
      </p>

      {/* Shared Layout */}
      <h2>Shared Layout</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        The shared layout is defined in <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">_layout.ts</code> and
        exports three helpers used by every template:
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">Export</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">emailStyles</td>
              <td className="py-3 px-4 text-text-secondary">CSS object with brand colors, fonts, spacing, and responsive breakpoints</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">emailHeader</td>
              <td className="py-3 px-4 text-text-secondary">Returns the HTML header block with DoorStax logo and purple gradient bar</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">emailFooter</td>
              <td className="py-3 px-4 text-text-secondary">Returns the HTML footer with Kadima branding, support email, and legal links</td>
            </tr>
          </tbody>
        </table>
      </div>
      <CodeBlock
        language="javascript"
        title="Template Structure Example"
        code={`import { emailStyles, emailHeader, emailFooter } from "./_layout";

export function paymentReceivedEmail(data) {
  return \`
    <!DOCTYPE html>
    <html>
    <head><style>\${emailStyles}</style></head>
    <body>
      \${emailHeader()}
      <div style="padding: 32px;">
        <h1>Payment Received</h1>
        <p>Amount: $\${(data.amount / 100).toFixed(2)}</p>
        <p>Property: \${data.propertyName}</p>
        <p>Unit: \${data.unitName}</p>
        <p>Date: \${data.date}</p>
        <p>Confirmation: \${data.confirmationNumber}</p>
      </div>
      \${emailFooter()}
    </body>
    </html>
  \`;
}`}
      />
    </DocLayout>
  );
}

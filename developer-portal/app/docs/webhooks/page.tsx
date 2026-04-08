"use client";

import DocLayout from "@/components/doc-layout";
import CodeBlock from "@/components/code-block";

export default function WebhooksPage() {
  return (
    <DocLayout
      title="Webhooks"
      description="Receive real-time notifications for payment events, tenant screening results, and other platform activities."
      breadcrumbs={[
        { label: "Docs", href: "/" },
        { label: "Guides" },
        { label: "Webhooks" },
      ]}
    >
      {/* Overview */}
      <h2>Overview</h2>
      <p className="text-text-secondary mb-6 leading-relaxed">
        DoorStax dispatches webhooks for key events from integrated payment
        and screening providers. Webhooks are sent as HTTP POST requests with
        JSON payloads to your configured endpoint.
      </p>

      {/* Kadima Payment Events */}
      <h2>Kadima Payment Events</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Payment events are dispatched by the Kadima payment processor and
        forwarded to your webhook endpoint.
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">Event</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">transaction.completed</td>
              <td className="py-3 px-4 text-text-secondary">A payment has been successfully processed</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-red">transaction.failed</td>
              <td className="py-3 px-4 text-text-secondary">A payment attempt has failed</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-amber">transaction.refunded</td>
              <td className="py-3 px-4 text-text-secondary">A payment has been refunded to the payer</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">recurring.processed</td>
              <td className="py-3 px-4 text-text-secondary">A recurring payment has been automatically processed</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-red">chargeback.create</td>
              <td className="py-3 px-4 text-text-secondary">A chargeback has been filed against a transaction</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-red">chargeback.update</td>
              <td className="py-3 px-4 text-text-secondary">A chargeback status has been updated (Won, Lost, Processed)</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-amber">boardingApplication.statusChanged</td>
              <td className="py-3 px-4 text-text-secondary">Merchant boarding application status changed (Approved, Declined, etc.)</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Signature Verification */}
      <h2>Signature Verification</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        All webhook payloads are signed using <strong className="text-text-primary">HMAC-SHA256</strong>.
        The signature is sent in the <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">x-kadima-signature</code> header.
        Always verify signatures before processing webhooks.
      </p>
      <CodeBlock
        language="javascript"
        title="Verify Webhook Signature (Node.js)"
        code={`import crypto from "crypto";

function verifyWebhookSignature(payload, signature, secret) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// In your webhook handler:
app.post("/webhooks/kadima", (req, res) => {
  const signature = req.headers["x-kadima-signature"];
  const isValid = verifyWebhookSignature(
    JSON.stringify(req.body),
    signature,
    process.env.KADIMA_WEBHOOK_SECRET
  );

  if (!isValid) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  // Process the webhook event
  const { event, data } = req.body;
  // ...

  res.status(200).json({ received: true });
});`}
      />

      {/* Example Payloads */}
      <h2>Example Payloads</h2>

      <h3>transaction.completed</h3>
      <CodeBlock
        language="json"
        title="transaction.completed"
        code={`{
  "event": "transaction.completed",
  "timestamp": "2025-01-15T14:30:00.000Z",
  "data": {
    "transactionId": "txn_abc123",
    "amount": 150000,
    "currency": "USD",
    "status": "completed",
    "paymentMethod": "ach",
    "tenant": {
      "id": "tnt_012",
      "email": "tenant@example.com"
    },
    "lease": {
      "id": "lea_xyz789",
      "unitId": "unt_456"
    },
    "metadata": {
      "description": "Rent payment - January 2025"
    }
  }
}`}
      />

      <h3>transaction.failed</h3>
      <CodeBlock
        language="json"
        title="transaction.failed"
        code={`{
  "event": "transaction.failed",
  "timestamp": "2025-01-15T14:30:00.000Z",
  "data": {
    "transactionId": "txn_def456",
    "amount": 150000,
    "currency": "USD",
    "status": "failed",
    "failureReason": "insufficient_funds",
    "failureCode": "R01",
    "paymentMethod": "ach",
    "tenant": {
      "id": "tnt_012",
      "email": "tenant@example.com"
    },
    "retryEligible": true,
    "nextRetryAt": "2025-01-18T14:30:00.000Z"
  }
}`}
      />

      <h3>transaction.refunded</h3>
      <CodeBlock
        language="json"
        title="transaction.refunded"
        code={`{
  "event": "transaction.refunded",
  "timestamp": "2025-01-20T10:00:00.000Z",
  "data": {
    "transactionId": "txn_abc123",
    "refundId": "ref_ghi789",
    "amount": 150000,
    "currency": "USD",
    "status": "refunded",
    "reason": "duplicate_payment",
    "initiatedBy": "usr_pm001"
  }
}`}
      />

      <h3>recurring.processed</h3>
      <CodeBlock
        language="json"
        title="recurring.processed"
        code={`{
  "event": "recurring.processed",
  "timestamp": "2025-02-01T06:00:00.000Z",
  "data": {
    "transactionId": "txn_rec001",
    "recurringId": "rec_abc123",
    "amount": 150000,
    "currency": "USD",
    "status": "completed",
    "paymentMethod": "ach",
    "schedule": {
      "frequency": "monthly",
      "dayOfMonth": 1,
      "nextDate": "2025-03-01"
    },
    "tenant": {
      "id": "tnt_012",
      "email": "tenant@example.com"
    }
  }
}`}
      />

      {/* RentSpree Screening */}
      <h2>RentSpree Screening Webhooks</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        DoorStax integrates with RentSpree for tenant background screening.
        Screening results are delivered via webhooks when the screening is complete.
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">Event</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">screening.completed</td>
              <td className="py-3 px-4 text-text-secondary">Screening report is ready for review</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-amber">screening.pending</td>
              <td className="py-3 px-4 text-text-secondary">Screening has been initiated and is in progress</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-red">screening.failed</td>
              <td className="py-3 px-4 text-text-secondary">Screening could not be completed</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Retry Policy */}
      <h2>Retry Policy</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        If your endpoint returns a non-2xx status code or times out (30 seconds),
        DoorStax will retry the webhook delivery with exponential backoff:
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">Attempt</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Delay</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">1st retry</td>
              <td className="py-3 px-4 text-text-secondary">1 minute</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">2nd retry</td>
              <td className="py-3 px-4 text-text-secondary">5 minutes</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">3rd retry</td>
              <td className="py-3 px-4 text-text-secondary">30 minutes</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">4th retry</td>
              <td className="py-3 px-4 text-text-secondary">2 hours</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">5th retry (final)</td>
              <td className="py-3 px-4 text-text-secondary">24 hours</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="p-4 rounded-lg bg-accent-amber/5 border border-accent-amber/20">
        <p className="text-sm text-text-secondary">
          <strong className="text-accent-amber">Best Practice:</strong> Always return a
          200 status code quickly and process the webhook asynchronously.
          This prevents timeouts and ensures reliable delivery.
        </p>
      </div>

      {/* Internal Events */}
      <h2>DoorStax Internal Events</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        In addition to external webhooks, DoorStax tracks internal domain events via the{" "}
        <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">DomainEvent</code>{" "}
        model. These are used for deduplication, audit trails, and triggering downstream processes.
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2.5 px-4 text-text-muted font-medium">Event Type</th>
              <th className="text-left py-2.5 px-4 text-text-muted font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-purple">payment.created</td>
              <td className="py-3 px-4 text-text-secondary">New payment record created</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">payment.succeeded</td>
              <td className="py-3 px-4 text-text-secondary">Payment completed successfully</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-red">payment.failed</td>
              <td className="py-3 px-4 text-text-secondary">Payment declined or failed</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">payment.refunded</td>
              <td className="py-3 px-4 text-text-secondary">Payment refunded or ACH returned</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-amber">rent.overdue_notice</td>
              <td className="py-3 px-4 text-text-secondary">Overdue notice sent (includes tier: 1/5/15/30 days)</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-purple">autopay.enrolled</td>
              <td className="py-3 px-4 text-text-secondary">Tenant enrolled in autopay</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-red">autopay.failed</td>
              <td className="py-3 px-4 text-text-secondary">Autopay payment attempt failed</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-amber">autopay.reminder_sent</td>
              <td className="py-3 px-4 text-text-secondary">Enrollment reminder sent to tenant</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">lease.expiring</td>
              <td className="py-3 px-4 text-text-secondary">Lease expiration alert triggered</td>
            </tr>
          </tbody>
        </table>
      </div>
    </DocLayout>
  );
}

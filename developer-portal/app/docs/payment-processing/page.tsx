"use client";

import DocLayout from "@/components/doc-layout";
import CodeBlock from "@/components/code-block";

export default function PaymentProcessingPage() {
  return (
    <DocLayout
      title="Payment Processing"
      description="Multi-merchant card and ACH payment architecture powered by Kadima Gateway."
      breadcrumbs={[
        { label: "Docs", href: "/" },
        { label: "Guides" },
        { label: "Payment Processing" },
      ]}
    >
      {/* Architecture Overview */}
      <h2>Architecture Overview</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        DoorStax uses a multi-merchant payment architecture. The platform holds
        master credentials with Kadima Gateway, while each property manager
        operates under their own merchant account. Payments are routed to the
        appropriate merchant based on the property manager associated with the
        tenant&apos;s lease.
      </p>
      <div className="p-4 rounded-lg bg-accent-blue/5 border border-accent-blue/20 mb-6">
        <p className="text-sm text-text-secondary">
          <strong className="text-accent-blue">Key Concept:</strong> Platform credentials
          are used for merchant onboarding and reporting. Per-PM merchant credentials are
          used for all tenant-facing payment transactions.
        </p>
      </div>
      <CodeBlock
        language="json"
        title="Merchant Configuration"
        code={`{
  "pmId": "pm_001",
  "merchantId": "mid_kadima_abc",
  "merchantStatus": "APPROVED",
  "processingCurrency": "USD",
  "supportedMethods": ["CARD", "ACH"],
  "cardSurchargeRate": 3.25,
  "achFeeAmount": 250,
  "applicationApprovedAt": "2025-01-10T00:00:00.000Z"
}`}
      />

      {/* Card Payment Flow */}
      <h2>Card Payment Flow</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Card payments use Kadima&apos;s vault tokenization system. The tenant&apos;s
        card is stored as a vault token on first use. Subsequent payments
        reference the vault token via
        <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">merchantCreateSaleFromVault</code> to
        process charges without re-entering card details.
      </p>
      <CodeBlock
        language="json"
        title="Card Payment via Vault Token"
        code={`{
  "merchantId": "mid_kadima_abc",
  "vaultToken": "vtk_card_9876",
  "amount": 155000,
  "currency": "USD",
  "surcharge": 5038,
  "totalCharge": 160038,
  "description": "Rent payment - February 2025",
  "metadata": {
    "tenantId": "tnt_012",
    "leaseId": "lea_xyz789",
    "paymentType": "RENT"
  }
}`}
      />

      {/* ACH Payment Flow */}
      <h2>ACH Payment Flow</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        ACH payments use vault bank account tokens for direct debit from the
        tenant&apos;s checking or savings account. ACH transactions typically settle
        in 3-5 business days.
      </p>
      <CodeBlock
        language="json"
        title="ACH Payment via Vault Account"
        code={`{
  "merchantId": "mid_kadima_abc",
  "vaultToken": "vtk_ach_5432",
  "amount": 150000,
  "currency": "USD",
  "achFee": 250,
  "totalCharge": 150250,
  "accountType": "CHECKING",
  "description": "Rent payment - February 2025",
  "metadata": {
    "tenantId": "tnt_012",
    "leaseId": "lea_xyz789",
    "paymentType": "RENT"
  }
}`}
      />

      {/* Autopay Engine */}
      <h2>Autopay Engine</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Tenants can enroll in autopay to automatically charge their saved payment
        method on the rent due date. The system sends pre-charge notifications 3
        days before processing and handles failures with automatic retries.
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">Event</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Timing</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">Pre-charge notification</td>
              <td className="py-3 px-4 text-text-secondary">3 days before due date</td>
              <td className="py-3 px-4 text-text-secondary">Email sent to tenant with amount and date</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">Charge attempt</td>
              <td className="py-3 px-4 text-text-secondary">On due date</td>
              <td className="py-3 px-4 text-text-secondary">Payment processed via saved method</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">Retry on failure</td>
              <td className="py-3 px-4 text-text-secondary">1, 3, and 5 days after failure</td>
              <td className="py-3 px-4 text-text-secondary">Automatic retry with tenant notification</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">Autopay paused</td>
              <td className="py-3 px-4 text-text-secondary">After max retries exceeded</td>
              <td className="py-3 px-4 text-text-secondary">Autopay suspended, PM and tenant notified</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Fee Calculation */}
      <h2>Fee Calculation</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Processing fees are calculated based on the payment method. Card payments
        incur a surcharge of <strong className="text-text-primary">3.25%</strong> added to
        the total. ACH fees follow a cascade: property-level override, then
        owner-level override, then the system default.
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">Method</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Fee Type</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Rate</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">CARD</td>
              <td className="py-3 px-4 text-text-secondary">Surcharge (percentage)</td>
              <td className="py-3 px-4 text-text-secondary">3.25% of payment amount</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">ACH</td>
              <td className="py-3 px-4 text-text-secondary">Flat fee (cascade)</td>
              <td className="py-3 px-4 text-text-secondary">Property &rarr; Owner &rarr; Default ($2.50)</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Outstanding Charges */}
      <h2>Outstanding Charges</h2>
      <p className="text-text-secondary mb-6 leading-relaxed">
        When a tenant logs into their dashboard, they see all outstanding charges
        alongside their regular rent. This includes tenant-payable expenses,
        late fees, and any other non-rent charges. The tenant can pay all charges
        in a single transaction or select individual items.
      </p>

      {/* Payment Void & Write-Off */}
      <h2>Payment Void & Write-Off</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Property managers can void a payment (before settlement) or write off
        an outstanding balance. Both actions require a reason and create a
        corresponding ledger entry. If the payment was tied to an expense, the
        expense record is updated to reflect the change.
      </p>
      <CodeBlock
        language="json"
        title="Void Payment Request"
        code={`{
  "paymentId": "pay_abc123",
  "action": "VOID",
  "reason": "Duplicate payment processed in error",
  "initiatedBy": "usr_pm001",
  "ledgerEntry": {
    "type": "VOID",
    "amount": -150000,
    "description": "Void: Duplicate payment"
  }
}`}
      />

      {/* Receipt PDF Generation */}
      <h2>Receipt PDF Generation</h2>
      <p className="text-text-secondary mb-6 leading-relaxed">
        A PDF receipt is automatically generated for every successful payment.
        The receipt includes the payment amount, method, date, property address,
        unit number, and a unique confirmation number. Receipts are available
        for download from the tenant dashboard and are also attached to the
        payment confirmation email.
      </p>

      {/* Merchant Approval Guard */}
      <h2>Merchant Approval Guard</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Payments are blocked until the property manager&apos;s merchant application
        has been approved by Kadima. The system checks the merchant status
        before every payment attempt and returns a clear error if the merchant
        is not yet approved.
      </p>
      <div className="p-4 rounded-lg bg-accent-amber/5 border border-accent-amber/20 mb-6">
        <p className="text-sm text-text-secondary">
          <strong className="text-accent-amber">Important:</strong> Tenant payment
          forms are hidden in the UI until the PM&apos;s merchant account reaches
          <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">APPROVED</code> status.
          Attempting to process a payment via API without approval returns a 403 error.
        </p>
      </div>

      {/* API Reference */}
      <h2>API Reference</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Payment endpoints handle the full transaction lifecycle from charge to
        settlement.
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">Method</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Endpoint</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">POST</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/payments/charge</td>
              <td className="py-3 px-4 text-text-secondary">Process a card or ACH payment</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">GET</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/payments</td>
              <td className="py-3 px-4 text-text-secondary">List payments with filters</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">GET</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/payments/:id</td>
              <td className="py-3 px-4 text-text-secondary">Get payment details</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">POST</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/payments/:id/void</td>
              <td className="py-3 px-4 text-text-secondary">Void an unsettled payment</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">POST</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/payments/:id/refund</td>
              <td className="py-3 px-4 text-text-secondary">Refund a settled payment</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">POST</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/payments/:id/write-off</td>
              <td className="py-3 px-4 text-text-secondary">Write off an outstanding balance</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">POST</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/autopay/enroll</td>
              <td className="py-3 px-4 text-text-secondary">Enroll tenant in autopay</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">POST</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/autopay/cancel</td>
              <td className="py-3 px-4 text-text-secondary">Cancel autopay enrollment</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">GET</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/payments/:id/receipt</td>
              <td className="py-3 px-4 text-text-secondary">Download payment receipt PDF</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">GET</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/merchants/:pmId/status</td>
              <td className="py-3 px-4 text-text-secondary">Check merchant approval status</td>
            </tr>
          </tbody>
        </table>
      </div>
    </DocLayout>
  );
}

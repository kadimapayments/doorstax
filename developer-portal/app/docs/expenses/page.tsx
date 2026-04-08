"use client";

import DocLayout from "@/components/doc-layout";
import CodeBlock from "@/components/code-block";

export default function ExpensesPage() {
  return (
    <DocLayout
      title="Expenses System"
      description="Track property expenses with flexible billing assignment, tenant invoicing, and split cost management."
      breadcrumbs={[
        { label: "Docs", href: "/" },
        { label: "Guides" },
        { label: "Expenses" },
      ]}
    >
      {/* Overview */}
      <h2>Overview</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        The Expenses system allows property managers to record, categorize, and
        assign property-related costs to the appropriate party. Every expense
        includes a <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">payableBy</code> field
        that determines who is financially responsible.
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">Payable By</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">OWNER</td>
              <td className="py-3 px-4 text-text-secondary">Deducted from owner payout at end of month</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">TENANT</td>
              <td className="py-3 px-4 text-text-secondary">Invoiced to tenant as an outstanding charge</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">PM</td>
              <td className="py-3 px-4 text-text-secondary">Absorbed by the property management company</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-amber">INSURANCE</td>
              <td className="py-3 px-4 text-text-secondary">Tracked for insurance claim reimbursement</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-red">SPLIT</td>
              <td className="py-3 px-4 text-text-secondary">Cost divided among multiple parties by percentage</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Creating Expenses */}
      <h2>Creating Expenses</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Expenses can be created from three entry points in the application:
        the dedicated expense form, the property detail page, or directly from
        a unit page. Each path pre-fills context such as property ID and unit ID.
      </p>
      <CodeBlock
        language="json"
        title="Create Expense Request"
        code={`{
  "propertyId": "prop_abc123",
  "unitId": "unt_456",
  "category": "MAINTENANCE",
  "description": "HVAC filter replacement",
  "amount": 18500,
  "payableBy": "OWNER",
  "vendorName": "CoolAir Services",
  "date": "2025-01-15",
  "recurring": false,
  "receiptUrl": null
}`}
      />

      {/* Tenant Invoicing Flow */}
      <h2>Tenant Invoicing Flow</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        When an expense is assigned to a tenant, the system automatically creates
        a Payment record, sends an invoice email, and surfaces the charge on the
        tenant dashboard alongside rent.
      </p>
      <div className="p-4 rounded-lg bg-accent-blue/5 border border-accent-blue/20 mb-6">
        <p className="text-sm text-text-secondary">
          <strong className="text-accent-blue">Flow:</strong> Expense created (payableBy: TENANT)
          &rarr; Payment record generated &rarr; Invoice email sent &rarr; Charge appears on tenant dashboard
          &rarr; Tenant pays via card or ACH &rarr; Ledger entry recorded.
        </p>
      </div>
      <CodeBlock
        language="json"
        title="Tenant Expense Invoice Payload"
        code={`{
  "expenseId": "exp_789",
  "tenantId": "tnt_012",
  "amount": 25000,
  "description": "Broken window repair - Unit 4B",
  "dueDate": "2025-02-01",
  "status": "PENDING",
  "paymentId": "pay_inv001"
}`}
      />

      {/* Split Expenses */}
      <h2>Split Expenses</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Split expenses distribute a single cost across multiple parties. Each
        split entry specifies a party type and a percentage. The sum of all
        percentages must equal 100.
      </p>
      <CodeBlock
        language="json"
        title="Split Expense Configuration"
        code={`{
  "expenseId": "exp_split001",
  "amount": 50000,
  "payableBy": "SPLIT",
  "splits": [
    { "party": "OWNER", "percentage": 60, "amount": 30000 },
    { "party": "TENANT", "percentage": 30, "amount": 15000 },
    { "party": "PM", "percentage": 10, "amount": 5000 }
  ]
}`}
      />

      {/* Approval Workflow */}
      <h2>Approval Workflow</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Expenses submitted by maintenance staff or vendors enter a
        <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">PENDING</code> state.
        The property manager reviews and either approves or rejects each expense.
        Approved expenses proceed to invoicing or payout deduction. Rejected
        expenses are marked with a reason and archived.
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">Status</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-amber">PENDING</td>
              <td className="py-3 px-4 text-text-secondary">Awaiting PM review and approval</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">APPROVED</td>
              <td className="py-3 px-4 text-text-secondary">Approved and queued for invoicing or payout deduction</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-red">REJECTED</td>
              <td className="py-3 px-4 text-text-secondary">Rejected with reason, archived for records</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Recurring Expenses */}
      <h2>Recurring Expenses</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Expenses marked as recurring are automatically duplicated on the 1st of
        each month by the <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">recurring-expenses</code> cron
        job. The new expense inherits all fields from the original, with the date
        set to the current month. If the expense is tenant-payable, a new invoice
        is also generated automatically.
      </p>
      <CodeBlock
        language="json"
        title="Recurring Expense Configuration"
        code={`{
  "expenseId": "exp_rec001",
  "recurring": true,
  "frequency": "MONTHLY",
  "category": "UTILITIES",
  "description": "Common area electricity",
  "amount": 12000,
  "payableBy": "TENANT",
  "nextDuplicateDate": "2025-03-01"
}`}
      />

      {/* Receipt Upload */}
      <h2>Receipt Upload</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Each expense supports one or more receipt attachments. Supported formats
        include JPEG, PNG, and PDF. Receipts are uploaded to cloud storage and
        linked to the expense record via a signed URL.
      </p>
      <CodeBlock
        language="json"
        title="Receipt Attachment"
        code={`{
  "expenseId": "exp_789",
  "receipts": [
    {
      "id": "rcpt_001",
      "fileName": "hvac-invoice.pdf",
      "fileType": "application/pdf",
      "fileSize": 245000,
      "url": "https://storage.doorstax.com/receipts/rcpt_001.pdf",
      "uploadedAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}`}
      />

      {/* API Reference */}
      <h2>API Reference</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        All expense endpoints require authentication and are scoped to the
        property manager&apos;s organization.
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
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/expenses</td>
              <td className="py-3 px-4 text-text-secondary">Create a new expense</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">GET</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/expenses</td>
              <td className="py-3 px-4 text-text-secondary">List expenses with filters</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">GET</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/expenses/:id</td>
              <td className="py-3 px-4 text-text-secondary">Get expense details</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-amber">PUT</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/expenses/:id</td>
              <td className="py-3 px-4 text-text-secondary">Update an expense</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-red">DELETE</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/expenses/:id</td>
              <td className="py-3 px-4 text-text-secondary">Delete an expense</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">POST</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/expenses/:id/approve</td>
              <td className="py-3 px-4 text-text-secondary">Approve a pending expense</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">POST</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/expenses/:id/reject</td>
              <td className="py-3 px-4 text-text-secondary">Reject a pending expense</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">POST</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/expenses/:id/receipts</td>
              <td className="py-3 px-4 text-text-secondary">Upload a receipt attachment</td>
            </tr>
          </tbody>
        </table>
      </div>
    </DocLayout>
  );
}

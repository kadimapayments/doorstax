"use client";

import DocLayout from "@/components/doc-layout";
import CodeBlock from "@/components/code-block";

export default function LedgerSystemPage() {
  return (
    <DocLayout
      title="Immutable Ledger System"
      description="DoorStax maintains an append-only financial ledger that records every monetary event with full audit trail and automatic reconciliation."
      breadcrumbs={[
        { label: "Docs", href: "/" },
        { label: "Guides" },
        { label: "Ledger System" },
      ]}
    >
      {/* Design Principles */}
      <h2>Design Principles</h2>
      <p className="text-text-secondary mb-6 leading-relaxed">
        The ledger is the financial source of truth for every property, unit, and
        tenant in DoorStax. It is designed around three core principles:
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        {[
          {
            title: "Append-Only",
            desc: "Entries are never modified or deleted. New entries are always appended.",
            color: "text-accent-green",
            bg: "bg-accent-green/10",
          },
          {
            title: "Locked Entries",
            desc: "Once written, a ledger entry is immutable. Its fields cannot be changed.",
            color: "text-accent-amber",
            bg: "bg-accent-amber/10",
          },
          {
            title: "Compensating Adjustments",
            desc: "Corrections are made by adding new offsetting entries, not editing existing ones.",
            color: "text-accent-purple",
            bg: "bg-accent-purple/10",
          },
        ].map((p) => (
          <div key={p.title} className={`p-4 rounded-lg ${p.bg} border border-border`}>
            <h3 className={`text-sm font-semibold ${p.color} mb-1`}>{p.title}</h3>
            <p className="text-sm text-text-muted">{p.desc}</p>
          </div>
        ))}
      </div>

      {/* Entry Types */}
      <h2>Entry Types</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Every ledger entry has a <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">type</code> that
        categorizes the nature of the transaction.
      </p>
      <div className="overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">Type</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Direction</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-red">CHARGE</td>
              <td className="py-3 px-4 text-text-secondary">Debit (+)</td>
              <td className="py-3 px-4 text-text-secondary">Rent, late fees, or other charges owed by tenant</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">PAYMENT</td>
              <td className="py-3 px-4 text-text-secondary">Credit (-)</td>
              <td className="py-3 px-4 text-text-secondary">Payment received from tenant</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-amber">REVERSAL</td>
              <td className="py-3 px-4 text-text-secondary">Credit (-)</td>
              <td className="py-3 px-4 text-text-secondary">Reversal of a previous charge (compensating entry)</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-purple">ADJUSTMENT</td>
              <td className="py-3 px-4 text-text-secondary">Either</td>
              <td className="py-3 px-4 text-text-secondary">Manual correction — debit or credit as needed</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Running Balance */}
      <h2>Running Balance Calculation</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Each ledger entry stores a <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">runningBalance</code> field
        that is computed at write time. The balance for a lease is the sum of all
        entry amounts in chronological order:
      </p>
      <CodeBlock
        language="text"
        title="Balance Formula"
        code={`runningBalance = previousBalance + amount

Where:
  CHARGE     →  amount > 0  (increases balance owed)
  PAYMENT    →  amount < 0  (decreases balance owed)
  REVERSAL   →  amount < 0  (decreases balance owed)
  ADJUSTMENT →  amount ≷ 0  (either direction)`}
      />
      <p className="text-text-secondary mb-6 leading-relaxed">
        A running balance of <strong className="text-text-primary">0</strong> means the
        tenant is fully paid up. A positive balance means the tenant owes money.
        A negative balance means a credit exists on the account.
      </p>

      {/* Field Reference */}
      <h2>LedgerEntry Field Reference</h2>
      <div className="overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">Field</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Type</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {[
              { field: "id", type: "String", desc: "Unique identifier (cuid)" },
              { field: "leaseId", type: "String", desc: "Associated lease" },
              { field: "unitId", type: "String", desc: "Associated unit" },
              { field: "tenantId", type: "String?", desc: "Associated tenant (nullable for charges)" },
              { field: "type", type: "EntryType", desc: "CHARGE | PAYMENT | REVERSAL | ADJUSTMENT" },
              { field: "amount", type: "Decimal", desc: "Signed amount in cents" },
              { field: "runningBalance", type: "Decimal", desc: "Balance after this entry" },
              { field: "description", type: "String", desc: "Human-readable description" },
              { field: "referenceId", type: "String?", desc: "Links to a payment or charge record" },
              { field: "referenceType", type: "String?", desc: "Type of referenced record (payment, charge, etc.)" },
              { field: "metadata", type: "Json?", desc: "Arbitrary metadata" },
              { field: "createdAt", type: "DateTime", desc: "Timestamp of entry creation" },
              { field: "createdById", type: "String", desc: "User who created this entry" },
              { field: "isLocked", type: "Boolean", desc: "Always true after creation" },
            ].map((row) => (
              <tr key={row.field} className="border-b border-border/50">
                <td className="py-3 px-4 font-mono text-xs text-accent-lavender">{row.field}</td>
                <td className="py-3 px-4 font-mono text-xs text-text-secondary">{row.type}</td>
                <td className="py-3 px-4 text-text-secondary">{row.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Example Flow */}
      <h2>Example Flow</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Here is a typical sequence for a monthly rent cycle:
      </p>
      <div className="space-y-3 mb-6">
        <div className="flex gap-4 p-4 rounded-lg bg-bg-card border border-border">
          <span className="text-accent-purple font-mono text-sm font-bold shrink-0">1</span>
          <div>
            <p className="text-sm text-text-primary font-medium">Rent Charge Created</p>
            <p className="text-sm text-text-muted">
              CHARGE of +$1,500.00 — running balance: $1,500.00
            </p>
          </div>
        </div>
        <div className="flex gap-4 p-4 rounded-lg bg-bg-card border border-border">
          <span className="text-accent-purple font-mono text-sm font-bold shrink-0">2</span>
          <div>
            <p className="text-sm text-text-primary font-medium">Tenant Payment Received</p>
            <p className="text-sm text-text-muted">
              PAYMENT of -$1,500.00 — running balance: $0.00
            </p>
          </div>
        </div>
        <div className="flex gap-4 p-4 rounded-lg bg-bg-card border border-border">
          <span className="text-accent-purple font-mono text-sm font-bold shrink-0">3</span>
          <div>
            <p className="text-sm text-text-primary font-medium">Late Fee (if payment was late)</p>
            <p className="text-sm text-text-muted">
              CHARGE of +$50.00 — running balance: $50.00
            </p>
          </div>
        </div>
        <div className="flex gap-4 p-4 rounded-lg bg-bg-card border border-border">
          <span className="text-accent-purple font-mono text-sm font-bold shrink-0">4</span>
          <div>
            <p className="text-sm text-text-primary font-medium">Late Fee Waived</p>
            <p className="text-sm text-text-muted">
              REVERSAL of -$50.00 — running balance: $0.00
            </p>
          </div>
        </div>
      </div>
      <CodeBlock
        language="json"
        title="Ledger Entry Example"
        code={`{
  "id": "led_abc123",
  "leaseId": "lea_xyz789",
  "unitId": "unt_456",
  "tenantId": "tnt_012",
  "type": "PAYMENT",
  "amount": -150000,
  "runningBalance": 0,
  "description": "Rent payment for January 2025",
  "referenceId": "pay_def456",
  "referenceType": "payment",
  "createdAt": "2025-01-05T10:30:00.000Z",
  "createdById": "usr_tnt012",
  "isLocked": true
}`}
      />

      {/* Audit Trail */}
      <h2>Audit Trail</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Every ledger entry is linked to the user who created it
        via <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">createdById</code>.
        When a payment triggers a ledger entry, the <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">referenceId</code> links
        back to the originating payment record, creating a complete audit chain.
      </p>
      <p className="text-text-secondary mb-6 leading-relaxed">
        Because entries are immutable, the full history of every financial event
        is preserved and can be audited at any time. Reversals and adjustments
        maintain explicit references to the entries they compensate.
      </p>

      {/* Reconciliation */}
      <h2>Reconciliation</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        DoorStax runs an automated reconciliation cron job that:
      </p>
      <ul className="space-y-2 mb-6">
        {[
          "Verifies running balances match the sum of all entries per lease",
          "Cross-references ledger entries with payment processor records (Kadima)",
          "Flags discrepancies for manual review",
          "Generates reconciliation reports for accounting teams",
        ].map((item, i) => (
          <li key={i} className="flex gap-3 text-sm text-text-secondary">
            <span className="text-accent-purple shrink-0">&#8226;</span>
            {item}
          </li>
        ))}
      </ul>
      <div className="p-4 rounded-lg bg-accent-amber/5 border border-accent-amber/20">
        <p className="text-sm text-text-secondary">
          <strong className="text-accent-amber">Note:</strong> The reconciliation cron runs
          daily at 2:00 AM UTC. Discrepancies are surfaced in the admin dashboard
          and via email notifications to accountants.
        </p>
      </div>

      {/* Void Workflow */}
      <h2>Payment Void Workflow</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        When a PM voids a pending or failed payment, a <strong className="text-text-primary">REVERSAL</strong>{" "}
        ledger entry is created automatically. This ensures the tenant&apos;s balance is corrected and the void is
        permanently recorded in the immutable ledger.
      </p>
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2.5 px-4 text-text-muted font-medium">Action</th>
              <th className="text-left py-2.5 px-4 text-text-muted font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">PM voids a payment</td>
              <td className="py-3 px-4 text-text-secondary">Payment status → REFUNDED, kadimaStatus → &quot;voided&quot;</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">Ledger entry created</td>
              <td className="py-3 px-4 text-text-secondary">Type: REVERSAL, negative amount (credit), description includes void reason</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">Linked expense updated</td>
              <td className="py-3 px-4 text-text-secondary">If a linked expense exists, its status → WRITTEN_OFF</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">Audit log recorded</td>
              <td className="py-3 px-4 text-text-secondary">Action: VOID, includes PM name, reason, and amount</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="p-4 rounded-lg bg-accent-red/5 border border-accent-red/20">
        <p className="text-sm text-text-secondary">
          <strong className="text-accent-red">Important:</strong> All voids require a reason from the PM.
          The reason is recorded in the ledger entry, audit log, and payment record&apos;s{" "}
          <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">declineReasonCode</code>{" "}
          field for full traceability.
        </p>
      </div>
    </DocLayout>
  );
}

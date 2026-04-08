"use client";

import DocLayout from "@/components/doc-layout";
import CodeBlock from "@/components/code-block";

export default function EvictionsPage() {
  return (
    <DocLayout
      title="Eviction Tracking"
      description="Full eviction lifecycle management from notice through resolution."
      breadcrumbs={[
        { label: "Docs", href: "/" },
        { label: "Guides" },
        { label: "Evictions" },
      ]}
    >
      {/* Overview */}
      <h2>Overview</h2>
      <p className="text-text-secondary mb-6 leading-relaxed">
        The Eviction Tracking system provides end-to-end management of eviction
        cases within DoorStax. From the initial notice through court proceedings
        to final resolution, every step is tracked with timestamps, documents,
        and notes. The system integrates with tenant management, lease lifecycle,
        and payment processing to automate cleanup actions upon completion.
      </p>

      {/* Status Workflow */}
      <h2>Status Workflow</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Each eviction case progresses through a defined set of statuses. The
        property manager advances the case by updating the status and attaching
        relevant documentation at each step.
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
              <td className="py-3 px-4 font-mono text-xs text-accent-amber">NOTICE_PENDING</td>
              <td className="py-3 px-4 text-text-secondary">Eviction initiated, notice being prepared</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">NOTICE_SERVED</td>
              <td className="py-3 px-4 text-text-secondary">Notice delivered to tenant with proof of service</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">CURE_PERIOD</td>
              <td className="py-3 px-4 text-text-secondary">Waiting for cure period to expire</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-amber">FILING_PENDING</td>
              <td className="py-3 px-4 text-text-secondary">Cure period expired, preparing court filing</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">FILED</td>
              <td className="py-3 px-4 text-text-secondary">Eviction complaint filed with the court</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">HEARING_SCHEDULED</td>
              <td className="py-3 px-4 text-text-secondary">Court hearing date set</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">JUDGMENT</td>
              <td className="py-3 px-4 text-text-secondary">Court has issued a judgment</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-amber">WRIT_ISSUED</td>
              <td className="py-3 px-4 text-text-secondary">Writ of possession issued by the court</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">COMPLETED</td>
              <td className="py-3 px-4 text-text-secondary">Eviction process fully resolved</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-red">CANCELLED</td>
              <td className="py-3 px-4 text-text-secondary">Eviction cancelled (tenant cured, case dismissed, etc.)</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Initiating an Eviction */}
      <h2>Initiating an Eviction</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Evictions can be initiated from the unit detail page or the tenant
        profile. The system requires a notice type, reason, and the tenant&apos;s
        current lease to create the case.
      </p>
      <CodeBlock
        language="json"
        title="Create Eviction Request"
        code={`{
  "tenantId": "tnt_012",
  "unitId": "unt_456",
  "leaseId": "lea_xyz789",
  "noticeType": "PAY_OR_QUIT",
  "reason": "Non-payment of rent for 2 consecutive months",
  "noticeDate": "2025-01-15",
  "curePeriodDays": 3,
  "outstandingBalance": 300000
}`}
      />

      {/* Notice Types */}
      <h2>Notice Types</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        DoorStax supports four standard notice types. The notice type determines
        the cure period and required documentation.
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">Notice Type</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Use Case</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Typical Cure Period</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-red">PAY_OR_QUIT</td>
              <td className="py-3 px-4 text-text-secondary">Unpaid rent or charges</td>
              <td className="py-3 px-4 text-text-secondary">3-5 days</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-amber">CURE_OR_QUIT</td>
              <td className="py-3 px-4 text-text-secondary">Lease violation that can be corrected</td>
              <td className="py-3 px-4 text-text-secondary">10-30 days</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-red">UNCONDITIONAL_QUIT</td>
              <td className="py-3 px-4 text-text-secondary">Severe violation, no opportunity to cure</td>
              <td className="py-3 px-4 text-text-secondary">None</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">CUSTOM</td>
              <td className="py-3 px-4 text-text-secondary">State-specific or non-standard notice</td>
              <td className="py-3 px-4 text-text-secondary">Varies</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Court Filing & Hearing Tracking */}
      <h2>Court Filing & Hearing Tracking</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        After the cure period expires without resolution, the PM files the
        eviction with the court. DoorStax tracks the case number, filing date,
        hearing date, judge assignment, and courtroom details.
      </p>
      <CodeBlock
        language="json"
        title="Court Filing Details"
        code={`{
  "evictionId": "evic_001",
  "caseNumber": "2025-CV-04521",
  "filingDate": "2025-01-25",
  "courtName": "County District Court",
  "hearingDate": "2025-02-10T09:00:00.000Z",
  "courtroom": "Room 302",
  "judgeName": "Hon. Martinez"
}`}
      />

      {/* Document Management */}
      <h2>Document Management</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Each eviction case supports document uploads organized by type. All
        documents are stored in cloud storage with signed URLs for secure access.
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">Document Type</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">NOTICE</td>
              <td className="py-3 px-4 text-text-secondary">The eviction notice served to the tenant</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">PROOF_OF_SERVICE</td>
              <td className="py-3 px-4 text-text-secondary">Proof that notice was properly delivered</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">COURT_FILING</td>
              <td className="py-3 px-4 text-text-secondary">Eviction complaint and court documents</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-amber">JUDGMENT</td>
              <td className="py-3 px-4 text-text-secondary">Court judgment and order documents</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Timeline & Notes */}
      <h2>Timeline & Notes</h2>
      <p className="text-text-secondary mb-6 leading-relaxed">
        Every status change and action is recorded in the eviction timeline.
        Property managers can add free-form notes at any point. The timeline
        provides a complete audit trail for legal compliance and is exportable
        as a PDF summary.
      </p>

      {/* Completion Actions */}
      <h2>Completion Actions</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        When an eviction is marked as <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">COMPLETED</code>,
        the system automatically performs the following cleanup actions:
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">Action</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">Tenant Freeze</td>
              <td className="py-3 px-4 text-text-secondary">Tenant account is frozen to prevent portal access</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">Lease Termination</td>
              <td className="py-3 px-4 text-text-secondary">Active lease is terminated with eviction reason</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">Unit Vacate</td>
              <td className="py-3 px-4 text-text-secondary">Unit status changed to vacant</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">Autopay Cancel</td>
              <td className="py-3 px-4 text-text-secondary">Any active autopay enrollment is cancelled</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">Scheduled Payments Deleted</td>
              <td className="py-3 px-4 text-text-secondary">All future scheduled payments are removed</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Outstanding Balance */}
      <h2>Outstanding Balance</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        The eviction record automatically calculates the tenant&apos;s outstanding
        balance from all unpaid Payment records linked to the lease. The property
        manager can override this amount if needed, for example to include
        court costs or attorney fees.
      </p>
      <CodeBlock
        language="json"
        title="Outstanding Balance"
        code={`{
  "evictionId": "evic_001",
  "calculatedBalance": 450000,
  "overrideBalance": 525000,
  "overrideReason": "Includes $750 court filing fees",
  "breakdown": {
    "unpaidRent": 400000,
    "unpaidCharges": 50000,
    "courtCosts": 75000
  }
}`}
      />

      {/* Cancellation */}
      <h2>Cancellation</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        An eviction can be cancelled at any stage before completion. Common
        reasons include the tenant curing the violation, reaching a payment
        agreement, or the court dismissing the case. Cancellation requires
        a reason and preserves the full timeline for records.
      </p>
      <CodeBlock
        language="json"
        title="Cancel Eviction Request"
        code={`{
  "evictionId": "evic_001",
  "cancellationReason": "TENANT_CURED",
  "notes": "Tenant paid full outstanding balance on 2025-01-20",
  "cancelledBy": "usr_pm001",
  "cancelledAt": "2025-01-20T14:00:00.000Z"
}`}
      />

      {/* API Reference */}
      <h2>API Reference</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Eviction endpoints manage the full lifecycle of an eviction case.
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
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/evictions</td>
              <td className="py-3 px-4 text-text-secondary">Create a new eviction case</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">GET</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/evictions</td>
              <td className="py-3 px-4 text-text-secondary">List eviction cases with filters</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">GET</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/evictions/:id</td>
              <td className="py-3 px-4 text-text-secondary">Get eviction case details</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-amber">PUT</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/evictions/:id/status</td>
              <td className="py-3 px-4 text-text-secondary">Advance eviction status</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">POST</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/evictions/:id/documents</td>
              <td className="py-3 px-4 text-text-secondary">Upload a document to the case</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">POST</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/evictions/:id/notes</td>
              <td className="py-3 px-4 text-text-secondary">Add a note to the timeline</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">POST</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/evictions/:id/cancel</td>
              <td className="py-3 px-4 text-text-secondary">Cancel an eviction case</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">GET</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">/api/evictions/:id/timeline</td>
              <td className="py-3 px-4 text-text-secondary">Get full eviction timeline</td>
            </tr>
          </tbody>
        </table>
      </div>
    </DocLayout>
  );
}

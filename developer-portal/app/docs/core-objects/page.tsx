"use client";

import DocLayout from "@/components/doc-layout";
import CodeBlock from "@/components/code-block";

interface CoreObject {
  name: string;
  description: string;
  fields: { name: string; type: string; description: string }[];
  example: string;
  endpoints: string[];
}

const coreObjects: CoreObject[] = [
  {
    name: "Properties",
    description:
      "A property represents a physical real estate asset — a building, complex, or single-family home.",
    fields: [
      { name: "id", type: "String", description: "Unique identifier" },
      { name: "name", type: "String", description: "Display name" },
      { name: "address", type: "Address", description: "Full street address" },
      { name: "type", type: "PropertyType", description: "RESIDENTIAL | COMMERCIAL | MIXED" },
      { name: "ownerId", type: "String", description: "Owner user ID" },
      { name: "units", type: "Unit[]", description: "Associated units" },
      { name: "status", type: "Status", description: "ACTIVE | INACTIVE | ARCHIVED" },
    ],
    example: `{
  "id": "prp_abc123",
  "name": "Sunset Apartments",
  "address": {
    "street": "123 Sunset Blvd",
    "city": "Los Angeles",
    "state": "CA",
    "zip": "90028"
  },
  "type": "RESIDENTIAL",
  "ownerId": "usr_own001",
  "status": "ACTIVE",
  "unitCount": 24
}`,
    endpoints: [
      "GET /api/properties",
      "POST /api/properties",
      "GET /api/properties/:id",
      "PUT /api/properties/:id",
      "DELETE /api/properties/:id",
    ],
  },
  {
    name: "Units",
    description:
      "A unit is a rentable space within a property — an apartment, suite, or room.",
    fields: [
      { name: "id", type: "String", description: "Unique identifier" },
      { name: "propertyId", type: "String", description: "Parent property" },
      { name: "unitNumber", type: "String", description: "Unit number or label" },
      { name: "bedrooms", type: "Int", description: "Number of bedrooms" },
      { name: "bathrooms", type: "Float", description: "Number of bathrooms" },
      { name: "sqft", type: "Int?", description: "Square footage" },
      { name: "rentAmount", type: "Decimal", description: "Monthly rent in cents" },
      { name: "status", type: "UnitStatus", description: "VACANT | OCCUPIED | MAINTENANCE" },
    ],
    example: `{
  "id": "unt_456",
  "propertyId": "prp_abc123",
  "unitNumber": "4B",
  "bedrooms": 2,
  "bathrooms": 1.5,
  "sqft": 950,
  "rentAmount": 225000,
  "status": "OCCUPIED"
}`,
    endpoints: [
      "GET /api/properties/:id/units",
      "POST /api/properties/:id/units",
      "GET /api/units/:id",
      "PUT /api/units/:id",
    ],
  },
  {
    name: "Tenants",
    description:
      "A tenant is a person who rents a unit. They have a user account and one or more lease associations.",
    fields: [
      { name: "id", type: "String", description: "Unique identifier" },
      { name: "userId", type: "String", description: "Associated user account" },
      { name: "firstName", type: "String", description: "First name" },
      { name: "lastName", type: "String", description: "Last name" },
      { name: "email", type: "String", description: "Contact email" },
      { name: "phone", type: "String?", description: "Phone number" },
      { name: "status", type: "TenantStatus", description: "ACTIVE | PAST | APPLICANT" },
    ],
    example: `{
  "id": "tnt_012",
  "userId": "usr_tnt012",
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "phone": "+1-555-0123",
  "status": "ACTIVE"
}`,
    endpoints: [
      "GET /api/tenants",
      "POST /api/tenants",
      "GET /api/tenants/:id",
      "PUT /api/tenants/:id",
    ],
  },
  {
    name: "Leases",
    description:
      "A lease ties a tenant to a unit for a specific period with defined financial terms.",
    fields: [
      { name: "id", type: "String", description: "Unique identifier" },
      { name: "unitId", type: "String", description: "Leased unit" },
      { name: "tenantId", type: "String", description: "Primary tenant" },
      { name: "startDate", type: "DateTime", description: "Lease start date" },
      { name: "endDate", type: "DateTime", description: "Lease end date" },
      { name: "rentAmount", type: "Decimal", description: "Monthly rent in cents" },
      { name: "securityDeposit", type: "Decimal", description: "Security deposit amount" },
      { name: "status", type: "LeaseStatus", description: "ACTIVE | EXPIRED | TERMINATED" },
    ],
    example: `{
  "id": "lea_xyz789",
  "unitId": "unt_456",
  "tenantId": "tnt_012",
  "startDate": "2025-01-01T00:00:00.000Z",
  "endDate": "2026-01-01T00:00:00.000Z",
  "rentAmount": 225000,
  "securityDeposit": 225000,
  "status": "ACTIVE"
}`,
    endpoints: [
      "GET /api/leases",
      "POST /api/leases",
      "GET /api/leases/:id",
      "PUT /api/leases/:id",
      "POST /api/leases/:id/terminate",
    ],
  },
  {
    name: "Payments",
    description:
      "A payment record tracks money movement — tenant rent payments processed through Kadima.",
    fields: [
      { name: "id", type: "String", description: "Unique identifier" },
      { name: "leaseId", type: "String", description: "Associated lease" },
      { name: "tenantId", type: "String", description: "Paying tenant" },
      { name: "amount", type: "Decimal", description: "Payment amount in cents" },
      { name: "method", type: "PaymentMethod", description: "ACH | CARD | CHECK" },
      { name: "status", type: "PaymentStatus", description: "PENDING | COMPLETED | FAILED | REFUNDED" },
      { name: "processedAt", type: "DateTime?", description: "When payment was processed" },
      { name: "externalId", type: "String?", description: "Kadima transaction ID" },
    ],
    example: `{
  "id": "pay_def456",
  "leaseId": "lea_xyz789",
  "tenantId": "tnt_012",
  "amount": 225000,
  "method": "ACH",
  "status": "COMPLETED",
  "processedAt": "2025-01-05T10:30:00.000Z",
  "externalId": "txn_kadima_abc"
}`,
    endpoints: [
      "GET /api/payments",
      "POST /api/payments",
      "GET /api/payments/:id",
      "POST /api/payments/:id/refund",
    ],
  },
  {
    name: "Ledger Entries",
    description:
      "Immutable financial records that track every monetary event. See the Ledger System guide for details.",
    fields: [
      { name: "id", type: "String", description: "Unique identifier" },
      { name: "leaseId", type: "String", description: "Associated lease" },
      { name: "type", type: "EntryType", description: "CHARGE | PAYMENT | REVERSAL | ADJUSTMENT" },
      { name: "amount", type: "Decimal", description: "Signed amount in cents" },
      { name: "runningBalance", type: "Decimal", description: "Balance after this entry" },
      { name: "description", type: "String", description: "Human-readable description" },
    ],
    example: `{
  "id": "led_abc123",
  "leaseId": "lea_xyz789",
  "type": "CHARGE",
  "amount": 225000,
  "runningBalance": 225000,
  "description": "Rent charge - February 2025"
}`,
    endpoints: [
      "GET /api/ledger",
      "GET /api/ledger/:leaseId",
      "GET /api/ledger/:leaseId/balance",
    ],
  },
  {
    name: "Payouts",
    description:
      "Payouts represent disbursements from DoorStax to property owners after collecting rent.",
    fields: [
      { name: "id", type: "String", description: "Unique identifier" },
      { name: "ownerId", type: "String", description: "Recipient owner" },
      { name: "amount", type: "Decimal", description: "Payout amount in cents" },
      { name: "status", type: "PayoutStatus", description: "PENDING | PROCESSING | COMPLETED | FAILED" },
      { name: "scheduledDate", type: "DateTime", description: "Scheduled payout date" },
      { name: "completedAt", type: "DateTime?", description: "When payout was sent" },
    ],
    example: `{
  "id": "po_ghi789",
  "ownerId": "usr_own001",
  "amount": 2100000,
  "status": "COMPLETED",
  "scheduledDate": "2025-01-15T00:00:00.000Z",
  "completedAt": "2025-01-15T06:00:00.000Z"
}`,
    endpoints: [
      "GET /api/payouts",
      "GET /api/payouts/:id",
      "POST /api/payouts/:id/retry",
    ],
  },
  {
    name: "Owners",
    description:
      "Property owners who receive payouts and manage their portfolio through DoorStax.",
    fields: [
      { name: "id", type: "String", description: "Unique identifier" },
      { name: "userId", type: "String", description: "Associated user account" },
      { name: "companyName", type: "String?", description: "Business entity name" },
      { name: "properties", type: "Property[]", description: "Owned properties" },
      { name: "payoutMethod", type: "PayoutMethod", description: "ACH | WIRE | CHECK" },
    ],
    example: `{
  "id": "own_001",
  "userId": "usr_own001",
  "companyName": "Sunset Properties LLC",
  "propertyCount": 3,
  "payoutMethod": "ACH"
}`,
    endpoints: [
      "GET /api/owners",
      "GET /api/owners/:id",
      "PUT /api/owners/:id",
    ],
  },
  {
    name: "Leads",
    description:
      "Prospective tenants who have expressed interest in a unit but have not yet signed a lease.",
    fields: [
      { name: "id", type: "String", description: "Unique identifier" },
      { name: "unitId", type: "String?", description: "Interested unit" },
      { name: "firstName", type: "String", description: "First name" },
      { name: "lastName", type: "String", description: "Last name" },
      { name: "email", type: "String", description: "Contact email" },
      { name: "status", type: "LeadStatus", description: "NEW | CONTACTED | SCREENING | APPROVED | REJECTED" },
      { name: "source", type: "String?", description: "Lead source (website, referral, etc.)" },
    ],
    example: `{
  "id": "lead_jkl012",
  "unitId": "unt_789",
  "firstName": "Alex",
  "lastName": "Smith",
  "email": "alex@example.com",
  "status": "SCREENING",
  "source": "website"
}`,
    endpoints: [
      "GET /api/leads",
      "POST /api/leads",
      "GET /api/leads/:id",
      "PUT /api/leads/:id",
      "POST /api/leads/:id/convert",
    ],
  },
  {
    name: "Users",
    description:
      "User accounts that authenticate into DoorStax. Every tenant, owner, and team member has a user record.",
    fields: [
      { name: "id", type: "String", description: "Unique identifier" },
      { name: "email", type: "String", description: "Login email" },
      { name: "name", type: "String", description: "Full name" },
      { name: "role", type: "UserRole", description: "Assigned role" },
      { name: "twoFactorEnabled", type: "Boolean", description: "2FA status" },
      { name: "status", type: "UserStatus", description: "ACTIVE | SUSPENDED | PENDING" },
    ],
    example: `{
  "id": "usr_abc123",
  "email": "user@example.com",
  "name": "Jane Doe",
  "role": "PROPERTY_MANAGER",
  "twoFactorEnabled": true,
  "status": "ACTIVE"
}`,
    endpoints: [
      "GET /api/users",
      "GET /api/users/:id",
      "PUT /api/users/:id",
      "POST /api/users/invite",
    ],
  },
  {
    name: "Expenses",
    description:
      "Track property and unit-level expenses with flexible billing assignment. Expenses can be charged to owners, tenants, PMs, insurance, or split between parties.",
    fields: [
      { name: "id", type: "String", description: "Unique identifier" },
      { name: "propertyId", type: "String", description: "Associated property" },
      { name: "unitId", type: "String?", description: "Specific unit (optional)" },
      { name: "category", type: "ExpenseCategory", description: "MAINTENANCE, SERVICES, UPGRADES, TAXES, MORTGAGE, INSURANCE, PAYROLL, OTHER" },
      { name: "amount", type: "Decimal", description: "Expense amount" },
      { name: "payableBy", type: "String", description: "OWNER, TENANT, PM, INSURANCE, SPLIT" },
      { name: "status", type: "String", description: "PENDING, APPROVED, INVOICED, PAID, WRITTEN_OFF" },
      { name: "tenantId", type: "String?", description: "Assigned tenant (when payableBy = TENANT)" },
      { name: "paymentId", type: "String?", description: "Linked Payment record" },
      { name: "splitConfig", type: "Json?", description: "Split configuration array" },
      { name: "recurring", type: "Boolean", description: "Whether this recurs monthly" },
    ],
    example: `{
  "id": "exp_abc123",
  "propertyId": "prp_001",
  "category": "MAINTENANCE",
  "amount": 375.00,
  "payableBy": "TENANT",
  "status": "INVOICED",
  "tenantId": "tnt_012",
  "recurring": false
}`,
    endpoints: [
      "GET /api/expenses",
      "POST /api/expenses",
      "PUT /api/expenses/:id",
      "DELETE /api/expenses/:id",
      "POST /api/expenses/:id/approve",
      "POST /api/expenses/:id/reject",
    ],
  },
  {
    name: "Evictions",
    description:
      "Track eviction proceedings from notice through resolution with full document and timeline management. 10-step status workflow with automatic tenant freeze on completion.",
    fields: [
      { name: "id", type: "String", description: "Unique identifier" },
      { name: "tenantId", type: "String", description: "Tenant being evicted" },
      { name: "unitId", type: "String", description: "Unit being vacated" },
      { name: "status", type: "String", description: "10-step workflow (NOTICE_PENDING through COMPLETED)" },
      { name: "reason", type: "String", description: "NON_PAYMENT, LEASE_VIOLATION, PROPERTY_DAMAGE, etc." },
      { name: "noticeType", type: "String?", description: "PAY_OR_QUIT, CURE_OR_QUIT, UNCONDITIONAL_QUIT" },
      { name: "noticeDays", type: "Int?", description: "Notice period in days" },
      { name: "caseNumber", type: "String?", description: "Court case number" },
      { name: "hearingDate", type: "DateTime?", description: "Scheduled court hearing" },
      { name: "judgmentResult", type: "String?", description: "FOR_LANDLORD, FOR_TENANT, DISMISSED" },
      { name: "outstandingBalance", type: "Decimal?", description: "Amount owed" },
      { name: "resolutionType", type: "String?", description: "EVICTED, CURED, SETTLED, DISMISSED" },
    ],
    example: `{
  "id": "evi_abc123",
  "tenantId": "tnt_012",
  "status": "CURE_PERIOD",
  "reason": "NON_PAYMENT",
  "noticeType": "PAY_OR_QUIT",
  "noticeDays": 3,
  "outstandingBalance": 3800.00
}`,
    endpoints: [
      "GET /api/evictions",
      "POST /api/evictions",
      "GET /api/evictions/:id",
      "PUT /api/evictions/:id",
      "POST /api/evictions/:id/documents",
      "POST /api/evictions/:id/notes",
    ],
  },
  {
    name: "Fee Schedules",
    description:
      "Configurable fee structures that cascade from property to owner level. Controls ACH fees, management percentages, and payout calculations.",
    fields: [
      { name: "id", type: "String", description: "Unique identifier" },
      { name: "name", type: "String", description: "Schedule name (e.g., 'Premium')" },
      { name: "achRate", type: "Decimal", description: "ACH transaction fee" },
      { name: "achFeeResponsibility", type: "String", description: "OWNER, TENANT, or PM" },
      { name: "managementFeePercent", type: "Decimal", description: "Management fee percentage" },
      { name: "payoutFeeRate", type: "Decimal", description: "Payout processing rate" },
      { name: "unitFeeRate", type: "Decimal", description: "Per-unit monthly fee" },
    ],
    example: `{
  "id": "fsc_abc123",
  "name": "Premium",
  "achRate": 5.00,
  "achFeeResponsibility": "OWNER",
  "managementFeePercent": 8.00
}`,
    endpoints: [
      "GET /api/fee-schedules",
      "POST /api/fee-schedules",
      "PUT /api/fee-schedules/:id",
    ],
  },
  {
    name: "Recurring Billing",
    description:
      "Automatic rent payment configuration for tenants. Handles enrollment, pre-charge notifications, failure tracking, and automatic pause after max retries.",
    fields: [
      { name: "id", type: "String", description: "Unique identifier" },
      { name: "tenantId", type: "String", description: "Tenant (one per tenant)" },
      { name: "amount", type: "Decimal", description: "Payment amount" },
      { name: "dayOfMonth", type: "Int", description: "Day rent is charged" },
      { name: "status", type: "String", description: "ACTIVE, PAUSED, CANCELLED" },
      { name: "paymentMethod", type: "String", description: "CARD or ACH" },
      { name: "failedAttempts", type: "Int", description: "Consecutive failures" },
      { name: "maxRetries", type: "Int", description: "Max retries before pause (default 3)" },
    ],
    example: `{
  "id": "rec_abc123",
  "tenantId": "tnt_012",
  "amount": 1900.00,
  "dayOfMonth": 1,
  "status": "ACTIVE",
  "paymentMethod": "CARD",
  "failedAttempts": 0
}`,
    endpoints: [
      "POST /api/payments/autopay",
      "DELETE /api/payments/autopay",
    ],
  },
];

export default function CoreObjectsPage() {
  return (
    <DocLayout
      title="Core Objects"
      description="The foundational data models that power the DoorStax platform. Each object represents a key entity in property management."
      breadcrumbs={[
        { label: "Docs", href: "/" },
        { label: "Guides" },
        { label: "Core Objects" },
      ]}
    >
      {/* Object Index */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mb-10">
        {coreObjects.map((obj) => (
          <a
            key={obj.name}
            href={`#${obj.name.toLowerCase().replace(/\s+/g, "-")}`}
            className="text-center p-3 rounded-lg bg-bg-card border border-border hover:border-accent-purple/30 hover:bg-bg-hover transition-all text-sm text-text-secondary hover:text-accent-lavender"
          >
            {obj.name}
          </a>
        ))}
      </div>

      {/* Object Sections */}
      {coreObjects.map((obj) => (
        <section
          key={obj.name}
          id={obj.name.toLowerCase().replace(/\s+/g, "-")}
          className="mb-12"
        >
          <h2>{obj.name}</h2>
          <p className="text-text-secondary mb-4 leading-relaxed">
            {obj.description}
          </p>

          {/* Key Fields */}
          <h3>Key Fields</h3>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2.5 px-4 text-text-muted font-medium">Field</th>
                  <th className="text-left py-2.5 px-4 text-text-muted font-medium">Type</th>
                  <th className="text-left py-2.5 px-4 text-text-muted font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {obj.fields.map((field) => (
                  <tr key={field.name} className="border-b border-border/50">
                    <td className="py-2.5 px-4 font-mono text-xs text-accent-lavender">
                      {field.name}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs text-text-secondary">
                      {field.type}
                    </td>
                    <td className="py-2.5 px-4 text-text-secondary">
                      {field.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Example */}
          <h3>Example</h3>
          <CodeBlock language="json" code={obj.example} />

          {/* Related Endpoints */}
          <h3>Related Endpoints</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {obj.endpoints.map((ep) => {
              const [method, ...pathParts] = ep.split(" ");
              const path = pathParts.join(" ");
              const methodColors: Record<string, string> = {
                GET: "text-accent-green bg-accent-green/10",
                POST: "text-accent-blue bg-accent-blue/10",
                PUT: "text-accent-amber bg-accent-amber/10",
                DELETE: "text-accent-red bg-accent-red/10",
              };
              return (
                <div
                  key={ep}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-card border border-border text-xs"
                >
                  <span
                    className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${
                      methodColors[method] || "text-text-muted bg-bg-hover"
                    }`}
                  >
                    {method}
                  </span>
                  <span className="font-mono text-text-secondary">{path}</span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </DocLayout>
  );
}

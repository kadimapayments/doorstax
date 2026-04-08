"use client";

import DocLayout from "@/components/doc-layout";
import CodeBlock from "@/components/code-block";

export default function SandboxPage() {
  return (
    <DocLayout
      title="Sandbox Environment"
      description="Test your integration against the DoorStax sandbox before going live. The sandbox mirrors production but with test data and simulated payment processing."
      breadcrumbs={[
        { label: "Docs", href: "/" },
        { label: "Guides" },
        { label: "Sandbox" },
      ]}
    >
      {/* Overview */}
      <h2>Overview</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        The DoorStax sandbox is available
        at <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">sandbox.doorstax.com</code>.
        It provides a fully functional copy of the platform with simulated
        payment processing, pre-seeded test data, and isolated environments.
      </p>
      <CodeBlock
        language="text"
        title="Sandbox Base URL"
        code="https://sandbox.doorstax.com/api"
      />

      {/* Getting Test Credentials */}
      <h2>Getting Test Credentials</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Sandbox accounts are provisioned automatically when you sign up for a
        DoorStax developer account. You will receive:
      </p>
      <div className="space-y-3 mb-6">
        {[
          {
            title: "Test User Accounts",
            desc: "Pre-created users for each role (owner, manager, tenant, etc.)",
          },
          {
            title: "Test Properties",
            desc: "Sample properties with units, leases, and tenants",
          },
          {
            title: "Webhook Secret",
            desc: "A sandbox-specific webhook signing secret for testing",
          },
        ].map((item) => (
          <div key={item.title} className="p-4 rounded-lg bg-bg-card border border-border">
            <h4 className="text-sm font-semibold text-text-primary mb-1">
              {item.title}
            </h4>
            <p className="text-sm text-text-muted">{item.desc}</p>
          </div>
        ))}
      </div>
      <CodeBlock
        language="json"
        title="Sandbox Test Accounts"
        code={`{
  "owner": {
    "email": "owner@test.doorstax.com",
    "password": "test-owner-123"
  },
  "manager": {
    "email": "manager@test.doorstax.com",
    "password": "test-manager-123"
  },
  "tenant": {
    "email": "tenant@test.doorstax.com",
    "password": "test-tenant-123"
  },
  "accountant": {
    "email": "accountant@test.doorstax.com",
    "password": "test-accountant-123"
  }
}`}
      />

      {/* Test Payment Methods */}
      <h2>Test Payment Methods</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        The sandbox uses simulated payment processing. Use these test payment
        methods to trigger different outcomes:
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">Method</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Account / Number</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">ACH</td>
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">routing: 110000000 / acct: 000123456789</td>
              <td className="py-3 px-4">
                <span className="text-accent-green text-xs font-medium">Success</span>
              </td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">ACH</td>
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">routing: 110000000 / acct: 000000000001</td>
              <td className="py-3 px-4">
                <span className="text-accent-red text-xs font-medium">Insufficient Funds</span>
              </td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">ACH</td>
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">routing: 110000000 / acct: 000000000002</td>
              <td className="py-3 px-4">
                <span className="text-accent-red text-xs font-medium">Account Closed</span>
              </td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">Card</td>
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">4242 4242 4242 4242</td>
              <td className="py-3 px-4">
                <span className="text-accent-green text-xs font-medium">Success</span>
              </td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">Card</td>
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">4000 0000 0000 0002</td>
              <td className="py-3 px-4">
                <span className="text-accent-red text-xs font-medium">Declined</span>
              </td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">Card</td>
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">4000 0000 0000 9995</td>
              <td className="py-3 px-4">
                <span className="text-accent-red text-xs font-medium">Insufficient Funds</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Environment Differences */}
      <h2>Environment Differences</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Key differences between sandbox and production environments:
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">Feature</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Sandbox</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Production</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-primary font-medium">Base URL</td>
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">sandbox.doorstax.com</td>
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">doorstax.com</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-primary font-medium">Payments</td>
              <td className="py-3 px-4 text-text-secondary">Simulated (no real money)</td>
              <td className="py-3 px-4 text-text-secondary">Real processing via Kadima</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-primary font-medium">Data</td>
              <td className="py-3 px-4 text-text-secondary">Pre-seeded test data, resets weekly</td>
              <td className="py-3 px-4 text-text-secondary">Real customer data</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-primary font-medium">Emails</td>
              <td className="py-3 px-4 text-text-secondary">Captured (not delivered)</td>
              <td className="py-3 px-4 text-text-secondary">Delivered to real addresses</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-primary font-medium">Rate Limits</td>
              <td className="py-3 px-4 text-text-secondary">Relaxed (5x production limits)</td>
              <td className="py-3 px-4 text-text-secondary">Standard limits apply</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-primary font-medium">Webhooks</td>
              <td className="py-3 px-4 text-text-secondary">Instant delivery (no delay)</td>
              <td className="py-3 px-4 text-text-secondary">Real-time with retry policy</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-primary font-medium">Screening</td>
              <td className="py-3 px-4 text-text-secondary">Mock results returned instantly</td>
              <td className="py-3 px-4 text-text-secondary">Real RentSpree screening</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="p-4 rounded-lg bg-accent-purple/5 border border-accent-purple/20">
        <p className="text-sm text-text-secondary">
          <strong className="text-accent-lavender">Tip:</strong> Sandbox data resets every
          Sunday at midnight UTC. Save any test configurations you want to preserve.
          You can also trigger a manual reset from the sandbox dashboard.
        </p>
      </div>
    </DocLayout>
  );
}

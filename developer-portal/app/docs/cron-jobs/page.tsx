"use client";

import DocLayout from "@/components/doc-layout";
import CodeBlock from "@/components/code-block";

export default function CronJobsPage() {
  return (
    <DocLayout
      title="Scheduled Jobs (Cron)"
      description="12 automated background jobs that power billing, notifications, and reconciliation."
      breadcrumbs={[
        { label: "Docs", href: "/" },
        { label: "Guides" },
        { label: "Cron Jobs" },
      ]}
    >
      {/* Overview */}
      <h2>Overview</h2>
      <p className="text-text-secondary mb-6 leading-relaxed">
        DoorStax runs 12 scheduled background jobs that handle recurring billing,
        notification delivery, financial reconciliation, and data maintenance.
        All jobs are protected by the <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">withCronGuard</code> middleware,
        which verifies the <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">CRON_SECRET</code> header,
        prevents overlapping executions, and records each run in the
        <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">CronRun</code> model.
      </p>

      {/* Job Reference */}
      <h2>Job Reference</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        The following table lists all scheduled jobs, their cron schedules, and
        what they do.
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">Job</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Schedule</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Timing</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">generate-charges</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">0 6 1 * *</td>
              <td className="py-3 px-4 text-text-secondary">1st of month, 6 AM UTC</td>
              <td className="py-3 px-4 text-text-secondary">Creates monthly rent CHARGE ledger entries</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">generate-statements</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">0 8 1 * *</td>
              <td className="py-3 px-4 text-text-secondary">1st of month, 8 AM UTC</td>
              <td className="py-3 px-4 text-text-secondary">Generates owner statement PDFs</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-green">recurring-expenses</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">0 7 1 * *</td>
              <td className="py-3 px-4 text-text-secondary">1st of month, 7 AM UTC</td>
              <td className="py-3 px-4 text-text-secondary">Duplicates recurring expenses and tenant invoicing</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">lease-expiration</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">0 7 * * *</td>
              <td className="py-3 px-4 text-text-secondary">Daily, 7 AM UTC</td>
              <td className="py-3 px-4 text-text-secondary">Tiered lease expiry alerts (90/60/30/14/7 days)</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">reconciliation</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">0 9 * * *</td>
              <td className="py-3 px-4 text-text-secondary">Daily, 9 AM UTC</td>
              <td className="py-3 px-4 text-text-secondary">Ledger balance verification and auto-fix</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">retry-webhooks</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">30 9 * * *</td>
              <td className="py-3 px-4 text-text-secondary">Daily, 9:30 AM UTC</td>
              <td className="py-3 px-4 text-text-secondary">Retries failed webhook deliveries</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-amber">generate-payouts</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">0 10 2 * *</td>
              <td className="py-3 px-4 text-text-secondary">2nd of month, 10 AM UTC</td>
              <td className="py-3 px-4 text-text-secondary">Calculates owner payouts</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">financial-reconciliation</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">0 11 * * *</td>
              <td className="py-3 px-4 text-text-secondary">Daily, 11 AM UTC</td>
              <td className="py-3 px-4 text-text-secondary">Kadima to local payment matching</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-blue">process-jobs</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">0 12 * * *</td>
              <td className="py-3 px-4 text-text-secondary">Daily, 12 PM UTC</td>
              <td className="py-3 px-4 text-text-secondary">Drains queued background jobs</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">autopay-reminders</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">0 14 * * *</td>
              <td className="py-3 px-4 text-text-secondary">Daily, 2 PM UTC</td>
              <td className="py-3 px-4 text-text-secondary">Pre-charge and enrollment reminders</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">rent-reminders</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">0 15 * * *</td>
              <td className="py-3 px-4 text-text-secondary">Daily, 3 PM UTC</td>
              <td className="py-3 px-4 text-text-secondary">3-day reminder for non-autopay tenants</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-red">overdue-notices</td>
              <td className="py-3 px-4 font-mono text-xs text-text-secondary">0 16 * * *</td>
              <td className="py-3 px-4 text-text-secondary">Daily, 4 PM UTC</td>
              <td className="py-3 px-4 text-text-secondary">Escalating overdue notices (1/5/15/30 days)</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Cron Guard */}
      <h2>Cron Guard</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        All cron endpoints are wrapped with the <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">withCronGuard</code> middleware
        that provides three layers of protection:
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">Protection</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">Secret Verification</td>
              <td className="py-3 px-4 text-text-secondary">Validates the CRON_SECRET header matches the environment variable</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">Overlap Prevention</td>
              <td className="py-3 px-4 text-text-secondary">Checks for an active CronRun with status RUNNING and skips if found</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 text-text-secondary">Run Tracking</td>
              <td className="py-3 px-4 text-text-secondary">Creates a CronRun record with start time, updates with status and duration on completion</td>
            </tr>
          </tbody>
        </table>
      </div>
      <CodeBlock
        language="javascript"
        title="withCronGuard Usage"
        code={`import { withCronGuard } from "@/lib/cron-guard";

export const POST = withCronGuard("generate-charges", async () => {
  // Find all active leases
  const leases = await prisma.lease.findMany({
    where: { status: "ACTIVE" },
    include: { unit: true, property: true },
  });

  let created = 0;
  for (const lease of leases) {
    await prisma.ledgerEntry.create({
      data: {
        type: "CHARGE",
        amount: lease.rentAmount,
        leaseId: lease.id,
        description: \`Rent - \${format(new Date(), "MMMM yyyy")}\`,
      },
    });
    created++;
  }

  return { chargesCreated: created };
});`}
      />

      {/* Monitoring */}
      <h2>Monitoring</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Every cron execution is tracked in the <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">CronRun</code> model.
        This provides a full audit log of when each job ran, how long it took,
        whether it succeeded or failed, and a summary JSON with job-specific
        metrics.
      </p>
      <CodeBlock
        language="json"
        title="CronRun Record"
        code={`{
  "id": "crun_001",
  "jobName": "generate-charges",
  "status": "COMPLETED",
  "startedAt": "2025-02-01T06:00:00.000Z",
  "completedAt": "2025-02-01T06:00:12.340Z",
  "durationMs": 12340,
  "summary": {
    "chargesCreated": 847,
    "leasesProcessed": 847,
    "errors": 0
  }
}`}
      />
      <div className="p-4 rounded-lg bg-accent-amber/5 border border-accent-amber/20">
        <p className="text-sm text-text-secondary">
          <strong className="text-accent-amber">Best Practice:</strong> Monitor CronRun
          records for jobs with status <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">FAILED</code> or
          unusually long durations. Set up alerts for any job that has not run
          within its expected schedule window.
        </p>
      </div>
    </DocLayout>
  );
}

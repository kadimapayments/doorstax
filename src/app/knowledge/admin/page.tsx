export const metadata = { title: "Admin Guide — DoorStax Help Center" };

export default function AdminKnowledgeBase() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Admin Guide</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform administration and system management
        </p>
      </div>

      <div className="space-y-8">
        <Section title="Platform Overview">
          <Article title="Admin dashboard" description="Key metrics and platform health" />
          <Article title="Revenue model" description="How DoorStax earns from card, ACH, and subscriptions" />
          <Article title="Tier structure" description="Starter, Growth, Scale, Enterprise explained" />
        </Section>

        <Section title="Managing PMs">
          <Article title="PM onboarding" description="The 30-day merchant application process" />
          <Article title="Terminal provisioning" description="Assigning Kadima terminals to properties" />
          <Article title="Tier changes" description="How tier crossing works and what to do in Kadima" />
          <Article title="Impersonation" description="Viewing a PM's dashboard as an admin" />
        </Section>

        <Section title="Agent Network">
          <Article title="Inviting agents" description="Creating SDR agents with referral codes" />
          <Article title="Agent payouts" description="Monthly kickback calculation and processing" />
          <Article title="Profit calculator" description="Using the calculator for sales calls" />
          <Article title="Proposal tracking" description="Open, click, and conversion metrics" />
        </Section>

        <Section title="System Configuration">
          <Article title="Staff management" description="Adding admin staff with role permissions" />
          <Article title="White label" description="Configuring custom branding for PMs" />
          <Article title="Audit log" description="Tracking admin actions and changes" />
        </Section>
      </div>

      <div className="mt-12 rounded-xl bg-muted/30 border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          For technical support, contact{" "}
          <a href="mailto:dev@doorstax.com" className="text-primary hover:underline">
            dev@doorstax.com
          </a>
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

function Article({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 hover:border-primary/30 transition-colors cursor-pointer">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  );
}

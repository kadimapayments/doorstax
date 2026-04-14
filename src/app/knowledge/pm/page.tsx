export const metadata = { title: "PM Guide — DoorStax Help Center" };

export default function PMKnowledgeBase() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Property Manager Guide</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Everything you need to manage properties with DoorStax
        </p>
      </div>

      <div className="space-y-8">
        <Section title="Getting Started">
          <Article title="Creating your account" description="How to sign up and complete onboarding" />
          <Article title="Adding your first property" description="Set up properties, units, and owners" />
          <Article title="Inviting tenants" description="How to add tenants and send invitations" />
          <Article title="Setting up payments" description="Configure payment processing and fee schedules" />
        </Section>

        <Section title="Payments & Billing">
          <Article title="Fee schedule setup" description="Configure ACH rates, card fees, and who pays" />
          <Article title="Processing rent payments" description="How tenants pay and how you get paid" />
          <Article title="Owner payouts" description="Automated distributions to property owners" />
          <Article title="Understanding your earnings" description="Card and ACH residuals explained" />
        </Section>

        <Section title="Applications & Screening">
          <Article title="Creating application templates" description="Build custom application forms" />
          <Article title="Reviewing applications" description="How to review and approve applicants" />
          <Article title="Tenant screening" description="Using RentSpree for background checks" />
        </Section>

        <Section title="Property Management">
          <Article title="Managing units" description="Add, edit, and manage rental units" />
          <Article title="Expense tracking" description="Track expenses and invoice tenants" />
          <Article title="Parking management" description="Allocate spaces and manage parking" />
          <Article title="Team management" description="Add staff with role-based permissions" />
        </Section>
      </div>

      <Footer />
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

function Footer() {
  return (
    <div className="mt-12 rounded-xl bg-muted/30 border p-6 text-center">
      <p className="text-sm text-muted-foreground">
        Can&apos;t find what you&apos;re looking for? Contact support at{" "}
        <a href="mailto:support@doorstax.com" className="text-primary hover:underline">
          support@doorstax.com
        </a>
      </p>
    </div>
  );
}

export const metadata = { title: "Tenant Guide — DoorStax Help Center" };

export default function TenantKnowledgeBase() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Tenant Guide</h1>
        <p className="text-sm text-muted-foreground mt-1">
          How to use the DoorStax tenant portal
        </p>
      </div>

      <div className="space-y-8">
        <Section title="Getting Started">
          <Article title="Accepting your invitation" description="How to set up your tenant account" />
          <Article title="Your tenant dashboard" description="Overview of what you can do" />
          <Article title="Setting up payment methods" description="Add a card or bank account" />
        </Section>

        <Section title="Paying Rent">
          <Article title="Making a payment" description="Pay rent online with card or ACH" />
          <Article title="Setting up autopay" description="Never miss a payment with automatic billing" />
          <Article title="Payment history" description="View receipts and transaction history" />
          <Article title="Understanding fees" description="ACH and card processing fees explained" />
        </Section>

        <Section title="Your Account">
          <Article title="Viewing your lease" description="Access lease details and documents" />
          <Article title="Submitting maintenance requests" description="Report issues and track repairs" />
          <Article title="Updating your profile" description="Change your contact information" />
        </Section>
      </div>

      <div className="mt-12 rounded-xl bg-muted/30 border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Need help? Contact your property manager or email{" "}
          <a href="mailto:support@doorstax.com" className="text-primary hover:underline">
            support@doorstax.com
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

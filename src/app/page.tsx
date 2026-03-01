import Image from "next/image";
import Link from "next/link";
import { Building2, CreditCard, Users, ShieldCheck, BarChart3, Globe } from "lucide-react";

const features = [
  {
    icon: Building2,
    title: "Property Management",
    description: "Add properties and units, track occupancy, and manage your entire portfolio from one dashboard.",
  },
  {
    icon: CreditCard,
    title: "Rent Collection",
    description: "Collect rent via ACH or card with automatic reconciliation and real-time status updates.",
  },
  {
    icon: Users,
    title: "Tenant Portal",
    description: "Tenants pay rent, set up autopay, and view payment history through their own secure portal.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Payments",
    description: "PCI-compliant tokenized payments powered by Kadima Gateway. No card data ever touches your servers.",
  },
  {
    icon: BarChart3,
    title: "Reports & Analytics",
    description: "Track collection rates, failed payments, and monthly volume across your entire portfolio.",
  },
  {
    icon: Globe,
    title: "Availability Listings",
    description: "Publish vacancies with SEO-optimized listing pages and accept rental applications online.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-border bg-bg-primary/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Image src="/logo-white.svg" alt="DoorStax" width={140} height={32} priority />
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-white hover:bg-accent-purple/90 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 pt-40 pb-24 text-center">
        <h1 className="max-w-3xl text-5xl font-extrabold leading-tight tracking-tight text-text-primary sm:text-6xl">
          <span className="gradient-text">Stack More.</span>{" "}
          <span className="gradient-text">Earn More.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-text-secondary">
          The landlord-first rent collection platform. Manage properties, collect
          payments, and grow your portfolio — all powered by secure ACH and card
          processing.
        </p>
        <div className="mt-10 flex items-center gap-4">
          <Link
            href="/register"
            className="rounded-xl bg-gradient-to-r from-accent-lavender to-accent-purple px-8 py-3 text-base font-bold text-white shadow-lg shadow-accent-purple/25 hover:shadow-accent-purple/40 transition-shadow"
          >
            Start Free
          </Link>
          <Link
            href="/listings"
            className="rounded-xl border border-border px-8 py-3 text-base font-medium text-text-secondary hover:text-text-primary hover:border-text-muted transition-colors"
          >
            View Listings
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-border bg-bg-card p-6 transition-colors hover:border-accent-purple/30"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-purple/10">
                <feature.icon className="h-5 w-5 text-accent-lavender" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-bg-secondary">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
          <h2 className="text-3xl font-bold text-text-primary sm:text-4xl">
            Ready to streamline your rent collection?
          </h2>
          <p className="mt-4 text-text-secondary">
            Join landlords who are saving time and collecting rent faster with DoorStax.
          </p>
          <Link
            href="/register"
            className="mt-8 rounded-xl bg-gradient-to-r from-accent-lavender to-accent-purple px-8 py-3 text-base font-bold text-white shadow-lg shadow-accent-purple/25 hover:shadow-accent-purple/40 transition-shadow"
          >
            Create Your Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-bg-primary">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
          <Image src="/logo-white.svg" alt="DoorStax" width={110} height={26} />
          <p className="text-xs text-text-muted">
            Powered by{" "}
            <span className="font-medium text-text-secondary">Kadima Payments</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

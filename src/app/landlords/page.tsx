import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  CreditCard,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Zap,
  Users,
  BarChart3,
  Bell,
  FileText,
  CalendarDays,
  AlertTriangle,
  Receipt,
  RefreshCw,
  DollarSign,
} from "lucide-react";
import { TrustBadges } from "@/components/ui/trust-badges";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import { DashboardMockup } from "@/components/marketing/dashboard-mockup";
import { CalendarMockup } from "@/components/marketing/calendar-mockup";
import { LeaseAlertsMockup } from "@/components/marketing/lease-alerts-mockup";
import { MigrationMockup } from "@/components/marketing/migration-mockup";
import "../marketing.css";

/* ─── Data ────────────────────────────────────────────── */

const painPoints = [
  {
    icon: Clock,
    title: "Chasing late rent?",
    description: "Automated reminders and autopay enrollment mean fewer calls and fewer late payments.",
  },
  {
    icon: CreditCard,
    title: "Juggling payment methods?",
    description: "Accept ACH bank transfers and card payments from one platform. No more Zelle, Venmo, or paper checks.",
  },
  {
    icon: BarChart3,
    title: "No visibility into payments?",
    description: "See who paid, who is pending, and who failed — in real time from your landlord dashboard.",
  },
];

const capabilities = [
  {
    icon: CreditCard,
    title: "Online Rent Collection",
    description: "Tenants pay via ACH or card directly through their portal. You see every payment in real-time with instant notifications when rent is paid.",
  },
  {
    icon: DollarSign,
    title: "Transparent Fee Structure",
    description: "Choose who pays processing fees — you, your tenant, or split it. Card surcharges can be passed through to tenants at no cost to you.",
  },
  {
    icon: RefreshCw,
    title: "Autopay for Tenants",
    description: "Tenants set up autopay once and never miss a due date. Pre-charge notifications, smart retries on failures, and automatic pause after max attempts.",
  },
  {
    icon: Bell,
    title: "Automated Reminders & Notices",
    description: "Rent reminders 3 days before due. Escalating overdue notices at 1, 5, 15, and 30 days late. Lease expiration alerts at 90, 60, 30, 14, and 7 days.",
  },
  {
    icon: Receipt,
    title: "Expense Tracking",
    description: "Record maintenance, repairs, and other expenses against your properties. Assign charges to tenants with automatic invoicing, or deduct from owner payouts.",
  },
  {
    icon: BarChart3,
    title: "Financial Reporting",
    description: "Monthly owner statements, payment history, income reports, and delinquency tracking. Export to CSV or download PDF reports anytime.",
  },
  {
    icon: FileText,
    title: "Lease Management",
    description: "Create leases, track expirations, upload documents, and manage addendums. Automatic alerts when leases are approaching expiry.",
  },
  {
    icon: ShieldCheck,
    title: "Secure & PCI Compliant",
    description: "Bank-grade security with PCI-compliant card tokenization. No sensitive payment data stored on your servers. Full audit trail for every transaction.",
  },
];

const pricingTiers = [
  { units: 10, monthly: 150, perUnit: "15.00" },
  { units: 25, monthly: 150, perUnit: "6.00" },
  { units: 50, monthly: 150, perUnit: "3.00" },
  { units: 75, monthly: 225, perUnit: "3.00" },
  { units: 100, monthly: 300, perUnit: "3.00" },
];

const onboardingSteps = [
  {
    title: "Create your account",
    description: "Sign up in under 5 minutes. No credit card required to start your free trial.",
    time: "5 minutes",
  },
  {
    title: "Add your properties and units",
    description: "Enter your buildings, unit numbers, and rent amounts. CSV import from Buildium, AppFolio, Yardi, Rent Manager — or use our template for instant setup.",
    time: "10 minutes with CSV import",
  },
  {
    title: "Invite your tenants",
    description: "Tenants receive an email to create their account and set up their preferred payment method.",
    time: "Tenants self-onboard",
  },
  {
    title: "Collect rent automatically",
    description: "Sit back as payments flow in on schedule. View everything from your dashboard.",
    time: "Ongoing",
  },
];

/* ─── Page ────────────────────────────────────────────── */

export default function LandlordsLandingPage() {
  return (
    <div className="marketing-page min-h-screen bg-bg-primary overflow-x-hidden">
      {/* ── Navigation ────────────────────────────────── */}
      <nav className="fixed top-0 z-50 w-full border-b border-border bg-bg-primary/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/">
            <Image src="/logo-white.svg" alt="DoorStax" width={140} height={32} priority />
          </Link>
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
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center px-6 pt-40 pb-20 text-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[600px] w-[600px] rounded-full bg-accent-purple/10 blur-3xl" />
        </div>

        <div className="relative mb-6 inline-flex items-center gap-2 rounded-full border border-accent-lavender/30 bg-accent-lavender/10 px-4 py-1.5 text-xs font-semibold text-accent-lavender animate-fade-in-up">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-lavender animate-pulse" />
          For Landlords &amp; Property Owners
        </div>

        <h1 className="relative max-w-4xl text-5xl font-extrabold leading-tight tracking-tight text-text-primary sm:text-6xl animate-fade-in-up">
          Effortless Rent Collection{" "}
          <span className="gradient-text">for Landlords</span>
        </h1>

        <p
          className="relative mt-6 max-w-2xl text-lg text-text-secondary animate-fade-in-up"
          style={{ animationDelay: "80ms" }}
        >
          Accept ACH and card payments from your tenants. Automated reminders,
          real-time tracking, and clean financial reporting — all from one dashboard.
        </p>

        <div
          className="relative mt-6 max-w-md text-left space-y-2.5 animate-fade-in-up"
          style={{ animationDelay: "120ms" }}
        >
          {[
            "No payment chasing — tenants pay online",
            "ACH and card acceptance included",
            "Real-time payment status dashboard",
            "Automatic late payment reminders",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-accent-lavender shrink-0" />
              <span className="text-sm font-medium text-text-primary">{item}</span>
            </div>
          ))}
        </div>

        <div
          className="relative mt-10 flex flex-col sm:flex-row items-center gap-4 animate-fade-in-up"
          style={{ animationDelay: "160ms" }}
        >
          <Link
            href="/register"
            className="rounded-xl bg-gradient-to-r from-accent-lavender to-accent-purple px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-accent-purple/25 hover:shadow-accent-purple/40 transition-shadow"
          >
            Start Your Free 14-Day Trial
          </Link>
          <Link
            href="#pricing"
            className="rounded-xl border border-border px-8 py-3.5 text-base font-medium text-text-secondary hover:text-text-primary hover:border-text-muted transition-colors"
          >
            See Pricing
          </Link>
        </div>

        <div
          className="relative mt-12 flex flex-col items-center gap-2 animate-fade-in-up"
          style={{ animationDelay: "240ms" }}
        >
          <p className="text-xs text-text-muted">Secured by</p>
          <TrustBadges variant="full" showPci={true} />
        </div>
      </section>

      {/* ── Pain Points ───────────────────────────────── */}
      <section className="bg-bg-secondary py-20 px-6">
        <div className="mx-auto max-w-4xl text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-lavender mb-4">
            Sound Familiar?
          </p>
          <h2 className="text-3xl font-bold text-text-primary sm:text-4xl">
            Collecting rent shouldn&apos;t be this hard
          </h2>
        </div>

        <div className="mx-auto max-w-4xl grid gap-6 sm:grid-cols-3 animate-stagger">
          {painPoints.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-border bg-bg-card p-6 card-hover"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-purple/10">
                <card.icon className="h-5 w-5 text-accent-lavender" />
              </div>
              <h3 className="text-base font-semibold text-text-primary">{card.title}</h3>
              <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Capabilities ──────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-4xl text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-lavender mb-4">
            What You Get
          </p>
          <h2 className="text-3xl font-bold text-text-primary sm:text-4xl">
            Everything you need to{" "}
            <span className="gradient-text">collect rent online</span>
          </h2>
        </div>

        <div className="mx-auto max-w-5xl grid gap-6 sm:grid-cols-2 lg:grid-cols-3 animate-stagger">
          {capabilities.map((cap) => (
            <div
              key={cap.title}
              className="rounded-2xl border border-border bg-bg-card p-6 card-hover"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-purple/10">
                <cap.icon className="h-5 w-5 text-accent-lavender" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary">{cap.title}</h3>
              <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                {cap.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Platform Preview ─────────────────────────── */}
      <section className="bg-bg-secondary py-20 px-6">
        <div className="mx-auto max-w-4xl text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-lavender mb-4">
            See the Platform
          </p>
          <h2 className="text-3xl font-bold text-text-primary sm:text-4xl">
            Everything you need,{" "}
            <span className="gradient-text">one dashboard</span>
          </h2>
        </div>

        <div className="mx-auto max-w-4xl">
          <BrowserFrame url="doorstax.com/dashboard">
            <DashboardMockup />
          </BrowserFrame>
        </div>

        <div className="mx-auto mt-8 max-w-4xl grid gap-8 grid-cols-1 sm:grid-cols-3 max-w-xs sm:max-w-4xl animate-stagger">
          <div>
            <BrowserFrame url="doorstax.com/dashboard/calendar">
              <CalendarMockup />
            </BrowserFrame>
            <p className="mt-3 text-center text-sm font-semibold text-text-primary">Interactive Calendar</p>
            <p className="mt-1 text-center text-xs text-text-muted">iCal sync with Google Calendar &amp; Outlook</p>
          </div>
          <div>
            <BrowserFrame url="doorstax.com/dashboard/leases">
              <LeaseAlertsMockup />
            </BrowserFrame>
            <p className="mt-3 text-center text-sm font-semibold text-text-primary">Lease Expiration Tracking</p>
            <p className="mt-1 text-center text-xs text-text-muted">30/60/90 day alerts, never miss a renewal</p>
          </div>
          <div>
            <BrowserFrame url="doorstax.com/dashboard/properties/migrate">
              <MigrationMockup />
            </BrowserFrame>
            <p className="mt-3 text-center text-sm font-semibold text-text-primary">Easy CSV Migration</p>
            <p className="mt-1 text-center text-xs text-text-muted">Import from any platform in minutes</p>
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────── */}
      <section id="pricing" className="py-20 px-6">
        <div className="mx-auto max-w-4xl text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-lavender mb-4">
            Transparent Pricing
          </p>
          <h2 className="text-3xl font-bold text-text-primary sm:text-4xl">
            Simple, <span className="gradient-text">flat-rate</span> pricing
          </h2>
          <p className="mt-4 text-text-secondary max-w-xl mx-auto">
            No percentage of rent. No hidden fees. Starting at $150/month for up to 50 units,
            then $3 per additional unit.
          </p>
        </div>

        <div className="mx-auto max-w-md rounded-2xl gradient-border p-px">
          <div className="rounded-2xl bg-bg-primary p-8">
            <div className="text-center mb-6">
              <p className="text-sm font-semibold text-accent-lavender uppercase tracking-wider mb-2">
                Landlord Plan
              </p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl font-extrabold text-text-primary">$150</span>
                <span className="text-text-muted text-sm">/ month</span>
              </div>
              <p className="mt-2 text-sm text-text-muted">
                Includes up to 50 units. $3/unit above 50.
              </p>
              <p className="mt-3 text-xs text-accent-lavender font-semibold">
                14-Day Free Trial — No credit card required
              </p>
            </div>

            <div className="space-y-2.5 mb-8">
              {[
                "Unlimited properties and buildings",
                "ACH and card payment acceptance",
                "Tenant portal with autopay",
                "Payment tracking and reporting",
                "Automated late payment reminders",
                "Immutable payment audit trail",
                "Interactive calendar with iCal sync",
                "Lease expiration alerts dashboard",
                "Automated daily reconciliation",
                "CSV import from any platform",
                "Vacancy listings and online applications",
                "PCI-compliant security",
                "14-day free trial, cancel anytime",
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-accent-lavender shrink-0" />
                  <span className="text-sm text-text-secondary">{feature}</span>
                </div>
              ))}
            </div>

            <Link
              href="/register"
              className="block w-full rounded-xl bg-gradient-to-r from-accent-lavender to-accent-purple px-6 py-3 text-center text-base font-bold text-white shadow-lg shadow-accent-purple/25 hover:shadow-accent-purple/40 transition-shadow"
            >
              Start Free Trial
              <ArrowRight className="inline-block ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* What you get */}
        <div className="mx-auto mt-10 max-w-3xl">
          <h3 className="text-sm font-semibold text-text-secondary mb-4 text-center uppercase tracking-wider">
            What&apos;s included — every plan
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-bg-card p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent-purple/10">
                  <DollarSign className="h-4 w-4 text-accent-lavender" />
                </div>
                <div>
                  <p className="font-semibold text-text-primary">Unlimited tenants &amp; payments</p>
                  <p className="mt-1 text-sm text-text-muted">No per-transaction fees. No per-tenant fees. Collect rent as often as you need.</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-bg-card p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent-purple/10">
                  <RefreshCw className="h-4 w-4 text-accent-lavender" />
                </div>
                <div>
                  <p className="font-semibold text-text-primary">Automated owner payouts</p>
                  <p className="mt-1 text-sm text-text-muted">ACH credit directly to bank accounts. No checks. No reconciliation gymnastics.</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-bg-card p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent-purple/10">
                  <ShieldCheck className="h-4 w-4 text-accent-lavender" />
                </div>
                <div>
                  <p className="font-semibold text-text-primary">Pass card fees to tenants</p>
                  <p className="mt-1 text-sm text-text-muted">Keep 100% of your rent. Card surcharges are handled automatically.</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-bg-card p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent-purple/10">
                  <BarChart3 className="h-4 w-4 text-accent-lavender" />
                </div>
                <div>
                  <p className="font-semibold text-text-primary">Real-time financial reporting</p>
                  <p className="mt-1 text-sm text-text-muted">Gross, fees, net — every property, every month, instantly. Tax-ready 1099s.</p>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-5 text-center text-xs text-text-muted">
            Same features on every plan. No feature gating. No surprise charges.
          </p>
        </div>
      </section>

      {/* ── Onboarding Steps ──────────────────────────── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-4xl text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-lavender mb-4">
            Getting Started
          </p>
          <h2 className="text-3xl font-bold text-text-primary sm:text-4xl">
            Go live in <span className="gradient-text">under 48 hours</span>
          </h2>
        </div>

        <div className="mx-auto max-w-3xl">
          <div className="relative space-y-8">
            <div className="absolute left-5 top-0 bottom-0 w-px bg-border hidden sm:block" />
            {onboardingSteps.map((step, i) => (
              <div key={step.title} className="relative flex gap-5">
                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-purple text-white text-sm font-bold shadow-md">
                  {i + 1}
                </div>
                <div className="pt-1.5">
                  {i === 0 ? (
                    <Link href="/register" className="text-base font-semibold text-text-primary hover:text-accent-purple transition-colors">
                      {step.title} <ArrowRight className="inline h-4 w-4" />
                    </Link>
                  ) : (
                    <h3 className="text-base font-semibold text-text-primary">{step.title}</h3>
                  )}
                  <p className="mt-1 text-sm text-text-secondary">{step.description}</p>
                  <p className="mt-1 text-xs text-accent-lavender font-medium">{step.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Easy Migration ──────────────────────────────── */}
      <section className="bg-bg-secondary py-20 px-6">
        <div className="mx-auto max-w-5xl grid gap-10 lg:grid-cols-2 items-center">
          <div>
            <BrowserFrame url="doorstax.com/dashboard/properties/migrate">
              <MigrationMockup />
            </BrowserFrame>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent-lavender mb-4">
              Seamless Migration
            </p>
            <h2 className="text-3xl font-bold text-text-primary sm:text-4xl">
              Switching platforms?{" "}
              <span className="gradient-text">Import in minutes.</span>
            </h2>
            <p className="mt-4 text-text-secondary">
              Export from your current platform, upload the CSV, and DoorStax creates everything automatically.
            </p>
            <div className="mt-6 space-y-3">
              {[
                "Works with Buildium, AppFolio, Yardi, Rent Manager, and more",
                "Auto-maps columns — no manual field matching",
                "Preview before you import",
                "Properties and units created instantly",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-accent-lavender mt-0.5 shrink-0" />
                  <span className="text-sm text-text-secondary">{item}</span>
                </div>
              ))}
            </div>
            <Link
              href="/register"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent-lavender to-accent-purple px-6 py-3 text-base font-bold text-white shadow-lg shadow-accent-purple/25 hover:shadow-accent-purple/40 transition-shadow"
            >
              Start Free Trial & Import
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────── */}
      <section className="relative py-24 px-6 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[500px] w-[500px] rounded-full bg-accent-purple/8 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-text-primary sm:text-4xl">
            Stop chasing payments.{" "}
            <span className="gradient-text">Start collecting rent automatically.</span>
          </h2>
          <p className="mt-4 text-text-secondary max-w-xl mx-auto">
            Join landlords across the country who are simplifying rent collection
            with DoorStax. Set it up once, collect forever.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="rounded-xl bg-gradient-to-r from-accent-lavender to-accent-purple px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-accent-purple/25 hover:shadow-accent-purple/40 transition-shadow"
            >
              Start Your Free 14-Day Trial
            </Link>
            <a
              href="mailto:support@doorstax.com"
              className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Questions? Contact Us
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────── */}
      <footer className="border-t border-border bg-bg-primary">
        <div className="mx-auto max-w-6xl px-6 py-8 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col items-center sm:items-start">
              <Image src="/logo-white.svg" alt="DoorStax" width={110} height={26} />
              <p className="text-xs text-text-muted mt-1">DoorStax Payment Network</p>
            </div>
            <div className="flex items-center gap-6 text-xs text-text-muted">
              <Link href="/terms" className="hover:text-text-secondary transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-text-secondary transition-colors">Privacy</Link>
              <Link href="/listings" className="hover:text-text-secondary transition-colors">Listings</Link>
            </div>
            <p className="text-xs text-text-muted">
              Powered by{" "}
              <a href="https://kadimapayments.com" target="_blank" rel="noopener noreferrer" className="font-medium text-text-secondary hover:text-accent-lavender transition-colors">Kadima Payments</a>
            </p>
          </div>
          <div className="border-t border-border/50 pt-4 flex justify-center">
            <TrustBadges variant="footer" />
          </div>
        </div>
      </footer>
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  CreditCard,
  Users,
  ShieldCheck,
  BarChart3,
  RefreshCw,
  DollarSign,
  Bell,
  Zap,
  Clock,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  HelpCircle,
  Send,
  CalendarDays,
  AlertTriangle,
  ClipboardCheck,
  FileText,
  Upload,
  UserCheck,
  Receipt,
  Landmark,
  Gavel,
} from "lucide-react";
import { TrustBadges } from "@/components/ui/trust-badges";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import { DashboardMockup } from "@/components/marketing/dashboard-mockup";
import { CalendarMockup } from "@/components/marketing/calendar-mockup";
import { UnpaidRentMockup } from "@/components/marketing/unpaid-rent-mockup";
import { PayoutMockup } from "@/components/marketing/payout-mockup";
import { MigrationMockup } from "@/components/marketing/migration-mockup";
import "../marketing.css";

/* ─── Data Arrays ─────────────────────────────────────── */

const painCards = [
  {
    icon: Clock,
    question: "How many hours does your team spend chasing late payments each month?",
    consequence: "Every hour on collections is an hour not spent on growth.",
  },
  {
    icon: RefreshCw,
    question: "Is reconciling payments across multiple banks and buildings still a manual process?",
    consequence: "Errors in reconciliation lead to delayed owner statements and disputes.",
  },
  {
    icon: HelpCircle,
    question: "Do you know exactly which units paid, which are pending, and which failed — right now?",
    consequence: "Without real-time visibility, you're always operating a month behind.",
  },
  {
    icon: Users,
    question: "Are your tenants calling the office to ask how to pay rent?",
    consequence: "A modern portfolio needs a modern payment experience.",
  },
  {
    icon: DollarSign,
    question: "Are your payment costs eating into your management margins?",
    consequence: "The right platform turns payment processing into a revenue opportunity.",
  },
  {
    icon: TrendingUp,
    question: "What if your rent collection could generate passive income?",
    consequence: "Property managers on the right platform earn revenue on every transaction.",
  },
];

const capabilities = [
  {
    icon: Zap,
    title: "Automated Rent Collection",
    description:
      "Tenants receive automatic payment reminders, pay via card or ACH, and set up autopay. No more chasing.",
  },
  {
    icon: Building2,
    title: "Centralized Portfolio View",
    description:
      "See every property, every unit, every payment status across your entire portfolio from one dashboard.",
  },
  {
    icon: RefreshCw,
    title: "Instant Reconciliation",
    description:
      "Payments are matched to units automatically. Export clean ledgers for your accountant or property owners.",
  },
  {
    icon: DollarSign,
    title: "Revenue Share on Every Payment",
    description:
      "Earn a share on every card and ACH payment processed through your portfolio. Revenue grows as your portfolio grows.",
  },
  {
    icon: Send,
    title: "Owner Payouts & Statements",
    description:
      "Auto-calculate monthly owner payouts with management fees and expenses deducted. Generate clean owner statements in one click.",
  },
  {
    icon: ClipboardCheck,
    title: "Daily Reconciliation",
    description:
      "Automated daily matching of payments to units. No manual spreadsheet work. Clean ledgers generated automatically every morning.",
  },
  {
    icon: AlertTriangle,
    title: "Unpaid Rent Dashboard",
    description:
      "Centralized view of all overdue payments with aging buckets (30/60/90+ days), tenant search, and one-click reminder sending.",
  },
  {
    icon: CalendarDays,
    title: "Calendar + iCal Sync",
    description:
      "Interactive calendar showing rent due dates, payments, lease expirations, and payouts. Subscribe via iCal for Google Calendar or Outlook.",
  },
];

const features = [
  {
    icon: CreditCard,
    title: "ACH & Card Payments",
    description:
      "Tenants pay via ACH bank transfer or credit/debit card. You control the fee structure — pass surcharges to tenants or absorb them. Funds deposited within 1-3 business days.",
  },
  {
    icon: DollarSign,
    title: "Revenue Share on Every Payment",
    description:
      "Earn a revenue share on every card and ACH payment processed. Revenue grows as your portfolio grows — the more units you manage, the more you earn.",
  },
  {
    icon: RefreshCw,
    title: "Autopay with Smart Retries",
    description:
      "Tenants enroll in autopay once. Payments trigger automatically on the due date with pre-charge notifications, failure handling, and automatic retry logic.",
  },
  {
    icon: Users,
    title: "Tenant Self-Service Portal",
    description:
      "Tenants log in, pay rent, view outstanding charges, download receipts, submit maintenance requests, and manage autopay — all without calling your office.",
  },
  {
    icon: Receipt,
    title: "Expense Management & Invoicing",
    description:
      "Track property and unit expenses. Assign charges to tenants, owners, insurance, or split between parties. Tenant-payable expenses auto-generate invoices with email notifications.",
  },
  {
    icon: Gavel,
    title: "Eviction Tracking",
    description:
      "10-step eviction workflow from notice through resolution. Upload documents, track court dates, add notes. Completion auto-freezes the tenant account and vacates the unit.",
  },
  {
    icon: ShieldCheck,
    title: "PCI-Compliant Tokenization",
    description:
      "Card data is tokenized through the Kadima Gateway. No sensitive data touches your servers. Full vault management for saved cards and bank accounts.",
  },
  {
    icon: Bell,
    title: "20+ Branded Email Notifications",
    description:
      "Automated emails for rent reminders, overdue notices, payment receipts, refunds, chargebacks, lease expirations, and more — all branded with your logo.",
  },
  {
    icon: BarChart3,
    title: "Owner Payouts & Statements",
    description:
      "Auto-calculate monthly owner payouts with management fees and expenses deducted. Generate clean owner statements and send them with one click.",
  },
  {
    icon: FileText,
    title: "Immutable Payment Ledger",
    description:
      "Every payment, charge, refund, and adjustment is logged immutably with timestamps and audit trail. Real-time balance tracking across your entire portfolio.",
  },
  {
    icon: Landmark,
    title: "Refunds & Balance Management",
    description:
      "Issue full or partial refunds directly from the dashboard. Void failed payments with required reasons. Every action creates a ledger entry for complete traceability.",
  },
  {
    icon: CalendarDays,
    title: "13 Automated Cron Jobs",
    description:
      "Rent reminders, overdue notices, autopay processing, lease expiration alerts, recurring expenses, daily reconciliation, and payment summaries — all fully automated.",
  },
];

const includedFeatures = [
  "Unlimited properties and buildings",
  "ACH and card payment processing with surcharge pass-through",
  "Tenant portal with autopay and smart retries",
  "Expense management with tenant invoicing and splits",
  "Revenue share on every payment — rates improve at scale",
  "Kadima Gateway-powered PCI compliance",
  "Owner payouts with automated fee calculations",
  "10-step eviction tracking with document management",
  "20+ branded email templates (reminders, receipts, alerts)",
  "Immutable payment ledger with full audit trail",
  "Full and partial refunds with required reason tracking",
  "13 automated cron jobs (reminders, reconciliation, summaries)",
  "CSV import from Buildium, AppFolio, Yardi, Rent Manager",
  "Lease expiration alerts and tracking",
  "7-step guided tenant onboarding",
  "14-day free trial, cancel anytime",
];

const onboardingSteps = [
  {
    title: "Create your account",
    description: "Sign up, verify your email, and set up your manager profile.",
    time: "5 minutes",
  },
  {
    title: "Complete merchant application",
    description: "Submit your business details through our Kadima-powered merchant onboarding flow.",
    time: "15 minutes",
  },
  {
    title: "Import your portfolio",
    description: "Upload a CSV from your current platform — Buildium, AppFolio, Yardi, Rent Manager — or use our template. Properties, units, and tenants are created automatically.",
    time: "15-30 minutes for any portfolio size",
  },
  {
    title: "Invite your tenants",
    description: "Tenants receive an email to create their portal account and set up payment.",
    time: "Tenants self-onboard",
  },
];

/* ─── Page Component ──────────────────────────────────── */

export default function ManagersLandingPage() {
  return (
    <div className="marketing-page min-h-screen bg-bg-primary overflow-x-hidden">
      {/* ── Navigation ────────────────────────────────── */}
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
          Built for Property Managers with 100+ Units
        </div>

        <h1 className="relative max-w-4xl text-5xl font-extrabold leading-tight tracking-tight text-text-primary sm:text-6xl lg:text-7xl animate-fade-in-up">
          Rent Collection is Broken.{" "}
          <span className="gradient-text">We Built the Fix.</span>
        </h1>

        <p
          className="relative mt-6 max-w-2xl text-lg text-text-secondary animate-fade-in-up"
          style={{ animationDelay: "80ms" }}
        >
          Property management software treats payments like a feature.
          DoorStax treats payments like infrastructure.
        </p>

        <div
          className="relative mt-6 max-w-md text-left space-y-2.5 animate-fade-in-up"
          style={{ animationDelay: "120ms" }}
        >
          {[
            "Direct merchant accounts",
            "ACH and card rails",
            "Automated rent collection",
            "Revenue share for large portfolios",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-accent-lavender shrink-0" />
              <span className="text-sm font-medium text-text-primary">{item}</span>
            </div>
          ))}
        </div>

        <p
          className="relative mt-5 text-sm font-semibold text-text-muted animate-fade-in-up"
          style={{ animationDelay: "140ms" }}
        >
          Built by a payments company — not a property management company.
        </p>

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
            href="#how-it-works"
            className="rounded-xl border border-border px-8 py-3.5 text-base font-medium text-text-secondary hover:text-text-primary hover:border-text-muted transition-colors"
          >
            See How It Works
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

      {/* ── Platform Preview (Hero Mockup) ────────────── */}
      <section className="py-16 px-6">
        <div className="mx-auto max-w-4xl animate-fade-in-up" style={{ animationDelay: "300ms" }}>
          <BrowserFrame url="doorstax.com/dashboard">
            <DashboardMockup />
          </BrowserFrame>
          <p className="mt-4 text-center text-sm text-text-muted">
            Your entire portfolio. One dashboard.
          </p>
        </div>
      </section>

      {/* ── Pain / NEPQ Section ───────────────────────── */}
      <section className="bg-bg-secondary py-20 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-lavender mb-4">
            Sound familiar?
          </p>
          <h2 className="text-3xl font-bold text-text-primary sm:text-4xl">
            Rent collection shouldn&apos;t feel like a second job
          </h2>
          <p className="mt-4 text-text-secondary max-w-xl mx-auto">
            Most property managers are stitching together spreadsheets, bank
            transfers, and manual follow-ups every single month.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-5xl grid gap-5 sm:grid-cols-2 lg:grid-cols-3 animate-stagger">
          {painCards.map((card) => (
            <div
              key={card.question}
              className="rounded-2xl border border-border bg-bg-card p-6 card-hover"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-purple/10">
                <card.icon className="h-5 w-5 text-accent-lavender" />
              </div>
              <h3 className="text-base font-semibold text-text-primary leading-snug">
                {card.question}
              </h3>
              <p className="mt-2 text-sm text-text-muted leading-relaxed">
                {card.consequence}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Platform in Action ───────────────────────── */}
      <section className="section-white py-20 px-6">
        <div className="mx-auto max-w-4xl text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#5B00FF" }}>
            See It in Action
          </p>
          <h2 className="text-3xl sm:text-4xl" style={{ color: "#23297D" }}>
            Built-in tools that <span className="gradient-text">eliminate manual work</span>
          </h2>
        </div>

        <div className="mx-auto max-w-5xl grid gap-8 grid-cols-1 sm:grid-cols-3 max-w-xs sm:max-w-5xl animate-stagger">
          <div>
            <BrowserFrame url="doorstax.com/dashboard/unpaid">
              <UnpaidRentMockup />
            </BrowserFrame>
            <p className="mt-3 text-center text-sm font-semibold" style={{ color: "#23297D" }}>Unpaid Rent at a Glance</p>
            <p className="mt-1 text-center text-xs" style={{ color: "#6E7180" }}>Aging buckets, one-click reminders, tenant search</p>
          </div>
          <div>
            <BrowserFrame url="doorstax.com/dashboard/calendar">
              <CalendarMockup />
            </BrowserFrame>
            <p className="mt-3 text-center text-sm font-semibold" style={{ color: "#23297D" }}>Everything on One Calendar</p>
            <p className="mt-1 text-center text-xs" style={{ color: "#6E7180" }}>Rent, leases, inspections, payouts — with iCal sync</p>
          </div>
          <div>
            <BrowserFrame url="doorstax.com/dashboard/payouts">
              <PayoutMockup />
            </BrowserFrame>
            <p className="mt-3 text-center text-sm font-semibold" style={{ color: "#23297D" }}>Automated Owner Statements</p>
            <p className="mt-1 text-center text-xs" style={{ color: "#6E7180" }}>Fees, expenses, and net payouts calculated automatically</p>
          </div>
        </div>
      </section>

      {/* ── Solution / How It Works ───────────────────── */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-lavender mb-4">
            The Platform
          </p>
          <h2 className="text-3xl font-bold text-text-primary sm:text-4xl">
            Payment infrastructure built for{" "}
            <span className="gradient-text">portfolio-scale</span> management
          </h2>
          <p className="mt-4 text-text-secondary max-w-2xl mx-auto">
            DoorStax handles every step of the rent payment lifecycle — from
            tenant invite to bank deposit — so you can focus on managing
            buildings, not chasing payments.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-5xl grid gap-6 sm:grid-cols-2 animate-stagger">
          {capabilities.map((cap) => (
            <div
              key={cap.title}
              className="flex gap-4 rounded-2xl border border-border bg-bg-card p-6 card-hover"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-purple/10">
                <cap.icon className="h-6 w-6 text-accent-lavender" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-primary">{cap.title}</h3>
                <p className="mt-1 text-sm text-text-secondary leading-relaxed">
                  {cap.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Revenue Opportunity ───────────────────────── */}
      <section className="bg-bg-secondary py-20 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-lavender mb-4">
            The Opportunity
          </p>
          <h2 className="text-3xl font-bold text-text-primary sm:text-4xl">
            Your rent roll is already generating payment volume.{" "}
            <span className="gradient-text">Start earning from it.</span>
          </h2>
          <p className="mt-6 text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            Most property managers pay for payment processing. DoorStax flips the
            model — you earn a revenue share on every card and ACH payment processed
            through your portfolio. The more your portfolio grows, the more you earn.
          </p>

          <div className="mx-auto mt-10 max-w-lg rounded-2xl gradient-border p-px">
            <div className="rounded-2xl bg-bg-primary p-8 space-y-5">
              <div className="flex items-center justify-center gap-2">
                <DollarSign className="h-6 w-6 text-accent-lavender" />
                <h3 className="text-lg font-bold text-text-primary">
                  Revenue Share, Not Revenue Loss
                </h3>
              </div>
              <div className="space-y-3 text-sm text-text-secondary">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-accent-lavender mt-0.5 shrink-0" />
                  <span>Earn revenue on every card and ACH transaction your tenants make</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-accent-lavender mt-0.5 shrink-0" />
                  <span>Card surcharges are passed to the payer — zero cost to you</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-accent-lavender mt-0.5 shrink-0" />
                  <span>You control ACH fee structures for your property owners</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-accent-lavender mt-0.5 shrink-0" />
                  <span>Revenue share rates improve automatically as your portfolio scales</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-accent-lavender mt-0.5 shrink-0" />
                  <span>All earnings tracked and reported in your dashboard</span>
                </div>
              </div>
              <Link
                href="/register"
                className="block w-full rounded-xl bg-gradient-to-r from-accent-lavender to-accent-purple px-6 py-3 text-center text-base font-bold text-white shadow-lg shadow-accent-purple/25 hover:shadow-accent-purple/40 transition-shadow"
              >
                See Your Revenue Potential
                <ArrowRight className="inline-block ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Grid ─────────────────────────────── */}
      <section className="py-20 px-6 bg-[#EDEFF7]">
        <div className="mx-auto max-w-4xl text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-purple mb-4">
            Features
          </p>
          <h2 className="text-3xl font-bold text-[#1E1E24] sm:text-4xl">
            Everything you need to run rent payments{" "}
            <span className="gradient-text">at scale</span>
          </h2>
        </div>

        <div className="mx-auto max-w-5xl grid gap-6 sm:grid-cols-2 lg:grid-cols-3 animate-stagger">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-[#D3D6E0] bg-white p-6 transition-colors hover:border-accent-purple/40 shadow-sm"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-purple/10">
                <feature.icon className="h-5 w-5 text-accent-purple" />
              </div>
              <h3 className="text-lg font-semibold text-[#1E1E24]">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#6E7180]">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col sm:flex-row items-center gap-4 justify-center">
          <TrustBadges variant="full" showPci={true} />
          <span className="text-xs text-[#6E7180]">Powered by <a href="https://kadimapayments.com" target="_blank" rel="noopener noreferrer" className="font-medium text-[#40424D] hover:text-accent-purple transition-colors">Kadima Payments Gateway</a></span>
        </div>
      </section>

      {/* ── Who This Is For ───────────────────────────── */}
      <section className="bg-bg-secondary py-20 px-6">
        <div className="mx-auto max-w-4xl text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-lavender mb-4">
            Is this you?
          </p>
          <h2 className="text-3xl font-bold text-text-primary sm:text-4xl">
            Built for the property manager who{" "}
            <span className="gradient-text">means business</span>
          </h2>
        </div>

        <div className="mx-auto max-w-5xl grid gap-6 sm:grid-cols-3 animate-stagger">
          <div className="rounded-2xl border border-border bg-bg-card p-6 card-hover">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-purple/10">
              <Building2 className="h-5 w-5 text-accent-lavender" />
            </div>
            <h3 className="text-base font-semibold text-text-primary">
              The Multi-Building Operator
            </h3>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">
              5-20 buildings, 50-300 units. Tired of spreadsheets and manual bank
              transfers. Wants a unified dashboard, automated reconciliation, and streamlined owner payouts.
            </p>
          </div>
          <div className="rounded-2xl gradient-border p-px card-hover">
            <div className="rounded-2xl bg-bg-primary p-6">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-purple/10">
              <TrendingUp className="h-5 w-5 text-accent-lavender" />
            </div>
            <h3 className="text-base font-semibold text-text-primary">
              The Growing Portfolio Manager
            </h3>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">
              Adding buildings faster than your processes can keep up. Needs a
              platform that scales without adding staff. Ready to turn payment
              volume into revenue. Wants automated owner payouts and clean monthly statements.
            </p>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-bg-card p-6 card-hover">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-purple/10">
              <BarChart3 className="h-5 w-5 text-accent-lavender" />
            </div>
            <h3 className="text-base font-semibold text-text-primary">
              The Owner-Operator Going Professional
            </h3>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">
              Transitioning from DIY to professional management. Wants the same
              tools institutional managers use. Values clean financial reporting
              for lenders and investors.
            </p>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-2xl text-center">
          <p className="text-sm text-text-muted leading-relaxed">
            Not sure if DoorStax is right for you? If you manage more than 10
            units and collect rent through any combination of Venmo, Zelle,
            checks, or multiple bank accounts —{" "}
            <span className="font-semibold text-text-primary">
              DoorStax was built for you.
            </span>
          </p>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-4xl text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-lavender mb-4">
            Pricing
          </p>
          <h2 className="text-3xl font-bold text-text-primary sm:text-4xl">
            Simple,{" "}
            <span className="gradient-text">portfolio-scale</span> pricing
          </h2>
          <p className="mt-4 text-text-secondary max-w-xl mx-auto">
            No percentage of rent. No per-building fees. No setup costs. Starting
            at $3/unit/month — drops to $2.50 at 500+ units.
          </p>
        </div>

        <div className="mx-auto max-w-md rounded-2xl gradient-border p-px">
          <div className="rounded-2xl bg-bg-primary p-8">
            <div className="text-center mb-6">
              <p className="text-sm font-semibold text-accent-lavender uppercase tracking-wider mb-2">
                Property Manager Plan
              </p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl font-extrabold text-text-primary">$3</span>
                <span className="text-text-muted text-sm">/ unit / month</span>
              </div>
              <p className="mt-2 text-sm text-text-muted">
                $150 base (includes 50 units) — volume discounts at scale
              </p>
              <div className="mt-3 flex justify-center gap-3 text-xs text-text-muted">
                <span className="rounded-full border border-border px-2.5 py-1">500+ units: $2.50</span>
              </div>
              <p className="mt-3 text-xs text-accent-lavender font-semibold">
                14-Day Free Trial — No credit card required
              </p>
            </div>

            <div className="space-y-2.5 mb-8">
              {includedFeatures.map((feature) => (
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

        <div className="mx-auto mt-10 max-w-2xl text-center">
          <p className="text-sm text-text-secondary leading-relaxed">
            DoorStax is the only rent collection platform where your payment
            processing generates income instead of just costing you money.
            Revenue share details are provided once you sign up.
          </p>
        </div>
      </section>

      {/* ── Onboarding Steps ──────────────────────────── */}
      <section className="bg-[#EDEFF7] py-20 px-6">
        <div className="mx-auto max-w-4xl text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-purple mb-4">
            Getting Started
          </p>
          <h2 className="text-3xl font-bold text-[#1E1E24] sm:text-4xl">
            Go live in{" "}
            <span className="gradient-text">under 48 hours</span>
          </h2>
        </div>

        <div className="mx-auto max-w-3xl">
          <div className="relative space-y-8">
            <div className="absolute left-5 top-0 bottom-0 w-px bg-[#D3D6E0] hidden sm:block" />
            {onboardingSteps.map((step, i) => (
              <div key={step.title} className="relative flex gap-5">
                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-purple text-white text-sm font-bold shadow-md">
                  {i + 1}
                </div>
                <div className="pt-1.5">
                  {i === 0 ? (
                    <Link href="/register" className="text-base font-semibold text-[#1E1E24] hover:text-accent-purple transition-colors">
                      {step.title} <ArrowRight className="inline h-4 w-4" />
                    </Link>
                  ) : (
                    <h3 className="text-base font-semibold text-[#1E1E24]">{step.title}</h3>
                  )}
                  <p className="mt-1 text-sm text-[#6E7180]">{step.description}</p>
                  <p className="mt-1 text-xs text-accent-purple font-medium">{step.time}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent-lavender to-accent-purple px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-accent-purple/25 hover:shadow-accent-purple/40 transition-shadow"
            >
              Create Your Account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Easy Migration ──────────────────────────────── */}
      <section id="migration" className="bg-bg-secondary py-20 px-6">
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
              Already on another platform?{" "}
              <span className="gradient-text">Migrate in minutes.</span>
            </h2>
            <p className="mt-4 text-text-secondary">
              Export a CSV from your current platform. DoorStax handles the rest.
            </p>
            <div className="mt-6 space-y-3">
              {[
                "Import from Buildium, AppFolio, Yardi, Rent Manager, or any CSV",
                "Auto-column mapping recognizes 50+ field name variations",
                "Preview and validate every row before importing",
                "Properties, units, and tenants — all in one upload",
                "Go from export to live portfolio in under 30 minutes",
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
            Your portfolio is already generating payment volume.{" "}
            <span className="gradient-text">Shouldn&apos;t it generate revenue too?</span>
          </h2>
          <p className="mt-4 text-text-secondary max-w-xl mx-auto">
            Join property managers across the country who are automating rent
            collection and turning payment volume into revenue.
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

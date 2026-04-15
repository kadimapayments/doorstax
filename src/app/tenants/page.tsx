import Image from "next/image";
import Link from "next/link";
import {
  CreditCard,
  RefreshCw,
  History,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  Shield,
  CalendarDays,
  ClipboardCheck,
  Receipt,
  Bell,
  FileText,
  MessageSquare,
} from "lucide-react";
import { TrustBadges } from "@/components/ui/trust-badges";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import { OnboardingMockup } from "@/components/marketing/onboarding-mockup";
import { CalendarMockup } from "@/components/marketing/calendar-mockup";
import "../marketing.css";

const BENEFITS = [
  {
    icon: CreditCard,
    title: "Pay Rent Online",
    description:
      "Pay with your credit card, debit card, or bank account. Choose your preferred method and pay in seconds from any device.",
  },
  {
    icon: RefreshCw,
    title: "Set Up Autopay",
    description:
      "Enable automatic payments and never miss a due date. Get notified before each charge so there are no surprises.",
  },
  {
    icon: Receipt,
    title: "Outstanding Charges",
    description:
      "See all your charges in one place — rent, fees, and expenses. Pay each charge individually with a clear breakdown of any convenience fees.",
  },
  {
    icon: FileText,
    title: "Download Receipts",
    description:
      "Get a professional PDF receipt for every payment with full transaction details, card information, and timestamps.",
  },
  {
    icon: Bell,
    title: "Stay Informed",
    description:
      "Receive email notifications for payment confirmations, upcoming due dates, new charges, and lease updates. Never be caught off guard.",
  },
  {
    icon: TrendingUp,
    title: "Build Credit",
    description:
      "Enroll in rent reporting to build your credit score with every on-time payment. Your rent history reported to major credit bureaus.",
  },
  {
    icon: MessageSquare,
    title: "Message Your Manager",
    description:
      "Send messages directly to your property manager through the portal. Submit maintenance requests and track their progress.",
  },
  {
    icon: ClipboardCheck,
    title: "Guided Onboarding",
    description:
      "Complete a simple 7-step setup: personal details, payment method, roommates, move-in checklist, documents, and lease review.",
  },
];

const STEPS = [
  {
    number: 1,
    title: "Get invited and complete onboarding",
    description:
      "Your landlord invites you. Complete 7 easy steps: personal details, payment method, roommates, checklist, and lease review.",
  },
  {
    number: 2,
    title: "Pay rent and set up autopay",
    description:
      "Choose card or ACH. Set up autopay to never miss a payment. Sync rent dates with your calendar.",
  },
  {
    number: 3,
    title: "Track everything in one place",
    description:
      "View payment history, download receipts, check your calendar, submit tickets, and build credit — all from one dashboard.",
  },
];

export default function TenantsPage() {
  return (
    <div className="marketing-page min-h-screen bg-bg-primary flex flex-col overflow-x-hidden">
      {/* Navigation */}
      <nav className="w-full border-b border-border bg-bg-primary/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/">
            <Image
              src="/logo-white.svg"
              alt="DoorStax"
              width={140}
              height={32}
              priority
            />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-white hover:bg-accent-purple/90 transition-colors"
            >
              Log In to Portal
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-6 py-20 text-center">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[500px] w-[500px] rounded-full bg-accent-purple/10 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-3xl">
          <h1 className="text-5xl font-extrabold leading-tight tracking-tight text-text-primary sm:text-6xl animate-fade-in-up">
            Pay Rent. <span className="gradient-text">Build Credit.</span>
          </h1>
          <p
            className="mt-6 text-xl text-text-secondary animate-fade-in-up"
            style={{ animationDelay: "80ms" }}
          >
            Your rent payments can do more. Pay online, track history, and build
            credit — all from one platform.
          </p>
          <div
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up"
            style={{ animationDelay: "160ms" }}
          >
            <Link
              href="/login"
              className="rounded-lg bg-accent-purple px-6 py-3 text-sm font-semibold text-white hover:bg-accent-purple/90 transition-colors"
            >
              Log In to Your Portal
            </Link>
            <a
              href="#benefits"
              className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
            >
              Learn More <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="benefits" className="px-6 py-16 bg-bg-card/50">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold text-text-primary mb-12">
            Your Rent Can Do More
          </h2>
          <div className="grid gap-8 sm:grid-cols-2">
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                className="flex items-start gap-4 rounded-2xl border border-border bg-bg-card p-6"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-purple/10">
                  <b.icon className="h-6 w-6 text-accent-lavender" />
                </div>
                <div>
                  <h3 className="font-semibold text-text-primary">{b.title}</h3>
                  <p className="mt-1 text-sm text-text-secondary leading-relaxed">
                    {b.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Your Tenant Portal */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold text-text-primary mb-4">
            Your <span className="gradient-text">Tenant Portal</span>
          </h2>
          <p className="text-center text-text-secondary mb-12 max-w-2xl mx-auto">
            Guided 7-step onboarding. Set up once, pay automatically.
          </p>
          <div className="mx-auto max-w-3xl">
            <BrowserFrame url="doorstax.com/tenant/onboarding">
              <OnboardingMockup />
            </BrowserFrame>
          </div>
          <div className="mt-12 mx-auto max-w-md">
            <p className="text-center text-sm font-medium text-text-secondary mb-4">
              Sync rent dates with your calendar
            </p>
            <BrowserFrame url="doorstax.com/tenant/calendar">
              <CalendarMockup />
            </BrowserFrame>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold text-text-primary mb-12">
            How It Works
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.number} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-purple text-white text-lg font-bold">
                  {s.number}
                </div>
                <h3 className="font-semibold text-text-primary">{s.title}</h3>
                <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                  {s.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="px-6 py-12 bg-bg-card/50">
        <div className="mx-auto max-w-4xl text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-accent-lavender" />
            <p className="text-sm font-medium text-text-secondary">
              Bank-level security. PCI compliant. Your data is protected.
            </p>
          </div>
          <TrustBadges />
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold text-text-primary">
            Rent Payments That Work for You
          </h2>
          <p className="mt-4 text-text-secondary">
            Join thousands of renters who use DoorStax to pay rent, build
            credit, and take control of their finances.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-accent-purple px-6 py-3 text-sm font-semibold text-white hover:bg-accent-purple/90 transition-colors"
          >
            Log In to Your Portal
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-bg-primary">
        <div className="mx-auto max-w-6xl px-6 py-8 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col items-center sm:items-start">
              <Image
                src="/logo-white.svg"
                alt="DoorStax"
                width={110}
                height={26}
              />
              <p className="text-xs text-text-muted mt-1">DoorStax Payment Network</p>
            </div>
            <div className="flex items-center gap-6 text-xs text-text-muted">
              <Link
                href="/terms"
                className="hover:text-text-secondary transition-colors"
              >
                Terms
              </Link>
              <Link
                href="/privacy"
                className="hover:text-text-secondary transition-colors"
              >
                Privacy
              </Link>
              <Link
                href="/listings"
                className="hover:text-text-secondary transition-colors"
              >
                Listings
              </Link>
            </div>
            <p className="text-xs text-text-muted">
              Powered by{" "}
              <a
                href="https://kadimapayments.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-text-secondary hover:text-accent-lavender transition-colors"
              >
                Kadima Payments
              </a>
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

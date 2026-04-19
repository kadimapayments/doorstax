import Image from "next/image";
import Link from "next/link";
import { Building2, Users, ArrowRight, CreditCard } from "lucide-react";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import { DashboardMockup } from "@/components/marketing/dashboard-mockup";
import { CalendarMockup } from "@/components/marketing/calendar-mockup";
import { UnpaidRentMockup } from "@/components/marketing/unpaid-rent-mockup";
import { MigrationMockup } from "@/components/marketing/migration-mockup";
import { TrustBadges } from "@/components/ui/trust-badges";
import "./marketing.css";

export default function HomePage() {
  return (
    <div className="marketing-page min-h-screen bg-bg-primary flex flex-col overflow-x-hidden">
      {/* ── Navigation ────────────────────────────────── */}
      <nav className="w-full border-b border-border bg-bg-primary/80 backdrop-blur-md">
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

      {/* ── Main Content ──────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="relative max-w-4xl w-full text-center">
          {/* Background glow */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[500px] w-[500px] rounded-full bg-accent-purple/10 blur-3xl" />
          </div>

          {/* Logo + Hero */}
          <div className="relative">
            <div className="mx-auto mb-8 flex justify-center">
              <Image src="/logo-white.svg" alt="DoorStax" width={200} height={48} />
            </div>

            <h1 className="text-5xl font-extrabold leading-tight tracking-tight text-text-primary sm:text-6xl lg:text-7xl animate-fade-in-up">
              Rent, <span className="gradient-text">Reinvented.</span>
            </h1>

            <p
              className="mt-6 text-xl text-text-secondary animate-fade-in-up"
              style={{ animationDelay: "80ms" }}
            >
              Are you a Landlord, Property Manager, or Tenant?
            </p>
          </div>

          {/* Two cards */}
          <div
            className="relative mt-12 grid gap-6 sm:grid-cols-3 max-w-4xl mx-auto animate-fade-in-up"
            style={{ animationDelay: "160ms" }}
          >
            {/* Landlord Card */}
            <Link
              href="/landlords"
              className="group rounded-2xl border border-border bg-bg-card p-8 text-center transition-all hover:border-accent-purple/40 hover:shadow-lg hover:shadow-accent-purple/10"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-purple/10 group-hover:bg-accent-purple/20 transition-colors">
                <Building2 className="h-8 w-8 text-accent-lavender" />
              </div>
              <h2 className="text-xl font-bold text-text-primary">
                I&apos;m a Landlord
              </h2>
              <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                Online rent collection, automated reminders, expense tracking, owner statements, and financial reporting — all from one dashboard.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent-lavender group-hover:gap-2 transition-all">
                View Pricing <ArrowRight className="h-4 w-4" />
              </span>
            </Link>

            {/* PM Card */}
            <Link
              href="/managers"
              className="group rounded-2xl gradient-border p-px transition-all hover:shadow-lg hover:shadow-accent-purple/10"
            >
              <div className="rounded-2xl bg-bg-primary p-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-purple/10 group-hover:bg-accent-purple/20 transition-colors">
                  <Users className="h-8 w-8 text-accent-lavender" />
                </div>
                <h2 className="text-xl font-bold text-text-primary">
                  I&apos;m a Property Manager
                </h2>
                <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                  Multi-property payment processing, tenant invoicing, eviction tracking, owner payouts, and 13 automated workflows for your entire portfolio.
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent-lavender group-hover:gap-2 transition-all">
                  See How It Works <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>

            {/* Tenant Card */}
            <Link
              href="/tenants"
              className="group rounded-2xl border border-border bg-bg-card p-8 text-center transition-all hover:border-accent-purple/40 hover:shadow-lg hover:shadow-accent-purple/10"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-purple/10 group-hover:bg-accent-purple/20 transition-colors">
                <CreditCard className="h-8 w-8 text-accent-lavender" />
              </div>
              <h2 className="text-xl font-bold text-text-primary">
                I&apos;m a Tenant
              </h2>
              <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                Pay rent online, set up autopay, view outstanding charges, download receipts, build credit, and manage your lease — from any device.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent-lavender group-hover:gap-2 transition-all">
                Learn More <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>

          {/* Vendor secondary CTA */}
          <p
            className="relative mt-8 text-sm text-text-secondary animate-fade-in-up"
            style={{ animationDelay: "240ms" }}
          >
            Service vendor?{" "}
            <Link
              href="/register/vendor"
              className="font-semibold text-accent-lavender hover:underline"
            >
              Join the DoorStax vendor directory →
            </Link>
          </p>
        </div>
      </main>

      {/* ── Platform Preview ─────────────────────────── */}
      <section className="px-6 py-20 bg-bg-card/50">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold text-text-primary mb-4">
            See the Platform <span className="gradient-text">in Action</span>
          </h2>
          <p className="text-center text-text-secondary mb-12 max-w-2xl mx-auto">
            One dashboard for collections, reconciliation, calendars, unpaid rent
            tracking, and more.
          </p>
          <div className="mx-auto max-w-3xl">
            <BrowserFrame url="doorstax.com/dashboard">
              <DashboardMockup />
            </BrowserFrame>
          </div>
          <div className="mt-12 grid gap-8 grid-cols-1 sm:grid-cols-3 max-w-xs sm:max-w-none mx-auto">
            <div>
              <p className="text-center text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">Calendar + iCal</p>
              <BrowserFrame url="doorstax.com/calendar">
                <CalendarMockup />
              </BrowserFrame>
            </div>
            <div>
              <p className="text-center text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">Unpaid Rent</p>
              <BrowserFrame url="doorstax.com/unpaid-rent">
                <UnpaidRentMockup />
              </BrowserFrame>
            </div>
            <div>
              <p className="text-center text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">CSV Migration</p>
              <BrowserFrame url="doorstax.com/migration">
                <MigrationMockup />
              </BrowserFrame>
            </div>
          </div>
        </div>
      </section>

      {/* ── New Features ─────────────────────────────── */}
      <section className="px-6 py-12">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-medium text-text-secondary mb-6">Built-in Features</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              "Immutable Ledger",
              "Daily Reconciliation",
              "Calendar + iCal",
              "Unpaid Rent Dashboard",
              "CSV Migration",
              "Owner Payouts",
              "Lease Alerts",
              "7-Step Onboarding",
            ].map((f) => (
              <span
                key={f}
                className="rounded-full bg-accent-purple/10 text-accent-lavender text-xs px-3 py-1 font-medium"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Easy Migration ───────────────────────────── */}
      <section className="px-6 py-12 bg-bg-card/50">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-lg font-semibold text-text-primary">
            Switching from Buildium, AppFolio, or Yardi?
          </p>
          <p className="mt-2 text-text-secondary">
            Import your entire portfolio in minutes with our CSV migration tool.
          </p>
          <Link
            href="/managers#migration"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent-lavender hover:text-accent-purple transition-colors"
          >
            Learn More <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Trust ────────────────────────────────────── */}
      <section className="px-6 py-8">
        <div className="mx-auto max-w-4xl flex justify-center">
          <TrustBadges />
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
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-text-muted">
              <Link href="/terms" className="hover:text-text-secondary transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-text-secondary transition-colors">Privacy</Link>
              <Link href="/cookie" className="hover:text-text-secondary transition-colors">Cookies</Link>
              <Link href="/acceptable-use" className="hover:text-text-secondary transition-colors">Acceptable Use</Link>
              <Link href="/merchant-agreement" className="hover:text-text-secondary transition-colors">Merchant Agreement</Link>
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

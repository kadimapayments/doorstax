import Image from "next/image";
import Link from "next/link";
import { Metadata } from "next";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import { DashboardMockup } from "@/components/marketing/dashboard-mockup";
import { TrustBadges } from "@/components/ui/trust-badges";
import { MaverickLeadForm } from "@/components/marketing/maverick-lead-form";
import { LeadGenAnimation } from "@/components/marketing/lead-gen-animation";

export const metadata: Metadata = {
  title: "DoorStax — Rent Collection, Reinvented",
  description:
    "We're quietly reinventing rent collection and property management. Get early access to DoorStax.",
  openGraph: {
    title: "DoorStax — Rent Collection, Reinvented",
    description:
      "We're quietly reinventing rent collection and property management. Get early access.",
    url: "https://doorstax.com",
  },
};

const valuePills = [
  "Automated Rent Collection",
  "Real-Time Reconciliation",
  "Revenue Share for Managers",
  "Credit Building for Tenants",
];

export default function ComingSoonPage() {
  return (
    <div className="min-h-screen bg-bg-primary flex flex-col overflow-x-hidden">
      {/* ── Minimal Nav ──────────────────────────────── */}
      <nav className="w-full border-b border-border bg-bg-primary/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-center px-6">
          <Image
            src="/logo-white.svg"
            alt="DoorStax"
            width={140}
            height={32}
            priority
          />
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────── */}
      <section className="relative flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[600px] w-[600px] rounded-full bg-accent-purple/10 blur-3xl" />
        </div>

        <div className="relative max-w-3xl mx-auto">
          {/* Logo emblem */}
          <div className="mx-auto mb-8 flex justify-center animate-fade-in-up">
            <Image
              src="/logo-white.svg"
              alt="DoorStax"
              width={200}
              height={48}
            />
          </div>

          <h1
            className="text-5xl font-extrabold leading-tight tracking-tight text-text-primary sm:text-6xl lg:text-7xl animate-fade-in-up"
            style={{ animationDelay: "80ms" }}
          >
            Rent, <span className="gradient-text">Reinvented.</span>
          </h1>

          <p
            className="mt-6 text-xl text-text-secondary max-w-2xl mx-auto animate-fade-in-up"
            style={{ animationDelay: "160ms" }}
          >
            We&apos;re quietly reinventing rent collection and property
            management.
          </p>

          {/* Value pills */}
          <div
            className="mt-8 flex flex-wrap items-center justify-center gap-2 animate-fade-in-up"
            style={{ animationDelay: "240ms" }}
          >
            {valuePills.map((pill) => (
              <span
                key={pill}
                className="rounded-full bg-accent-purple/10 text-accent-lavender text-xs sm:text-sm px-3 sm:px-4 py-1.5 font-medium"
              >
                {pill}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Lead-gen animation (before the signup form) ─ */}
      <section className="px-6 pb-4">
        <div
          className="relative animate-fade-in-up"
          style={{ animationDelay: "320ms" }}
        >
          <LeadGenAnimation />
        </div>
      </section>

      {/* ── Lead Capture ─────────────────────────────── */}
      <section className="px-6 pt-8 pb-16">
        <div className="mx-auto max-w-md">
          <div
            className="rounded-2xl gradient-border p-px animate-fade-in-up"
            style={{ animationDelay: "400ms" }}
          >
            <div className="rounded-2xl bg-bg-primary p-8">
              <h2 className="text-xl font-bold text-text-primary text-center mb-2">
                Get Early Access
              </h2>
              <p className="text-sm text-text-secondary text-center mb-6">
                Be the first to know when we launch.
              </p>
              <MaverickLeadForm />
            </div>
          </div>
        </div>
      </section>

      {/* ── Platform Teaser ──────────────────────────── */}
      <section className="px-6 py-16 bg-bg-card/30">
        <div className="mx-auto max-w-3xl text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-lavender mb-3">
            Sneak Peek
          </p>
          <h2 className="text-2xl font-bold text-text-primary sm:text-3xl">
            A glimpse of what&apos;s{" "}
            <span className="gradient-text">coming</span>
          </h2>
        </div>
        <div className="mx-auto max-w-3xl relative">
          <div className="opacity-70">
            <BrowserFrame url="doorstax.com/dashboard">
              <DashboardMockup />
            </BrowserFrame>
          </div>
          {/* Blur overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-transparent to-transparent rounded-2xl" />
        </div>
      </section>

      {/* ── Trust ────────────────────────────────────── */}
      <section className="px-6 py-12">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs text-text-muted mb-4">
            Bank-level security. PCI compliant. Your data is protected.
          </p>
          <TrustBadges />
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────── */}
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
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-text-muted">
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
                href="/cookie"
                className="hover:text-text-secondary transition-colors"
              >
                Cookies
              </Link>
              <Link
                href="/acceptable-use"
                className="hover:text-text-secondary transition-colors"
              >
                Acceptable Use
              </Link>
              <Link
                href="/merchant-agreement"
                className="hover:text-text-secondary transition-colors"
              >
                Merchant Agreement
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

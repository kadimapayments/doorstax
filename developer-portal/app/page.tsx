import Image from "next/image";
import Link from "next/link";
import {
  KeyRound,
  Database,
  Code2,
  Shield,
  BookOpen,
  Webhook,
  ArrowRight,
  Receipt,
  CreditCard,
} from "lucide-react";

const quickLinks = [
  {
    title: "Authentication",
    description: "Session-based JWT auth with NextAuth.js, 2FA, and rate limiting.",
    href: "/docs/authentication",
    icon: KeyRound,
    color: "text-accent-purple",
    bg: "bg-accent-purple/10",
  },
  {
    title: "Core Objects",
    description: "Properties, units, tenants, leases, payments, and more.",
    href: "/docs/core-objects",
    icon: Database,
    color: "text-accent-blue",
    bg: "bg-accent-blue/10",
  },
  {
    title: "API Reference",
    description: "Full OpenAPI spec with 236+ endpoints across all resources.",
    href: "/api-reference",
    icon: Code2,
    color: "text-accent-green",
    bg: "bg-accent-green/10",
  },
  {
    title: "RBAC & Security",
    description: "7 user roles, 4 permission layers, fine-grained access control.",
    href: "/docs/rbac",
    icon: Shield,
    color: "text-accent-amber",
    bg: "bg-accent-amber/10",
  },
  {
    title: "Ledger System",
    description: "Immutable, append-only financial ledger with audit trail.",
    href: "/docs/ledger-system",
    icon: BookOpen,
    color: "text-accent-red",
    bg: "bg-accent-red/10",
  },
  {
    title: "Webhooks",
    description: "Real-time events for payments, screening, and more.",
    href: "/docs/webhooks",
    icon: Webhook,
    color: "text-accent-lavender",
    bg: "bg-accent-lavender/10",
  },
  {
    title: "Expenses System",
    description: "Flexible billing, tenant invoicing, split costs, and approval workflows.",
    href: "/docs/expenses",
    icon: Receipt,
    color: "text-accent-amber",
    bg: "bg-accent-amber/10",
  },
  {
    title: "Payment Processing",
    description: "Multi-merchant card/ACH architecture, autopay, voids, and receipts.",
    href: "/docs/payment-processing",
    icon: CreditCard,
    color: "text-accent-green",
    bg: "bg-accent-green/10",
  },
];

const stats = [
  { label: "API Endpoints", value: "280+" },
  { label: "Data Models", value: "53" },
  { label: "Email Templates", value: "20+" },
  { label: "Cron Jobs", value: "12" },
  { label: "User Roles", value: "7" },
  { label: "Immutable Ledger", value: "Yes" },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-purple/10 border border-accent-purple/20 text-accent-lavender text-xs font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-purple animate-pulse" />
          Developer Documentation
        </div>
        <div className="mb-4">
          <Image
            src="/logo-white.svg"
            alt="DoorStax"
            width={280}
            height={56}
            priority
            className="mb-3"
          />
          <h1 className="text-4xl md:text-5xl font-bold text-accent-lavender leading-tight">
            Developer Portal
          </h1>
        </div>
        <p className="text-lg text-text-secondary max-w-2xl leading-relaxed mb-8">
          Everything you need to build on the DoorStax property management platform.
          Explore our APIs, understand the data model, and integrate payments,
          leases, and tenant management into your workflows.
        </p>
        <div className="flex gap-4">
          <Link
            href="/docs/authentication"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent-purple text-white text-sm font-medium hover:bg-accent-purple/90 transition-colors"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/api-reference"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-text-secondary text-sm font-medium hover:bg-bg-hover hover:text-text-primary transition-colors"
          >
            API Reference
          </Link>
        </div>
      </section>

      {/* Quick Links Grid */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-text-primary mb-6">
          Explore the Docs
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group p-5 rounded-xl bg-bg-card border border-border hover:border-accent-purple/30 hover:bg-bg-hover transition-all"
            >
              <div
                className={`inline-flex p-2.5 rounded-lg ${link.bg} mb-4`}
              >
                <link.icon className={`w-5 h-5 ${link.color}`} />
              </div>
              <h3 className="text-sm font-semibold text-text-primary mb-1.5 group-hover:text-accent-lavender transition-colors">
                {link.title}
              </h3>
              <p className="text-sm text-text-muted leading-relaxed">
                {link.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Architecture Overview */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-text-primary mb-6">
          Platform at a Glance
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="p-5 rounded-xl bg-bg-card border border-border text-center"
            >
              <div className="text-2xl font-bold text-accent-lavender mb-1">
                {stat.value}
              </div>
              <div className="text-xs text-text-muted">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Base URL */}
      <section>
        <h2 className="text-xl font-semibold text-text-primary mb-4">
          Base URL
        </h2>
        <div className="rounded-lg bg-[#1a1b26] border border-border p-4">
          <code className="text-sm text-accent-green">
            https://doorstax.com/api
          </code>
        </div>
        <p className="text-sm text-text-muted mt-3">
          All API requests are made to this base URL. Sandbox requests use{" "}
          <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">
            https://sandbox.doorstax.com/api
          </code>
        </p>
      </section>
    </div>
  );
}

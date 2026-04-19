import Image from "next/image";
import Link from "next/link";

/**
 * Shared scaffolding for public legal pages (/terms, /privacy, /cookie,
 * /acceptable-use, /merchant-agreement). All share:
 *   - Header with logo + "Back to Home"
 *   - Yellow "legal review pending" banner (top + bottom) until attorney-
 *     reviewed in production
 *   - Max-width content container
 *   - Cross-links to the full set of policies in the footer
 *
 * Usage:
 *   <LegalPage title="Privacy Policy" lastUpdated="April 2026">
 *     <LegalSection title="1. Overview">…</LegalSection>
 *     …
 *   </LegalPage>
 */
export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/">
            <Image
              src="/logo-dark.svg"
              alt="DoorStax"
              width={140}
              height={32}
              priority
              className="dark:hidden"
            />
            <Image
              src="/logo-white.svg"
              alt="DoorStax"
              width={140}
              height={32}
              priority
              className="hidden dark:block"
            />
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-12 space-y-8">
        <PendingReviewBanner />

        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: {lastUpdated}
          </p>
        </div>

        {children}

        <div className="pt-6 border-t border-border">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            Related policies
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <Link href="/terms" className="text-secondary hover:underline">
              Terms of Service
            </Link>
            <Link href="/privacy" className="text-secondary hover:underline">
              Privacy Policy
            </Link>
            <Link href="/cookie" className="text-secondary hover:underline">
              Cookie Policy
            </Link>
            <Link
              href="/acceptable-use"
              className="text-secondary hover:underline"
            >
              Acceptable Use
            </Link>
            <Link
              href="/merchant-agreement"
              className="text-secondary hover:underline"
            >
              Merchant Agreement
            </Link>
          </div>
        </div>

        <PendingReviewBanner />
      </div>
    </main>
  );
}

function PendingReviewBanner() {
  return (
    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
      <p className="text-sm text-muted-foreground">
        <strong>Legal review pending:</strong> This document is a
        founder-drafted template in the DoorStax voice. It is not yet
        attorney-reviewed and is subject to change. Nothing here constitutes
        legal advice.
      </p>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function LegalParagraph({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
  );
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc pl-6 space-y-1.5 text-sm text-muted-foreground">
      {children}
    </ul>
  );
}

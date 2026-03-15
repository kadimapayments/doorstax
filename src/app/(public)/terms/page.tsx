import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Terms of Service — DoorStax",
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
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

      {/* Content */}
      <div className="mx-auto max-w-3xl px-6 py-12 space-y-8">
        {/* Disclaimer */}
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
          <p className="text-sm text-muted-foreground">
            <strong>Disclaimer:</strong> This Terms of Service is a template
            provided for informational purposes and should be reviewed and
            customized by legal counsel before use.
          </p>
        </div>

        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: March 2026
          </p>
        </div>

        {/* 1. Acceptance of Terms */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            1. Acceptance of Terms
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            By accessing or using the DoorStax platform, website, and any
            associated services (collectively, the &quot;Service&quot;), you
            agree to be bound by these Terms of Service (&quot;Terms&quot;). If
            you do not agree to these Terms, you may not access or use the
            Service. These Terms constitute a legally binding agreement between
            you and DoorStax. By creating an account, you acknowledge that you
            have read, understood, and agree to be bound by these Terms.
          </p>
        </section>

        {/* 2. Description of Service */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            2. Description of Service
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            DoorStax is a property management and payment platform designed to
            streamline the relationship between landlords and tenants. The
            Service provides tools for property management, tenant onboarding,
            rent collection, maintenance request tracking, application
            management, and financial reporting. DoorStax facilitates payment
            processing through its partnership with Kadima Payments, enabling ACH
            transfers and credit/debit card transactions between tenants and
            landlords.
          </p>
        </section>

        {/* 3. User Accounts */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            3. User Accounts
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The Service supports two primary account types: manager accounts and
            tenant accounts. Managers register directly and manage properties,
            tenants, and payments through their dashboard. Tenants are invited by
            their landlord and gain access to pay rent, submit maintenance
            requests, and manage their lease information.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            You are responsible for maintaining the confidentiality of your
            account credentials. You agree to notify DoorStax immediately of any
            unauthorized use of your account. DoorStax is not liable for any loss
            or damage arising from your failure to safeguard your login
            information. You must provide accurate and complete information when
            creating your account and keep it up to date.
          </p>
        </section>

        {/* 4. Landlord Responsibilities */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            4. Landlord Responsibilities
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            As a landlord using DoorStax, you agree to:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-sm text-muted-foreground">
            <li>
              Provide accurate property information including addresses, unit
              details, and rental amounts.
            </li>
            <li>
              Comply with all applicable federal, state, and local laws,
              including Fair Housing regulations and landlord-tenant laws.
            </li>
            <li>
              Ensure that rental application templates and screening processes
              comply with applicable laws.
            </li>
            <li>
              Maintain proper records for all financial transactions conducted
              through the platform.
            </li>
            <li>
              Respond to tenant maintenance requests and communications in a
              timely manner.
            </li>
            <li>
              Complete the payment onboarding process, including identity
              verification, to enable payment processing.
            </li>
          </ul>
        </section>

        {/* 5. Tenant Responsibilities */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            5. Tenant Responsibilities
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            As a tenant using DoorStax, you agree to:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-sm text-muted-foreground">
            <li>
              Provide accurate personal and financial information during the
              application and onboarding process.
            </li>
            <li>
              Make rent payments on time as specified in your lease agreement.
            </li>
            <li>
              Use the platform in good faith to communicate with your landlord
              and manage your tenancy.
            </li>
            <li>
              Keep your payment information current and ensure sufficient funds
              are available for scheduled payments.
            </li>
            <li>
              Report any issues with the platform or unauthorized account
              activity immediately.
            </li>
          </ul>
        </section>

        {/* 6. Payment Processing */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            6. Payment Processing
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Payment processing on DoorStax is powered by Kadima Payments, a
            registered payment facilitator. Kadima Payments handles all ACH
            (bank transfer) and credit/debit card processing on behalf of
            DoorStax and its users. By using the payment features of the
            Service, you also agree to the terms and conditions of Kadima
            Payments.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Payments made via credit or debit card are subject to a surcharge as
            disclosed at the time of payment. ACH payments may be subject to
            processing fees as outlined in the Fees section below. All payment
            transactions are processed in U.S. dollars. DoorStax and Kadima
            Payments reserve the right to delay, suspend, or reverse any
            transaction that is suspected of being fraudulent or in violation of
            these Terms.
          </p>
        </section>

        {/* 7. Fees */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">7. Fees</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The following fees apply to payment processing on DoorStax:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-sm text-muted-foreground">
            <li>
              <strong>Card Payments:</strong> A 3.25% surcharge is applied to
              all credit and debit card transactions. This surcharge is disclosed
              to the payer at the time of payment and is added to the total
              transaction amount.
            </li>
            <li>
              <strong>ACH Payments:</strong> ACH processing fees are charged to
              the landlord as part of their subscription or per-transaction fee
              structure. Tenants are not charged additional fees for ACH
              payments.
            </li>
          </ul>
          <p className="text-sm leading-relaxed text-muted-foreground">
            DoorStax reserves the right to modify its fee structure with
            reasonable notice to affected users. Any changes will be communicated
            via email or through the platform dashboard.
          </p>
        </section>

        {/* 8. Data Handling & Security */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            8. Data Handling &amp; Security
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            DoorStax takes data security seriously. We implement
            industry-standard security measures to protect your personal and
            financial information. Payment data is handled in compliance with PCI
            DSS standards through our partnership with Kadima Payments. Personal
            data is encrypted in transit and at rest. For full details on how we
            collect, use, and protect your data, please review our{" "}
            <Link
              href="/privacy"
              className="text-secondary hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        {/* 9. Limitation of Liability */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            9. Limitation of Liability
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, DOORSTAX AND ITS AFFILIATES,
            OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR
            ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
            DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE. THIS
            INCLUDES, WITHOUT LIMITATION, DAMAGES FOR LOSS OF PROFITS, DATA,
            GOODWILL, OR OTHER INTANGIBLE LOSSES.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            DoorStax does not guarantee uninterrupted or error-free operation of
            the Service. We are not responsible for any damages resulting from
            payment processing delays, system downtime, or third-party service
            failures. Our total liability to you for any claim arising from or
            related to the Service shall not exceed the amount you paid to
            DoorStax in the twelve (12) months preceding the claim.
          </p>
        </section>

        {/* 10. Termination */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            10. Termination
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Either party may terminate access to the Service at any time.
            DoorStax reserves the right to suspend or terminate your account if
            you violate these Terms, engage in fraudulent activity, or fail to
            maintain accurate account information. Upon termination, your right
            to access the Service will cease immediately. Any outstanding payment
            obligations will survive termination. DoorStax will make reasonable
            efforts to allow you to export your data before account closure, in
            accordance with applicable data retention laws.
          </p>
        </section>

        {/* 11. Governing Law */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            11. Governing Law
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            These Terms shall be governed by and construed in accordance with the
            laws of the State in which DoorStax is incorporated, without regard
            to its conflict of law provisions. Any disputes arising under or in
            connection with these Terms shall be resolved through binding
            arbitration or in the courts of competent jurisdiction in said State.
            You agree to submit to the personal jurisdiction of such courts.
          </p>
        </section>

        {/* 12. Contact Information */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            12. Contact Information
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            If you have questions or concerns about these Terms of Service,
            please contact us at:
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            <strong>Email:</strong>{" "}
            <a
              href="mailto:support@doorstax.com"
              className="text-secondary hover:underline"
            >
              support@doorstax.com
            </a>
          </p>
        </section>

        {/* Bottom Disclaimer */}
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
          <p className="text-sm text-muted-foreground">
            <strong>Disclaimer:</strong> This Terms of Service is a template
            provided for informational purposes and should be reviewed and
            customized by legal counsel before use.
          </p>
        </div>
      </div>
    </main>
  );
}

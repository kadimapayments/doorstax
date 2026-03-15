import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — DoorStax",
};

export default function PrivacyPolicyPage() {
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
            <strong>Disclaimer:</strong> This Privacy Policy is a template
            provided for informational purposes and should be reviewed and
            customized by legal counsel before use.
          </p>
        </div>

        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: March 2026
          </p>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          DoorStax (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is
          committed to protecting the privacy of our users. This Privacy Policy
          explains how we collect, use, disclose, and safeguard your information
          when you use the DoorStax platform and services.
        </p>

        {/* 1. Information We Collect */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            1. Information We Collect
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We collect the following categories of information:
          </p>
          <h3 className="text-base font-medium text-foreground">
            Personal Information
          </h3>
          <ul className="list-disc pl-6 space-y-1.5 text-sm text-muted-foreground">
            <li>
              Name, email address, phone number, and mailing address provided
              during registration.
            </li>
            <li>
              Identity verification documents submitted during payment
              onboarding.
            </li>
            <li>
              Tenant application data including employment information,
              references, and rental history.
            </li>
          </ul>
          <h3 className="text-base font-medium text-foreground">
            Payment Data
          </h3>
          <ul className="list-disc pl-6 space-y-1.5 text-sm text-muted-foreground">
            <li>
              Bank account information (routing and account numbers) for ACH
              transactions.
            </li>
            <li>
              Credit and debit card information for card-based payments.
            </li>
            <li>
              Transaction history including payment amounts, dates, and
              statuses.
            </li>
          </ul>
          <h3 className="text-base font-medium text-foreground">
            Usage Analytics
          </h3>
          <ul className="list-disc pl-6 space-y-1.5 text-sm text-muted-foreground">
            <li>
              Device information, browser type, IP address, and operating system.
            </li>
            <li>
              Pages visited, features used, and time spent on the platform.
            </li>
            <li>
              Log data including access times, error logs, and referring URLs.
            </li>
          </ul>
        </section>

        {/* 2. How We Use Your Information */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            2. How We Use Your Information
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We use the information we collect for the following purposes:
          </p>
          <h3 className="text-base font-medium text-foreground">
            Service Provision
          </h3>
          <ul className="list-disc pl-6 space-y-1.5 text-sm text-muted-foreground">
            <li>
              Creating and managing user accounts for landlords and tenants.
            </li>
            <li>
              Facilitating property management, lease tracking, and maintenance
              requests.
            </li>
            <li>
              Generating reports and analytics for property management purposes.
            </li>
          </ul>
          <h3 className="text-base font-medium text-foreground">
            Payment Processing
          </h3>
          <ul className="list-disc pl-6 space-y-1.5 text-sm text-muted-foreground">
            <li>
              Processing rent payments and other transactions through Kadima
              Payments.
            </li>
            <li>
              Verifying identity and preventing fraud in payment transactions.
            </li>
            <li>Generating payment receipts and financial statements.</li>
          </ul>
          <h3 className="text-base font-medium text-foreground">
            Communications
          </h3>
          <ul className="list-disc pl-6 space-y-1.5 text-sm text-muted-foreground">
            <li>
              Sending payment reminders, receipts, and transaction
              confirmations.
            </li>
            <li>
              Notifying users of platform updates, maintenance, and policy
              changes.
            </li>
            <li>
              Facilitating communication between landlords and tenants through
              the platform.
            </li>
          </ul>
        </section>

        {/* 3. Information Sharing */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            3. Information Sharing
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We do not sell your personal information. We may share your
            information in the following circumstances:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-sm text-muted-foreground">
            <li>
              <strong>With Kadima Payments:</strong> We share payment-related
              data with Kadima Payments, our payment processing partner, to
              facilitate ACH and card transactions, identity verification, and
              fraud prevention.
            </li>
            <li>
              <strong>Between Managers and Tenants:</strong> Certain information
              is shared between landlords and their tenants as necessary for
              property management, including contact details, payment statuses,
              and application data.
            </li>
            <li>
              <strong>Legal Requirements:</strong> We may disclose your
              information if required by law, subpoena, court order, or
              governmental regulation.
            </li>
            <li>
              <strong>Business Transfers:</strong> In the event of a merger,
              acquisition, or sale of assets, your information may be transferred
              to the acquiring entity.
            </li>
          </ul>
        </section>

        {/* 4. Data Retention */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            4. Data Retention
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We retain your personal information for as long as your account is
            active or as needed to provide you with the Service. Financial
            transaction records are retained for a minimum of seven (7) years in
            compliance with tax and financial regulations. After account
            termination, we may retain certain data as required by law or for
            legitimate business purposes such as resolving disputes and enforcing
            our agreements. You may request deletion of your data subject to
            legal retention requirements.
          </p>
        </section>

        {/* 5. Data Security */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            5. Data Security
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We implement appropriate technical and organizational measures to
            protect your information:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-sm text-muted-foreground">
            <li>
              <strong>Encryption:</strong> All data is encrypted in transit using
              TLS/SSL and at rest using industry-standard encryption algorithms.
            </li>
            <li>
              <strong>PCI Compliance:</strong> Payment card data is handled in
              compliance with PCI DSS standards through our partnership with
              Kadima Payments. DoorStax does not store raw credit card numbers on
              its servers.
            </li>
            <li>
              <strong>Access Controls:</strong> We implement role-based access
              controls and regularly audit access to sensitive data.
            </li>
            <li>
              <strong>Monitoring:</strong> We continuously monitor our systems
              for security threats and vulnerabilities.
            </li>
          </ul>
          <p className="text-sm leading-relaxed text-muted-foreground">
            While we strive to protect your information, no method of
            transmission over the Internet or electronic storage is 100% secure.
            We cannot guarantee absolute security.
          </p>
        </section>

        {/* 6. Your Rights */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            6. Your Rights
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Depending on your jurisdiction, you may have the following rights
            regarding your personal data:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-sm text-muted-foreground">
            <li>
              <strong>Access:</strong> You may request a copy of the personal
              information we hold about you.
            </li>
            <li>
              <strong>Correction:</strong> You may request that we correct
              inaccurate or incomplete personal information.
            </li>
            <li>
              <strong>Deletion:</strong> You may request that we delete your
              personal information, subject to legal retention requirements and
              active contractual obligations.
            </li>
            <li>
              <strong>Portability:</strong> You may request your data in a
              structured, machine-readable format.
            </li>
            <li>
              <strong>Objection:</strong> You may object to certain processing
              activities, including direct marketing.
            </li>
          </ul>
          <p className="text-sm leading-relaxed text-muted-foreground">
            To exercise any of these rights, please contact us at{" "}
            <a
              href="mailto:privacy@doorstax.com"
              className="text-secondary hover:underline"
            >
              privacy@doorstax.com
            </a>
            . We will respond to your request within 30 days.
          </p>
        </section>

        {/* 7. Cookies & Tracking */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            7. Cookies &amp; Tracking
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            DoorStax uses cookies and similar tracking technologies to enhance
            your experience on our platform. We use the following types of
            cookies:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-sm text-muted-foreground">
            <li>
              <strong>Essential Cookies:</strong> Required for the platform to
              function, including authentication and session management.
            </li>
            <li>
              <strong>Analytics Cookies:</strong> Help us understand how users
              interact with the platform to improve our services.
            </li>
            <li>
              <strong>Preference Cookies:</strong> Remember your settings and
              preferences for a personalized experience.
            </li>
          </ul>
          <p className="text-sm leading-relaxed text-muted-foreground">
            You can manage cookie preferences through your browser settings.
            Disabling essential cookies may impact the functionality of the
            Service.
          </p>
        </section>

        {/* 8. Children's Privacy */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            8. Children&apos;s Privacy
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            DoorStax is not intended for use by individuals under the age of 18.
            We do not knowingly collect personal information from children under
            18. If we become aware that we have collected personal information
            from a child under 18, we will take steps to delete that information
            promptly. If you believe a child under 18 has provided us with
            personal information, please contact us at{" "}
            <a
              href="mailto:privacy@doorstax.com"
              className="text-secondary hover:underline"
            >
              privacy@doorstax.com
            </a>
            .
          </p>
        </section>

        {/* 9. Changes to Policy */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            9. Changes to This Policy
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We may update this Privacy Policy from time to time to reflect
            changes in our practices, technology, legal requirements, or other
            factors. We will notify you of material changes by posting the
            updated policy on the platform and updating the &quot;Last
            updated&quot; date. We may also send email notifications for
            significant changes. Your continued use of the Service after the
            effective date of any changes constitutes your acceptance of the
            updated Privacy Policy.
          </p>
        </section>

        {/* 10. Contact */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            10. Contact
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            If you have questions, concerns, or requests regarding this Privacy
            Policy or our data practices, please contact us at:
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            <strong>Email:</strong>{" "}
            <a
              href="mailto:privacy@doorstax.com"
              className="text-secondary hover:underline"
            >
              privacy@doorstax.com
            </a>
          </p>
        </section>

        {/* Bottom Disclaimer */}
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
          <p className="text-sm text-muted-foreground">
            <strong>Disclaimer:</strong> This Privacy Policy is a template
            provided for informational purposes and should be reviewed and
            customized by legal counsel before use.
          </p>
        </div>
      </div>
    </main>
  );
}

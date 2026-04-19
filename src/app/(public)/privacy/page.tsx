import Link from "next/link";
import {
  LegalPage,
  LegalSection,
  LegalParagraph,
  LegalList,
} from "@/components/legal/legal-page";

export const metadata = {
  title: "Privacy Policy — DoorStax",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="April 2026">
      <LegalParagraph>
        DoorStax (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is
        committed to protecting the privacy of our users. This Privacy
        Policy explains how we collect, use, disclose, and safeguard your
        information when you use the DoorStax platform and services. It
        applies to property managers, landlords, tenants, vendors, owners,
        and other visitors to our website.
      </LegalParagraph>

      <LegalSection title="1. Information We Collect">
        <LegalParagraph>
          We collect the following categories of information:
        </LegalParagraph>
        <h3 className="text-base font-medium text-foreground">
          Personal Information
        </h3>
        <LegalList>
          <li>
            Name, email address, phone number, mailing address, and, where
            applicable, company name.
          </li>
          <li>
            Account credentials (password hash — we never store your
            password in plaintext).
          </li>
          <li>
            For tenants: tenancy details (unit, lease dates, rent amount)
            and emergency contact information.
          </li>
          <li>
            For property managers, landlords, and vendors: business
            information necessary for payment onboarding, including
            taxpayer identification (IRS Form W-9) and bank account
            details used to receive payouts.
          </li>
          <li>
            For rental applicants: application data (employment history,
            income, references, consent forms) required for screening.
          </li>
        </LegalList>
        <h3 className="text-base font-medium text-foreground">
          Payment Information
        </h3>
        <LegalParagraph>
          Payment card and bank account data is collected and stored by
          Kadima Payments (&quot;Kadima&quot;), our PCI-DSS-compliant
          payment processor. DoorStax does not store full payment card
          numbers on its own systems; we retain only tokens and
          last-four-digit identifiers returned by Kadima.
        </LegalParagraph>
        <h3 className="text-base font-medium text-foreground">
          Technical Information
        </h3>
        <LegalList>
          <li>
            Device, browser, operating system, and IP address data for
            security, debugging, and analytics.
          </li>
          <li>
            Cookies and similar technologies — see our{" "}
            <Link href="/cookie" className="text-secondary hover:underline">
              Cookie Policy
            </Link>
            .
          </li>
          <li>
            Audit-log records of sensitive actions taken within the
            Service.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="2. How We Use Information">
        <LegalParagraph>We use collected information to:</LegalParagraph>
        <LegalList>
          <li>Provide, operate, and improve the Service.</li>
          <li>
            Process rent payments, vendor payouts, and owner distributions
            through Kadima.
          </li>
          <li>
            Verify identity, conduct fraud prevention, and comply with
            anti-money-laundering and know-your-customer obligations.
          </li>
          <li>
            Facilitate tenant screening (with the applicant&apos;s explicit
            consent) through partner services.
          </li>
          <li>
            Communicate with you about your account, transactions, and
            platform updates, including transactional emails and, where
            permitted, marketing communications.
          </li>
          <li>Enforce our Terms of Service and Acceptable Use Policy.</li>
          <li>
            Comply with legal obligations (tax reporting, 1099 issuance,
            subpoenas, court orders).
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="3. How We Share Information">
        <LegalParagraph>
          We share information only in the following circumstances:
        </LegalParagraph>
        <LegalList>
          <li>
            <strong>Payment partner (Kadima).</strong> Transaction, vault,
            and payout data is shared with Kadima to process payments.
          </li>
          <li>
            <strong>Service providers.</strong> Vendors supporting our
            infrastructure — hosting (Vercel), email delivery (Resend),
            blob storage, error monitoring — receive only the data
            necessary to perform their function and are contractually
            bound to confidentiality.
          </li>
          <li>
            <strong>Property manager access.</strong> Tenants&apos; and
            vendors&apos; data is visible to the property manager servicing
            their unit or work order. This is inherent to the platform.
          </li>
          <li>
            <strong>Legal compliance.</strong> We disclose information when
            required by law, subpoena, court order, or to protect
            ourselves or others from fraud, harm, or violation of our
            Terms.
          </li>
          <li>
            <strong>Business transfers.</strong> In the event of a merger,
            acquisition, or sale of assets, user information may transfer
            to the successor entity, subject to the terms of this policy.
          </li>
        </LegalList>
        <LegalParagraph>
          <strong>We do not sell your personal information.</strong> We do
          not share personal information for cross-context behavioral
          advertising.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="4. Data Retention">
        <LegalParagraph>
          We retain personal information for as long as necessary to
          provide the Service and meet our legal, tax, and compliance
          obligations:
        </LegalParagraph>
        <LegalList>
          <li>
            <strong>Payment and tax records</strong> (payment history,
            W-9s, 1099 data): retained for at least seven (7) years after
            the tax year in which the transaction occurred, as required by
            IRS recordkeeping rules.
          </li>
          <li>
            <strong>Account data</strong> (profile, messages, documents):
            retained for the life of the account plus a buffer period of
            up to thirty (30) days after account deletion.
          </li>
          <li>
            <strong>Audit logs</strong> (sensitive admin + financial
            actions): retained indefinitely for security and compliance
            investigation purposes.
          </li>
          <li>
            <strong>Marketing contacts</strong> (lead forms, newsletter
            signups): until you unsubscribe, at which point we retain
            suppression-list records so that we do not email you again.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="5. Security">
        <LegalParagraph>
          We implement industry-standard administrative, technical, and
          physical safeguards to protect your information. These include
          encryption in transit (TLS 1.2+) and at rest, access controls,
          audit logging, and regular security reviews. Payment card data
          is handled exclusively by Kadima Payments under their PCI DSS
          Level 1 attestation; DoorStax does not store full PANs on its
          own systems.
        </LegalParagraph>
        <LegalParagraph>
          No system is 100% secure. If we become aware of a breach
          affecting your personal information, we will notify you and the
          appropriate authorities as required by applicable law.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="6. Your Rights">
        <LegalParagraph>
          You have the right to:
        </LegalParagraph>
        <LegalList>
          <li>Access the personal information we hold about you.</li>
          <li>Correct inaccurate information.</li>
          <li>
            Request deletion of your personal information, subject to
            legal retention requirements.
          </li>
          <li>
            Export your data in a portable format (available to property
            managers through the admin dashboard; tenants may request
            export by contacting support).
          </li>
          <li>Opt out of marketing communications at any time.</li>
        </LegalList>
        <LegalParagraph>
          To exercise these rights, email{" "}
          <a
            href="mailto:privacy@doorstax.com"
            className="text-secondary hover:underline"
          >
            privacy@doorstax.com
          </a>
          . We will respond within the timeframes required by applicable
          law.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="7. California Privacy Rights (CCPA / CPRA)">
        <LegalParagraph>
          California residents have additional rights under the California
          Consumer Privacy Act (&quot;CCPA&quot;) and California Privacy
          Rights Act (&quot;CPRA&quot;):
        </LegalParagraph>
        <LegalList>
          <li>
            <strong>Right to know</strong> what personal information we
            have collected, used, disclosed, and (if applicable) sold
            about you over the past 12 months.
          </li>
          <li>
            <strong>Right to delete</strong> personal information we have
            collected from you, subject to statutory exceptions.
          </li>
          <li>
            <strong>Right to correct</strong> inaccurate personal
            information.
          </li>
          <li>
            <strong>Right to opt out</strong> of the sale or sharing of
            your personal information. DoorStax does not sell or share
            personal information for cross-context behavioral advertising,
            so there is nothing to opt out of — but you still have the
            right to ask.
          </li>
          <li>
            <strong>Right to limit use</strong> of sensitive personal
            information (e.g. financial account data) to the purposes
            permitted by the CPRA.
          </li>
          <li>
            <strong>Right to non-discrimination</strong> when you exercise
            any of the above rights.
          </li>
        </LegalList>
        <LegalParagraph>
          To exercise CCPA/CPRA rights, email{" "}
          <a
            href="mailto:privacy@doorstax.com"
            className="text-secondary hover:underline"
          >
            privacy@doorstax.com
          </a>{" "}
          with the subject line &quot;California Privacy Request.&quot; You
          may designate an authorized agent to act on your behalf; we may
          require reasonable verification of both your identity and the
          agent&apos;s authorization.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="8. Children's Privacy">
        <LegalParagraph>
          The Service is not intended for anyone under the age of 18.
          DoorStax does not knowingly collect personal information from
          children under 13 in compliance with the Children&apos;s Online
          Privacy Protection Act (COPPA). If we become aware that we have
          inadvertently collected such information, we will delete it
          promptly.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="9. International Users">
        <LegalParagraph>
          DoorStax operates in the United States. If you access the
          Service from outside the U.S., you consent to the transfer and
          processing of your information in the United States under
          applicable U.S. law, which may differ from the privacy laws of
          your home jurisdiction.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="10. Changes to This Policy">
        <LegalParagraph>
          We may update this Privacy Policy from time to time. Material
          changes will be communicated via email or through the platform
          dashboard, and the &quot;Last updated&quot; date at the top of
          this page will be revised. Continued use of the Service after
          such notice constitutes acceptance of the updated policy.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="11. Contact">
        <LegalParagraph>
          Privacy questions, requests, or complaints:
        </LegalParagraph>
        <LegalParagraph>
          <strong>Email:</strong>{" "}
          <a
            href="mailto:privacy@doorstax.com"
            className="text-secondary hover:underline"
          >
            privacy@doorstax.com
          </a>
        </LegalParagraph>
        <LegalParagraph>
          <strong>Mailing address:</strong> DoorStax Privacy Team, c/o
          Kadima Payments, 26565 Agoura Road, Suite 200, Calabasas, CA
          91302.
        </LegalParagraph>
      </LegalSection>
    </LegalPage>
  );
}

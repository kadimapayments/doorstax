import Link from "next/link";
import {
  LegalPage,
  LegalSection,
  LegalParagraph,
  LegalList,
} from "@/components/legal/legal-page";

export const metadata = {
  title: "Acceptable Use Policy — DoorStax",
};

export default function AcceptableUsePolicyPage() {
  return (
    <LegalPage title="Acceptable Use Policy" lastUpdated="April 2026">
      <LegalParagraph>
        This Acceptable Use Policy (&quot;AUP&quot;) applies to everyone
        who uses DoorStax — property managers, landlords, tenants,
        vendors, owners, and any other account holder — and is
        incorporated into our{" "}
        <Link href="/terms" className="text-secondary hover:underline">
          Terms of Service
        </Link>
        . Violating this AUP may result in content removal, account
        suspension or termination, and, where appropriate, referral to
        law enforcement.
      </LegalParagraph>

      <LegalSection title="1. Prohibited conduct">
        <LegalParagraph>
          You agree not to use the Service to:
        </LegalParagraph>
        <LegalList>
          <li>
            Violate any law, regulation, or third-party right, including
            intellectual-property, privacy, and publicity rights.
          </li>
          <li>
            Discriminate in housing on the basis of race, color, national
            origin, religion, sex, familial status, disability, or any
            other class protected by the federal Fair Housing Act, state,
            or local law.
          </li>
          <li>
            List, advertise, or collect payment for a property you do not
            have the legal right to lease or manage.
          </li>
          <li>
            Engage in money laundering, terrorism financing, or any
            transaction on behalf of a sanctioned person, entity, or
            jurisdiction (OFAC).
          </li>
          <li>
            Use the payment features for card testing, synthetic identity
            fraud, chargeback fraud, or any scheme to circumvent card
            network rules.
          </li>
          <li>
            Impersonate another person, misrepresent your affiliation
            with any person or entity, or provide false information
            (fake email, fake taxpayer identification, fake W-9) during
            onboarding.
          </li>
          <li>
            Harass, threaten, defame, or abuse other users through the
            platform — including in messages, maintenance tickets,
            reviews, or comment threads.
          </li>
          <li>
            Upload or transmit content that is illegal, obscene, violent,
            hateful, or that infringes another person&apos;s rights.
          </li>
          <li>
            Scrape, crawl, mirror, or otherwise systematically extract
            data from the Service without our prior written permission.
          </li>
          <li>
            Attempt to reverse-engineer, decompile, probe for
            vulnerabilities, or interfere with the operation of the
            Service (denial-of-service attempts, credential stuffing,
            injection attacks, etc.).
          </li>
          <li>
            Use the Service to send unsolicited commercial email (spam),
            including to leads or tenants outside the scope of the
            legitimate landlord-tenant relationship.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="2. Card network compliance (processor pass-through)">
        <LegalParagraph>
          Payments on DoorStax are processed by Kadima Payments, a
          licensed payment facilitator. The card networks (Visa,
          MasterCard, American Express, Discover) impose their own
          operating regulations on every transaction that flows through
          their rails. By using DoorStax&apos;s payment features, you
          agree to comply with those operating regulations as
          administered and enforced by Kadima, including but not limited
          to prohibitions on the sale of prohibited merchandise, minimum
          transaction amount rules, surcharge disclosure rules, and
          chargeback-handling procedures.
        </LegalParagraph>
        <LegalParagraph>
          DoorStax is not a card network, is not a money transmitter,
          and does not itself enforce card-network rules — but we will
          act on reports from Kadima, card brands, or acquiring banks
          that require us to suspend or terminate accounts that breach
          network rules.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="3. Tenant screening and Fair Credit Reporting">
        <LegalParagraph>
          Tenant screening made available through DoorStax is provided
          by third-party consumer-reporting agencies. If you request a
          screening report, you acknowledge that you are a permissible
          user under the Fair Credit Reporting Act (FCRA), that you have
          obtained the applicant&apos;s written consent, and that you
          will provide adverse-action notices where required by law. You
          are solely responsible for ensuring your screening criteria
          comply with the Fair Housing Act and state or local
          source-of-income and credit-history ordinances.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="4. Vendor conduct">
        <LegalParagraph>
          Vendors agree to:
        </LegalParagraph>
        <LegalList>
          <li>
            Maintain all licenses and insurance required for the trades
            they advertise on the platform.
          </li>
          <li>
            Invoice only for work actually performed, at the amounts
            agreed with the property manager.
          </li>
          <li>
            Not solicit direct payment outside the platform for work
            tracked in a DoorStax service ticket, without the property
            manager&apos;s written authorization.
          </li>
          <li>
            Respect tenants&apos; property and privacy when entering a
            unit to perform work.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="5. Reporting abuse">
        <LegalParagraph>
          If you believe another user has violated this AUP, report it
          to{" "}
          <a
            href="mailto:abuse@doorstax.com"
            className="text-secondary hover:underline"
          >
            abuse@doorstax.com
          </a>
          . Include as much detail as possible (account email, URL,
          screenshot, timestamps) so we can investigate quickly. We
          cannot respond to every report individually but we read and
          act on them.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="6. Enforcement">
        <LegalParagraph>
          DoorStax may, in its sole discretion, investigate any suspected
          violation and take action including (without limitation):
          warning the user, removing specific content, suspending access
          to specific features, suspending or terminating the account,
          reversing transactions, reporting to the appropriate
          authorities, and cooperating with law enforcement.
        </LegalParagraph>
        <LegalParagraph>
          Serious violations — such as fraud, fair-housing-act
          violations, or actual harm to other users — can result in
          immediate termination without warning. Less serious violations
          usually begin with a notice and opportunity to cure.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="7. Changes">
        <LegalParagraph>
          We may update this AUP from time to time. Material changes
          will be communicated via email or through the platform
          dashboard; continued use of the Service after such notice
          constitutes acceptance.
        </LegalParagraph>
      </LegalSection>
    </LegalPage>
  );
}

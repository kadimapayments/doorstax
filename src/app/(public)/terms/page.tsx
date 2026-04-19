import Link from "next/link";
import {
  LegalPage,
  LegalSection,
  LegalParagraph,
  LegalList,
} from "@/components/legal/legal-page";

export const metadata = {
  title: "Terms of Service — DoorStax",
};

export default function TermsOfServicePage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="April 2026">
      <LegalSection title="1. Acceptance of Terms">
        <LegalParagraph>
          By accessing or using the DoorStax platform, website, and any
          associated services (collectively, the &quot;Service&quot;), you
          agree to be bound by these Terms of Service (&quot;Terms&quot;). If
          you do not agree to these Terms, you may not access or use the
          Service. These Terms constitute a legally binding agreement between
          you and DoorStax. By creating an account, logging in, or otherwise
          interacting with the Service, you acknowledge that you have read,
          understood, and agree to be bound by these Terms, our{" "}
          <Link href="/privacy" className="text-secondary hover:underline">
            Privacy Policy
          </Link>
          , our{" "}
          <Link href="/cookie" className="text-secondary hover:underline">
            Cookie Policy
          </Link>
          , and our{" "}
          <Link
            href="/acceptable-use"
            className="text-secondary hover:underline"
          >
            Acceptable Use Policy
          </Link>
          . Property managers and landlords are additionally bound by the{" "}
          <Link
            href="/merchant-agreement"
            className="text-secondary hover:underline"
          >
            Merchant Agreement
          </Link>
          .
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="2. Description of Service">
        <LegalParagraph>
          DoorStax is a property management and payment platform designed to
          streamline the relationship between landlords, property managers,
          tenants, vendors, and owners. The Service provides tools for
          property management, tenant onboarding, rent collection, maintenance
          request tracking, application management, vendor management, and
          financial reporting. DoorStax facilitates payment processing
          through its partnership with Kadima Payments (&quot;Kadima&quot;),
          a licensed payment facilitator, who handles all ACH transfers and
          credit/debit card transactions on behalf of DoorStax and its users.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="3. User Accounts">
        <LegalParagraph>
          The Service supports several account types: property managers,
          landlords, tenants, vendors, owners, and platform partners.
          Property managers and landlords register directly. Tenants are
          invited by their property manager or landlord. Vendors may
          self-register or be invited by a property manager. Account creation
          for certain roles (owners, tenants) is generally initiated by the
          property manager servicing that account.
        </LegalParagraph>
        <LegalParagraph>
          You are responsible for maintaining the confidentiality of your
          account credentials. You agree to notify DoorStax immediately of
          any unauthorized use of your account. DoorStax is not liable for
          any loss or damage arising from your failure to safeguard your
          login information. You must provide accurate and complete
          information when creating your account and keep it up to date.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="4. Landlord / Property Manager Responsibilities">
        <LegalParagraph>
          As a landlord or property manager using DoorStax, you agree to:
        </LegalParagraph>
        <LegalList>
          <li>
            Provide accurate property information including addresses, unit
            details, and rental amounts.
          </li>
          <li>
            Comply with all applicable federal, state, and local laws,
            including the Fair Housing Act, state landlord-tenant laws, and
            all applicable anti-discrimination, consumer-protection, and
            data-privacy regulations.
          </li>
          <li>
            Ensure that rental application templates, tenant screening
            criteria, and pricing practices comply with applicable laws.
          </li>
          <li>
            Maintain proper books and records for all financial transactions
            conducted through the platform, including records required for
            tax reporting (e.g. IRS 1099 issuance where applicable).
          </li>
          <li>
            Respond to tenant maintenance requests and communications in a
            timely manner consistent with your jurisdiction&apos;s
            implied-warranty-of-habitability standards.
          </li>
          <li>
            Complete the merchant onboarding process — including identity
            verification, W-9 collection, and bank verification — to enable
            payment processing through Kadima.
          </li>
          <li>
            Honor the{" "}
            <Link
              href="/merchant-agreement"
              className="text-secondary hover:underline"
            >
              Merchant Agreement
            </Link>
            , which governs your commercial relationship with DoorStax.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="5. Tenant Responsibilities">
        <LegalParagraph>
          As a tenant using DoorStax, you agree to:
        </LegalParagraph>
        <LegalList>
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
        </LegalList>
      </LegalSection>

      <LegalSection title="6. Vendor Responsibilities">
        <LegalParagraph>
          As a service vendor using DoorStax, you agree to:
        </LegalParagraph>
        <LegalList>
          <li>
            Provide accurate business information and tax documentation
            (including a completed IRS Form W-9) required for you to receive
            payments and for property managers to meet their 1099-NEC
            reporting obligations.
          </li>
          <li>
            Maintain the licenses, insurance, and qualifications required to
            perform the services you advertise on the platform.
          </li>
          <li>
            Respond to service tickets assigned to you in a timely and
            professional manner.
          </li>
          <li>
            Submit accurate, non-duplicative invoices for completed work.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="7. Payment Processing">
        <LegalParagraph>
          Payment processing on DoorStax is powered by Kadima Payments, a
          licensed payment facilitator. Kadima — not DoorStax — is the
          merchant of record and card-network-registered entity handling
          settlement, chargebacks, reserves, and related processor functions.
          DoorStax provides the software interface and workflow surrounding
          these transactions. By using the payment features of the Service,
          you also agree to the terms and conditions of Kadima Payments and
          acknowledge that the operating regulations of the card networks
          (Visa, MasterCard, American Express, and Discover) apply to your
          use of the payment features through Kadima.
        </LegalParagraph>
        <LegalParagraph>
          Payments made via credit or debit card are subject to a surcharge
          or convenience fee as disclosed to the payer at the time of
          payment. ACH (bank transfer) payments may be subject to processing
          fees as outlined in the Fees section below. All payment
          transactions are processed in U.S. dollars. DoorStax and Kadima
          reserve the right to delay, suspend, or reverse any transaction
          that is suspected of being fraudulent or in violation of these
          Terms.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="8. Fees">
        <LegalParagraph>
          The following fees apply to payment processing on DoorStax:
        </LegalParagraph>
        <LegalList>
          <li>
            <strong>Card Payments:</strong> A surcharge (currently 3.25%,
            subject to change with notice) is applied to all credit and debit
            card transactions. The surcharge is disclosed to the payer at
            the time of payment and added to the total transaction amount,
            except where prohibited by law.
          </li>
          <li>
            <strong>ACH Payments:</strong> ACH processing fees are charged to
            the property manager or landlord as part of their subscription
            or per-transaction fee structure. Tenants are not charged
            additional fees for ACH payments except where expressly
            disclosed.
          </li>
          <li>
            <strong>Platform subscription:</strong> Property managers and
            landlords pay a monthly subscription per the{" "}
            <Link
              href="/merchant-agreement"
              className="text-secondary hover:underline"
            >
              Merchant Agreement
            </Link>
            , which governs billing cadence, pricing tiers, and cancellation.
          </li>
        </LegalList>
        <LegalParagraph>
          DoorStax reserves the right to modify its fee structure with
          reasonable prior notice to affected users. Any changes will be
          communicated via email or through the platform dashboard.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="9. Data Handling & Security">
        <LegalParagraph>
          DoorStax takes data security seriously. We implement
          industry-standard security measures to protect your personal and
          financial information. Payment card data is handled in compliance
          with PCI DSS standards by Kadima Payments, our payment processor
          partner; DoorStax itself does not store full primary account
          numbers. Personal data is encrypted in transit and at rest. For
          full details on how we collect, use, and protect your data, please
          review our{" "}
          <Link href="/privacy" className="text-secondary hover:underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/cookie" className="text-secondary hover:underline">
            Cookie Policy
          </Link>
          .
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="10. Acceptable Use">
        <LegalParagraph>
          Your use of the Service is governed by our{" "}
          <Link
            href="/acceptable-use"
            className="text-secondary hover:underline"
          >
            Acceptable Use Policy
          </Link>
          , which prohibits (among other things) fraudulent activity,
          discriminatory housing practices, harassment, scraping, and any
          use of the platform that violates applicable law. Violations may
          result in immediate account suspension or termination.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="11. Limitation of Liability">
        <LegalParagraph>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, DOORSTAX AND ITS
          AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT
          BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
          PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE
          SERVICE. THIS INCLUDES, WITHOUT LIMITATION, DAMAGES FOR LOSS OF
          PROFITS, DATA, GOODWILL, OR OTHER INTANGIBLE LOSSES.
        </LegalParagraph>
        <LegalParagraph>
          DoorStax does not guarantee uninterrupted or error-free operation
          of the Service. We are not responsible for any damages resulting
          from payment processing delays, system downtime, or third-party
          service failures. OUR TOTAL CUMULATIVE LIABILITY TO YOU FOR ANY
          AND ALL CLAIMS ARISING FROM OR RELATED TO THE SERVICE SHALL NOT
          EXCEED THE GREATER OF (A) THE TOTAL AMOUNT YOU PAID TO DOORSTAX
          IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE
          CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS ($100).
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="12. Termination">
        <LegalParagraph>
          Either party may terminate access to the Service at any time.
          DoorStax reserves the right to suspend or terminate your account
          if you violate these Terms, engage in fraudulent activity, or fail
          to maintain accurate account information. Upon termination, your
          right to access the Service will cease immediately. Any
          outstanding payment obligations will survive termination. DoorStax
          will make reasonable efforts to allow you to export your data
          before account closure, in accordance with applicable data
          retention laws.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="13. Governing Law & Dispute Resolution">
        <LegalParagraph>
          These Terms shall be governed by and construed in accordance with
          the laws of the State of California, without regard to its
          conflict-of-law provisions.
        </LegalParagraph>
        <LegalParagraph>
          <strong>Binding arbitration.</strong> Any dispute, claim, or
          controversy arising out of or relating to these Terms or the
          Service shall be resolved by final and binding arbitration
          administered in Los Angeles County, California, under the
          then-current Commercial Arbitration Rules of the American
          Arbitration Association. Judgment on the arbitrator&apos;s award
          may be entered in any court of competent jurisdiction.
        </LegalParagraph>
        <LegalParagraph>
          <strong>Class-action waiver.</strong> You agree that any
          arbitration or legal proceeding shall be conducted on an
          individual basis and not as a class, collective, consolidated, or
          representative action. The arbitrator may not consolidate the
          claims of multiple parties.
        </LegalParagraph>
        <LegalParagraph>
          <strong>E-Sign Act authorization.</strong> By creating an account
          or accepting these Terms electronically, you consent to the use
          of electronic records and signatures under the federal Electronic
          Signatures in Global and National Commerce Act (E-Sign Act) and
          any applicable state equivalents.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="14. Changes to Terms">
        <LegalParagraph>
          DoorStax may update these Terms from time to time. Material
          changes will be communicated via email or through the platform
          dashboard, and your continued use of the Service after such notice
          constitutes acceptance of the revised Terms. If you do not agree
          to a revision, you must stop using the Service and may terminate
          your account.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="15. Contact Information">
        <LegalParagraph>
          If you have questions or concerns about these Terms of Service,
          please contact us at:
        </LegalParagraph>
        <LegalParagraph>
          <strong>Email:</strong>{" "}
          <a
            href="mailto:support@doorstax.com"
            className="text-secondary hover:underline"
          >
            support@doorstax.com
          </a>
        </LegalParagraph>
      </LegalSection>
    </LegalPage>
  );
}

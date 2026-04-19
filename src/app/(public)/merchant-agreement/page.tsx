import Link from "next/link";
import {
  LegalPage,
  LegalSection,
  LegalParagraph,
  LegalList,
} from "@/components/legal/legal-page";

export const metadata = {
  title: "Merchant Agreement — DoorStax",
};

export default function MerchantAgreementPage() {
  return (
    <LegalPage title="Merchant Agreement" lastUpdated="April 2026">
      <LegalParagraph>
        This Merchant Agreement (&quot;Agreement&quot;) governs the
        commercial relationship between DoorStax and any property manager,
        landlord, or other business customer (collectively,
        &quot;Merchant&quot; or &quot;you&quot;) using the DoorStax
        platform to manage properties, collect rent, pay vendors, and
        operate a residential-rental business. It is entered into in
        addition to, and incorporates by reference, our{" "}
        <Link href="/terms" className="text-secondary hover:underline">
          Terms of Service
        </Link>
        ,{" "}
        <Link href="/privacy" className="text-secondary hover:underline">
          Privacy Policy
        </Link>
        ,{" "}
        <Link href="/cookie" className="text-secondary hover:underline">
          Cookie Policy
        </Link>
        , and{" "}
        <Link
          href="/acceptable-use"
          className="text-secondary hover:underline"
        >
          Acceptable Use Policy
        </Link>
        .
      </LegalParagraph>

      <LegalParagraph>
        Payment processing is performed by Kadima Payments
        (&quot;Kadima&quot;), our licensed payment-facilitator partner,
        under a separate merchant agreement between you and Kadima
        available at{" "}
        <Link
          href="/legal/merchant-agreement"
          className="text-secondary hover:underline"
        >
          /legal/merchant-agreement
        </Link>
        . That document governs the payment-rails side of your
        relationship (settlement, chargebacks, reserves, card-network
        rules). This Agreement governs the DoorStax software side
        (platform access, subscription, data rights).
      </LegalParagraph>

      <LegalSection title="1. Platform access and subscription">
        <LegalParagraph>
          DoorStax provides a subscription-based SaaS platform. Your
          subscription tier determines the number of units you may
          manage, the team-member seats available, and the feature set
          (reporting, accounting, tenant screening, marketing tools,
          etc.) included at your tier.
        </LegalParagraph>
        <LegalParagraph>
          Current tier pricing is displayed inside the platform at
          signup and in your account settings. DoorStax may adjust
          pricing and tier composition with at least thirty (30) days&apos;
          prior notice to affected Merchants. Price changes take effect
          at the next billing cycle after the notice window.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="2. Billing and autopay">
        <LegalParagraph>
          Subscription fees are billed monthly in advance. By providing
          a payment method during onboarding, you authorize DoorStax to
          charge that method on a recurring basis for your subscription,
          applicable per-unit fees, per-transaction platform fees, and
          any add-on services you enable. You may update your payment
          method or cancel the subscription from your account settings
          at any time; cancellation takes effect at the end of the
          then-current billing period.
        </LegalParagraph>
        <LegalParagraph>
          Failed subscription payments trigger a dunning process (email
          reminders + retry attempts). If a subscription remains unpaid
          after thirty (30) days, DoorStax may suspend platform access
          until the balance is cured. Payment-processing features
          (rent collection) may remain operational during suspension so
          tenants can continue to pay; your access to the corresponding
          data requires the account to be in good standing.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="3. Platform fees and payment surcharges">
        <LegalParagraph>
          In addition to the subscription fee, the following fees may
          apply depending on your configuration:
        </LegalParagraph>
        <LegalList>
          <li>
            <strong>Card surcharges</strong> (typically passed to the
            tenant) disclosed at the point of payment.
          </li>
          <li>
            <strong>ACH processing fees</strong> charged to the Merchant
            or, where permitted by law and disclosed, to the tenant.
          </li>
          <li>
            <strong>Payout fees</strong> for owner distributions and
            vendor ACH credits.
          </li>
          <li>
            <strong>Add-on fees</strong> for tenant screening reports,
            document e-signatures, or other à-la-carte features.
          </li>
        </LegalList>
        <LegalParagraph>
          Fees are described in your fee schedule inside the platform
          and in the Kadima merchant agreement. You agree that these
          fees may be deducted from payment flows (rent collection,
          owner payouts) before net amounts are distributed, and that
          our fee schedule can be updated with notice consistent with
          Section 1.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="4. Data ownership">
        <LegalParagraph>
          You own your business data — tenant records, property data,
          lease documents, accounting entries, and messages. DoorStax
          has a limited, non-exclusive license to process that data for
          the purpose of providing the Service, as described in our{" "}
          <Link
            href="/privacy"
            className="text-secondary hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </LegalParagraph>
        <LegalParagraph>
          DoorStax owns the platform itself — including the software,
          design, workflows, algorithms, and any derived aggregate /
          anonymized statistics. Nothing in this Agreement transfers
          ownership of the platform to you.
        </LegalParagraph>
        <LegalParagraph>
          Upon termination, you may export your data through the admin
          dashboard or by request to{" "}
          <a
            href="mailto:support@doorstax.com"
            className="text-secondary hover:underline"
          >
            support@doorstax.com
          </a>{" "}
          for at least thirty (30) days. After that period, we may
          delete your data subject to the retention requirements in our
          Privacy Policy (e.g. 7-year tax records).
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="5. Service level expectations">
        <LegalParagraph>
          DoorStax targets 99.9% uptime for the core platform,
          measured monthly, excluding scheduled maintenance windows
          announced at least twenty-four (24) hours in advance and
          outages caused by upstream dependencies (payment processor,
          hosting provider, email delivery, etc.). We do not offer
          contractual service-level credits at this time; this target
          is a good-faith operational commitment, not a warranty.
        </LegalParagraph>
        <LegalParagraph>
          For production incidents affecting your account, contact{" "}
          <a
            href="mailto:support@doorstax.com"
            className="text-secondary hover:underline"
          >
            support@doorstax.com
          </a>
          . Critical incidents (payment flow outage, data loss, active
          security incident) are prioritized for same-day response.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="6. Onboarding obligations">
        <LegalParagraph>
          To enable payment processing, you must complete the
          merchant-onboarding workflow, which includes:
        </LegalParagraph>
        <LegalList>
          <li>
            Business identity verification (legal entity name, EIN,
            principal-officer information).
          </li>
          <li>
            Bank account verification for receiving rent and paying out
            owners / vendors.
          </li>
          <li>
            Executing the separate Kadima merchant agreement governing
            the payment processor relationship.
          </li>
          <li>
            Acceptance of this Agreement and all referenced policies.
          </li>
        </LegalList>
        <LegalParagraph>
          You represent that all information you provide during
          onboarding is true, complete, and current, and that you will
          update it promptly when it changes.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="7. Representations and responsibilities">
        <LegalParagraph>
          You represent and warrant that:
        </LegalParagraph>
        <LegalList>
          <li>
            You have the legal authority to lease or manage each
            property you list on the platform.
          </li>
          <li>
            Your use of the Service complies with applicable federal,
            state, and local laws — including the Fair Housing Act,
            state landlord-tenant laws, security-deposit laws,
            eviction procedures, and consumer-reporting obligations
            under FCRA.
          </li>
          <li>
            Rent charges, deposits, fees, and late charges collected
            through the platform are consistent with the underlying
            lease agreement and applicable law.
          </li>
          <li>
            You will respond to tenant-affecting disputes
            (habitability, overcharges, wrongful withholdings) on
            their merits, and that DoorStax is not a party to those
            disputes between Merchant and tenant.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="8. Indemnification">
        <LegalParagraph>
          You agree to indemnify, defend, and hold harmless DoorStax
          and its affiliates from and against any claims, liabilities,
          damages, losses, and expenses — including reasonable
          attorneys&apos; fees — arising out of or related to (a) your
          breach of this Agreement, the Terms of Service, or any
          applicable law; (b) the conduct of your business toward
          tenants, vendors, owners, and applicants; and (c) any claim
          by a tenant, vendor, or third party arising out of the
          underlying landlord-tenant relationship or services you
          provide through the platform.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="9. Term and termination">
        <LegalParagraph>
          This Agreement continues as long as you maintain an active
          DoorStax account. Either party may terminate on thirty (30)
          days&apos; written notice for any reason, and DoorStax may
          terminate or suspend access immediately for any material
          breach, payment default, or violation of the Acceptable Use
          Policy.
        </LegalParagraph>
        <LegalParagraph>
          Termination does not relieve either party of payment
          obligations accrued prior to termination. Sections covering
          data ownership, indemnification, dispute resolution, and
          limitation of liability survive termination.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="10. Governing law and dispute resolution">
        <LegalParagraph>
          This Agreement is governed by the laws of the State of
          California, without regard to its conflict-of-law provisions.
          Disputes arising under this Agreement are resolved by final
          and binding arbitration administered in Los Angeles County,
          California, under the American Arbitration Association&apos;s
          Commercial Arbitration Rules — the same venue and process as
          the Terms of Service. See Section 13 of the{" "}
          <Link href="/terms" className="text-secondary hover:underline">
            Terms of Service
          </Link>{" "}
          for the full dispute-resolution clause, including the
          class-action waiver and E-Sign Act authorization.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="11. Changes">
        <LegalParagraph>
          DoorStax may update this Agreement from time to time.
          Material changes will be communicated via email or the
          platform dashboard at least thirty (30) days before taking
          effect. Continued use of the Service after the effective date
          constitutes acceptance of the revised Agreement.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="12. Contact">
        <LegalParagraph>
          Questions about this Agreement:
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

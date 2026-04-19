import Link from "next/link";
import {
  LegalPage,
  LegalSection,
  LegalParagraph,
  LegalList,
} from "@/components/legal/legal-page";

export const metadata = {
  title: "Cookie Policy — DoorStax",
};

export default function CookiePolicyPage() {
  return (
    <LegalPage title="Cookie Policy" lastUpdated="April 2026">
      <LegalParagraph>
        This Cookie Policy explains how DoorStax and its service providers
        use cookies and similar technologies when you visit our website or
        use the DoorStax platform. It should be read alongside our{" "}
        <Link href="/privacy" className="text-secondary hover:underline">
          Privacy Policy
        </Link>
        , which describes how we handle your personal information more
        broadly.
      </LegalParagraph>

      <LegalSection title="1. What are cookies?">
        <LegalParagraph>
          Cookies are small text files that a website places on your
          device to remember information between page loads or visits.
          They can be set by the site you are visiting (&quot;first-party
          cookies&quot;) or by a third party whose content is embedded in
          the site (&quot;third-party cookies&quot;). &quot;Similar
          technologies&quot; in this policy means localStorage,
          sessionStorage, pixels, and other browser-based storage
          mechanisms.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="2. How we use cookies">
        <LegalParagraph>
          DoorStax uses cookies for the following purposes:
        </LegalParagraph>
        <h3 className="text-base font-medium text-foreground">
          Strictly necessary
        </h3>
        <LegalList>
          <li>
            <strong>Authentication.</strong> NextAuth session cookies and
            CSRF tokens that keep you signed in and protect form
            submissions. Without these, the Service cannot function.
          </li>
          <li>
            <strong>Impersonation.</strong> When an administrator is
            impersonating another user for support, a short-lived cookie
            records the active impersonation context.
          </li>
          <li>
            <strong>Security.</strong> Cookies used for rate limiting and
            abuse prevention.
          </li>
        </LegalList>
        <h3 className="text-base font-medium text-foreground">
          Preferences
        </h3>
        <LegalList>
          <li>
            Theme preference (light vs. dark mode) and sidebar-collapsed
            state.
          </li>
          <li>
            Filter selections on the dashboard (period, property scope)
            passed as URL search parameters.
          </li>
        </LegalList>
        <h3 className="text-base font-medium text-foreground">
          Analytics and performance
        </h3>
        <LegalList>
          <li>
            Aggregated analytics cookies and pixels that tell us which
            pages are used and where errors occur. We use Vercel Analytics
            and similar privacy-respecting tools that do not track
            individual users across other websites.
          </li>
        </LegalList>
        <h3 className="text-base font-medium text-foreground">
          Payment processor (Kadima)
        </h3>
        <LegalList>
          <li>
            When you enter payment information into a Kadima hosted card
            field or complete an ACH bank setup, Kadima may set its own
            cookies within its iframe for fraud prevention and
            session management. These cookies are governed by Kadima&apos;s
            privacy policy at{" "}
            <a
              href="https://kadimapayments.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-secondary hover:underline"
            >
              kadimapayments.com/privacy
            </a>
            .
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="3. Third parties">
        <LegalParagraph>
          Cookies placed by the following third parties may appear while
          using DoorStax:
        </LegalParagraph>
        <LegalList>
          <li>
            <strong>Vercel</strong> — hosting and analytics (performance,
            error monitoring).
          </li>
          <li>
            <strong>Kadima Payments</strong> — payment processor hosted
            fields and vault.
          </li>
          <li>
            <strong>Resend</strong> — transactional and marketing email
            delivery (open-tracking pixel where you consented).
          </li>
        </LegalList>
        <LegalParagraph>
          DoorStax does not sell or share cookie-derived data for
          cross-context behavioral advertising.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="4. Managing cookies">
        <LegalParagraph>
          Most browsers allow you to control cookies through their
          settings: you can block or delete cookies, or configure your
          browser to notify you when a cookie is being set. Blocking
          strictly-necessary cookies will prevent you from signing in to
          DoorStax.
        </LegalParagraph>
        <LegalParagraph>
          For general information about cookies and how to manage them,
          see:
        </LegalParagraph>
        <LegalList>
          <li>
            <a
              href="https://www.allaboutcookies.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-secondary hover:underline"
            >
              allaboutcookies.org
            </a>
          </li>
          <li>
            <a
              href="https://www.youronlinechoices.eu"
              target="_blank"
              rel="noopener noreferrer"
              className="text-secondary hover:underline"
            >
              youronlinechoices.eu
            </a>{" "}
            (EU users)
          </li>
          <li>
            <a
              href="https://www.aboutads.info/choices"
              target="_blank"
              rel="noopener noreferrer"
              className="text-secondary hover:underline"
            >
              aboutads.info/choices
            </a>{" "}
            (U.S. advertising opt-out)
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="5. Changes to this policy">
        <LegalParagraph>
          We may update this Cookie Policy when we add new tools or
          change providers. The &quot;Last updated&quot; date at the top
          of the page will reflect the most recent revision.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="6. Contact">
        <LegalParagraph>
          Questions about cookies:
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
      </LegalSection>
    </LegalPage>
  );
}

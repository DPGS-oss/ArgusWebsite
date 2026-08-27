import Link from "next/link";
import { LegalLayout } from "@/components/LegalLayout";

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <p className="text-sm text-slate">Last updated: 27 August 2026</p>

      <p>
        These Terms of Service (&quot;Terms&quot;) govern use of Argus (the website at
        argusinvoicing.com and the Argus mobile application) operated by{" "}
        <strong>B&amp;L Softwares and Logistics</strong> (&quot;we&quot;, &quot;us&quot;). By
        creating an account or using Argus you agree to these Terms and our{" "}
        <Link href="/privacy/">Privacy Policy</Link>. If you do not agree, do not use the service.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">1. Eligibility</h2>
      <p>
        You must be at least <strong>18 years old</strong> and have authority to bind the business,
        firm, company, or client whose records you enter. You are responsible for the accuracy and
        legality of all data you create or import.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">2. What Argus is (and is not)</h2>
      <p>
        Argus provides software tools for invoicing, books, inventory, khata, and GST-style{" "}
        <strong>summaries</strong> to help you prepare for compliance. Argus does{" "}
        <strong>not</strong> provide legal, tax, audit, or accounting advice. Argus is{" "}
        <strong>not</strong> a GST Suvidha Provider (GSP) and does not submit GSTR filings,
        e-invoice IRNs, or e-way bills to government systems unless we expressly launch a licensed
        integration and describe it in-product. You remain solely responsible for filings on the
        GST portal and for any tax consequences.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">3. Accounts and acceptable use</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Keep credentials confidential; you are responsible for activity under your account</li>
        <li>Use Argus only for lawful business purposes</li>
        <li>Do not attempt to bypass paywalls, trial limits, or security controls</li>
        <li>Do not abuse APIs, scrape, or interfere with service integrity</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold text-ink">4. Subscriptions (monthly / yearly)</h2>
      <p>
        Paid plans and prices are shown on the website or in the app store. Monthly and yearly
        Business plans billed via Razorpay may auto-renew until you cancel through the billing
        provider (or Play Store for in-app purchases). Cancel stops future renewals; it does not
        erase your duty to pay for the current period already charged.
      </p>
      <p>
        <strong>No refund on cancellation.</strong> If you cancel a subscription, fees already paid
        for the then-current billing period are <strong>non-refundable</strong>, and you will not
        receive a prorated refund for unused time, except where mandatory Indian consumer law
        requires otherwise or our <Link href="/refund/">Refund Policy</Link> expressly allows a
        limited case-by-case goodwill refund.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">5. Free trial</h2>
      <p>
        Where offered, a Business trial is limited (for example 14 days) and may be restricted to
        one per account, device, and network. Trials do not require a card on web; converting to a
        paid plan is optional. Misuse of trials may result in suspension.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">6. Lifetime Business licence</h2>
      <p>
        &quot;Lifetime&quot; (one-time purchase on the website, where offered) means a licence to
        use the <strong>then-current Argus Business product generation</strong> for the{" "}
        <strong>operational lifetime of that generation</strong>, not your personal lifetime, and
        not a guarantee that Argus or every feature will exist forever.
      </p>
      <p>
        Industry practice for SaaS &quot;lifetime&quot; offers commonly defines a maximum duration
        (often on the order of decades) and/or the life of the product. For clarity, our Lifetime
        licence lasts until the earlier of: (a) we permanently discontinue that Business product
        generation; or (b) <strong>twenty-five (25) years</strong> from the date of your Lifetime
        purchase.
      </p>
      <p>Lifetime includes, while we operate that generation:</p>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          Access to Business features of the <strong>current product generation</strong> you bought
          (Android app + web app under the same login, as we then offer them)
        </li>
        <li>
          Maintenance updates, bug fixes, and incremental improvements we choose to ship to that
          generation
        </li>
      </ul>
      <p>Lifetime does <strong>not</strong> include:</p>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          <strong>Add-on services</strong> sold separately (for example paid support packs, SMS,
          WhatsApp business APIs, GSP/e-invoice connectivity, premium AI quotas, or other SKUs we
          introduce later)
        </li>
        <li>
          <strong>New major versions, successor products, or full platform revamps</strong> that we
          designate as a new generation / overhaul (including a rebuild that replaces the current
          architecture or product line). Those may require a new purchase or subscription
        </li>
        <li>Transfer, resale, or sharing of the licence across unrelated organisations</li>
        <li>
          A refund if you later cancel, stop using Argus, or if we discontinue a specific feature
          within the generation while offering a reasonable alternative or migration path
        </li>
      </ul>
      <p>
        Lifetime purchases are <strong>non-refundable</strong> to the maximum extent permitted by
        law, except as required by mandatory law or as stated in the Refund Policy for clear
        non-delivery of access.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">7. Cloud sync and CA portal</h2>
      <p>
        Cloud sync requires an active Business (or valid trial/Lifetime) entitlement. CA invites
        create a read-only portal for accountants you choose; encrypted shares are your
        responsibility to distribute safely.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">8. Data and privacy</h2>
      <p>
        Our <Link href="/privacy/">Privacy Policy</Link> describes processing, processors (including
        Google Cloud Functions in <strong>us-central1</strong>), retention, and your rights. You
        must have a lawful basis to enter third-party (customer/supplier) data.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">9. Intellectual property</h2>
      <p>
        Argus software, branding, and documentation remain our property. You retain rights to your
        business data. You grant us a limited licence to host and process that data solely to
        provide the service.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">10. Disclaimers and liability</h2>
      <p>
        The service is provided <strong>as is</strong> and <strong>as available</strong>. To the
        fullest extent permitted by Indian law, we are not liable for indirect, incidental,
        special, consequential, or punitive damages; tax penalties; filing errors; lost profits; or
        data loss. Our aggregate liability for claims relating to Argus in any twelve-month period
        is limited to the fees you paid us for Argus in that period (or ₹5,000 if greater and
        required as a minimum by mandatory law).
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">11. Suspension and termination</h2>
      <p>
        We may suspend or terminate accounts for breach of these Terms, fraud, non-payment, or
        risk to the service. You may stop using Argus and request account deletion as described in
        the Privacy Policy.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">12. Changes</h2>
      <p>
        We may update these Terms. Continued use after the updated &quot;Last updated&quot; date
        constitutes acceptance. If you disagree, stop using Argus and cancel renewing
        subscriptions.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">13. Governing law</h2>
      <p>
        These Terms are governed by the laws of India. Courts in India shall have exclusive
        jurisdiction, subject to mandatory consumer protections that cannot be waived.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">14. Contact / Grievance</h2>
      <p>
        Support and Grievance Officer:{" "}
        <a href="mailto:support@argusinvoicing.com">support@argusinvoicing.com</a>
        <br />
        B&amp;L Softwares and Logistics, India
      </p>

      <p className="mt-8 text-sm text-slate">
        See also: <Link href="/refund/">Refund Policy</Link> ·{" "}
        <Link href="/privacy/">Privacy Policy</Link>
      </p>
    </LegalLayout>
  );
}

import Link from "next/link";
import { LegalLayout } from "@/components/LegalLayout";
import { GRIEVANCE_OFFICER, LEGAL_ENTITY } from "@/lib/legal";

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <p className="text-sm text-slate">Last updated: 15 October 2026</p>

      <p>
        These Terms of Service (&quot;Terms&quot;) govern use of Argus (the website at
        argusinvoicing.com and the Argus mobile application) operated by{" "}
        <strong>{LEGAL_ENTITY.name}</strong> (&quot;we&quot;, &quot;us&quot;). By creating an
        account or using Argus you agree to these Terms and acknowledge our{" "}
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
        Argus provides software tools for invoicing, books, inventory, khata, and GST{" "}
        <strong>summaries and export files</strong> to help you prepare for compliance. Argus does{" "}
        <strong>not</strong> provide legal, tax, audit, or accounting advice. Argus is{" "}
        <strong>not</strong> a GST Suvidha Provider (GSP). It does not file GST returns, generate
        e-invoice IRNs, or create e-way bills on government systems, and it never asks for your GST
        portal password. You remain solely responsible for what you upload or file on the GST
        portal and for any tax consequences. Check figures with your accountant before filing.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">3. Accounts and acceptable use</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Keep credentials confidential; you are responsible for activity under your account</li>
        <li>Use Argus only for lawful business purposes; do not issue false or fake invoices</li>
        <li>Do not attempt to bypass paywalls, trial limits, or security controls</li>
        <li>Do not abuse APIs, scrape, or interfere with service integrity</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold text-ink">4. Free plan and subscriptions</h2>
      <p>
        The <strong>Free plan</strong> on Android lets you make up to{" "}
        <strong>20 bills per calendar month</strong>; its bills carry a small &quot;Made with
        Argus&quot; watermark. Drafts and quotations do not count. We will give at least 30
        days&apos; notice in the app before reducing what the Free plan includes.
      </p>
      <p>
        Paid plans and prices are shown on the website or in the app store before you pay, and are
        inclusive of all taxes. Monthly and yearly Business plans auto-renew until you cancel.
        Website (Razorpay) plans: cancel in one click from your profile or from the app. Google Play
        plans: cancel in Play Store &gt; Payments &amp; subscriptions (the app takes you there).
        Your bank or card issuer sends a pre-debit notice before each renewal as RBI e-mandate rules
        require. Cancelling stops future renewals; you keep access until the end of the period
        already paid for.
      </p>
      <p>
        <strong>No refund on cancellation.</strong> If you cancel a subscription, fees already paid
        for the then-current billing period are <strong>non-refundable</strong>, and you will not
        receive a prorated refund for unused time, except where Indian law requires otherwise or
        our <Link href="/refund/">Refund Policy</Link> allows it.
      </p>

      <p>
        <strong>Users.</strong> The Business plan includes 2 users: you and one more person. Each
        extra user costs <strong>₹50 per month</strong> (inclusive of taxes), paid on the website in
        one payment up to the end of your current extra-user or plan period. Extra users end with
        that period unless you pay again; if they lapse, the users you added first keep access.
        Payments for extra users are not refunded if you remove a user or cancel, except where
        Indian law requires otherwise.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">5. Free trial</h2>
      <p>
        Where offered, a Business trial is limited (for example 14 days) and may be restricted to
        one per account, device, and network. Website trials do not ask for a card and do not turn
        into a paid plan on their own. If a Google Play plan includes a free trial, Play shows the
        date it becomes paid; cancel before that date to avoid being charged. Misuse of trials may
        result in suspension.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">6. Lifetime Business licence</h2>
      <p>
        &quot;Lifetime&quot; (one-time purchase on the website, where offered) means a licence to
        use the <strong>then-current Argus Business product generation</strong> for as long as we
        operate that generation, up to a maximum of <strong>twenty-five (25) years</strong> from
        your purchase. It is not your personal lifetime, and not a promise that every feature will
        exist forever. If we stop operating that generation, we will give you at least{" "}
        <strong>90 days&apos; notice</strong> and a way to export all your data.
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
          WhatsApp business APIs, GSP/e-invoice connectivity, premium AI quotas, or other products
          we introduce later)
        </li>
        <li>
          <strong>New major versions or successor products</strong> that we clearly announce as a
          new generation. Those may require a new purchase or subscription
        </li>
        <li>Transfer, resale, or sharing of the licence across unrelated organisations</li>
      </ul>
      <p>
        Lifetime purchases are <strong>non-refundable</strong> once access is granted, except where
        Indian law requires a refund or as stated in the Refund Policy for non-delivery of access.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">7. Cloud sync, users and CA portal</h2>
      <p>
        Cloud sync requires an active Business (or valid trial/Lifetime) plan. When it is on, your
        books are stored on Google Cloud (encrypted at rest by Google) so your phone, the web app
        and your CA can see them. A CA you invite gets read-only access until you stop sharing,
        which you can do at any time in Settings. You are responsible for whom you invite.
      </p>
      <p>
        You can add people to your books (Settings &gt; Users). They act for your business: you are
        responsible for what they do in your books, for the access you give them, and for removing
        them when they should no longer have it. Issued bills cannot be deleted by anyone; they are
        cancelled or corrected with a credit or debit note, and every change is kept in the edit
        log.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">8. Your data and your customers&apos; data</h2>
      <p>
        Our <Link href="/privacy/">Privacy Policy</Link> describes what we process, our service
        providers (including Google Cloud in <strong>us-central1</strong>), retention, and your
        rights. For details you enter about your own customers, suppliers or staff, you decide why
        and how they are used (you are the Data Fiduciary under the DPDP Act) and we process them
        only on your behalf to run Argus. You must have a lawful basis to enter that data.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">9. Automated features</h2>
      <p>
        Voice entry, bill scanning, HSN and GST rate suggestions, compliance checks and Ask Argus
        are automated and can be wrong. Review their results before saving, sending or filing.
        Ask Argus sends a short summary of your books to an AI provider only when you use it.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">10. Intellectual property</h2>
      <p>
        Argus software, branding, and documentation remain our property. You retain all rights to
        your business data. You grant us a limited licence to host and process that data solely to
        provide the service to you.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">11. Disclaimers and liability</h2>
      <p>
        The service is provided <strong>as is</strong> and <strong>as available</strong>. We work
        to keep it accurate and available but do not promise it will be error-free or
        uninterrupted. Keep your own exports or backups of records you must retain.
      </p>
      <p>
        To the extent permitted by Indian law, we are not liable for indirect, incidental, special,
        consequential, or punitive damages, tax penalties or interest, filing errors, or lost
        profits. Our total liability for all claims relating to Argus in any twelve-month period is
        limited to the fees you paid us for Argus in that period. Nothing in these Terms limits
        liability for fraud, gross negligence, wilful misconduct, or anything else that cannot be
        limited under applicable law, including the Consumer Protection Act, 2019.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">12. Your responsibility to us</h2>
      <p>
        If someone makes a claim against us because of invoices you issued, data you entered
        without a lawful basis, or your breach of these Terms or the law, you will cover our
        reasonable costs of that claim, to the extent it was caused by you.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">13. Events outside our control</h2>
      <p>
        We are not responsible for delays or failures caused by events beyond our reasonable
        control, such as outages at our cloud, payment or app-store providers, internet or power
        failures, natural disasters, or government action. Your books on your phone keep working
        offline during such outages.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">14. Suspension and termination</h2>
      <p>
        We may suspend or terminate accounts for serious or repeated breach of these Terms, fraud,
        non-payment, or risk to the service. Where reasonable we will tell you first and give you a
        chance to export your data. You may stop using Argus and delete your account at any time
        from Settings or the <Link href="/delete-account/">account deletion page</Link>.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">15. Changes</h2>
      <p>
        We may update these Terms. For material changes we ask you to review and accept the new
        version before you continue; we do not treat silence or continued use as acceptance. If you
        disagree, you can stop using Argus, export your data, and cancel auto-renew.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">16. Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of India, and courts in India have jurisdiction. Please
        contact the Grievance Officer first so we can try to fix the problem. Nothing here limits
        your right to approach a Consumer Commission under the Consumer Protection Act, 2019.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">17. Contact / Grievance</h2>
      <p>
        Grievance Officer: {GRIEVANCE_OFFICER.name}
        <br />
        Email:{" "}
        <a href={`mailto:${GRIEVANCE_OFFICER.email}?subject=Grievance`}>{GRIEVANCE_OFFICER.email}</a>
        {GRIEVANCE_OFFICER.phone ? (
          <>
            <br />
            Phone:{" "}
            <a href={`tel:${GRIEVANCE_OFFICER.phone.replace(/\s/g, "")}`}>{GRIEVANCE_OFFICER.phone}</a>
          </>
        ) : null}
        <br />
        {LEGAL_ENTITY.name}
        {LEGAL_ENTITY.address ? `, ${LEGAL_ENTITY.address}` : ", India"}
        <br />
        We acknowledge grievances within 48 hours and resolve them within 30 days.
      </p>

      <p className="mt-8 text-sm text-slate">
        See also: <Link href="/refund/">Refund Policy</Link> ·{" "}
        <Link href="/privacy/">Privacy Policy</Link>
      </p>
    </LegalLayout>
  );
}

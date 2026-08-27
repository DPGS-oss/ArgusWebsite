import Link from "next/link";
import { LegalLayout } from "@/components/LegalLayout";

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <p className="text-sm text-slate">Last updated: 27 August 2026</p>

      <p>
        <strong>Argus</strong> (website{" "}
        <a href="https://argusinvoicing.com">argusinvoicing.com</a> and the Argus mobile app) is
        operated by <strong>B&amp;L Softwares and Logistics</strong> (&quot;we&quot;, &quot;us&quot;,
        &quot;Data Fiduciary&quot;). This Privacy Notice applies to individuals in India and
        elsewhere who use Argus. It is intended to meet transparency expectations under Indian law,
        including the <strong>Digital Personal Data Protection Act, 2023 (DPDP Act)</strong>, the
        Information Technology Act, 2000, and related rules.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">1. Who this covers</h2>
      <p>
        Argus is a business tool. You must be <strong>at least 18 years old</strong> and authorised
        to bind the business whose records you enter. We do not knowingly collect personal data of
        children under 18. If you believe a minor has created an account, contact us to delete it.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">2. Personal data we process</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Account identifiers: name, email, authentication IDs (Firebase Auth)</li>
        <li>Business profile: shop name, GSTIN, phone, address, bank/UPI details you enter</li>
        <li>Books you create: invoices, parties, purchases, stock, khata, expenses, reports</li>
        <li>Subscription and payment metadata (plan, expiry, Razorpay/Play references — not full card numbers)</li>
        <li>Optional device inputs: camera/barcode, microphone (voice entry), files you import</li>
        <li>Diagnostics and security logs when cloud features are used (IP-derived signals, device labels, error events)</li>
        <li>CA portal: encrypted book shares and invite metadata when you invite an accountant</li>
      </ul>
      <p>
        We do not require Aadhaar, biometrics, or other sensitive categories. Do not enter such data
        into free-text fields.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">3. Purposes</h2>
      <p>We process data to:</p>
      <ul className="list-disc space-y-2 pl-6">
        <li>Provide invoicing, books, GST <em>summaries</em>, sync, CA sharing, and support</li>
        <li>Authenticate you, manage Business/Lifetime/trial entitlements, and prevent fraud/abuse</li>
        <li>Improve reliability and security; respond to legal requests where required under Indian law</li>
      </ul>
      <p>
        Invoice and books data are <strong>local-first</strong> on your device/browser. Cloud sync
        and CA sharing are optional and require your action.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">4. Processors and international transfers</h2>
      <p>
        We use service providers (&quot;Data Processors&quot;) to operate Argus. Current core
        processors include:
      </p>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          <strong>Google Firebase / Google Cloud</strong> — authentication, Firestore database,
          hosting, and Cloud Functions. Production Functions currently run in{" "}
          <strong>us-central1 (United States)</strong>. Your account and synced books may therefore
          be processed and stored on Google infrastructure outside India.
        </li>
        <li>
          <strong>Razorpay</strong> — website subscription payments (India)
        </li>
        <li>
          <strong>Google Play / RevenueCat</strong> — in-app subscription billing where enabled
          (may involve processing outside India)
        </li>
        <li>
          <strong>Resend</strong> (or similar) — transactional email (support, receipts, admin alerts)
        </li>
        <li>
          Optional AI providers (e.g. OpenRouter) — only when you explicitly use Ask Argus; summaries
          are minimised before send
        </li>
      </ul>
      <p>
        By creating an account or enabling cloud sync, you acknowledge these transfers. We do{" "}
        <strong>not</strong> claim that all Argus cloud data resides only in India. We apply
        encryption in transit (HTTPS/TLS) and access controls; processors apply their own security
        programmes.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">5. CA / accountant sharing</h2>
      <p>
        When you invite a CA, books are encrypted on your device (AES-GCM) before upload. We store
        ciphertext and related metadata; the decryption key is intended to travel only in the invite
        link fragment you share. You control who receives the link. Revoke access by creating a new
        invite / stopping shares and asking the CA to stop using the portal.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">6. Retention</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Local data: until you clear it, uninstall, or wipe the browser/device store</li>
        <li>
          Cloud account and synced books: until you delete the account, subject to backup cycles
        </li>
        <li>
          Payment, tax, fraud, and dispute records: typically up to <strong>7 years</strong> where
          needed for Indian tax, accounting, or legal compliance
        </li>
        <li>Security / rate-limit logs: shorter operational windows</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold text-ink">7. Your rights (DPDP)</h2>
      <p>Subject to applicable law, you may:</p>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          <strong>Access</strong> a summary of personal data we hold about you
        </li>
        <li>
          <strong>Correct</strong> inaccurate account or profile data
        </li>
        <li>
          <strong>Erase</strong> account data (see deletion below), subject to legal retention
        </li>
        <li>
          <strong>Withdraw consent</strong> for optional processing (e.g. turn off cloud sync; stop
          using Ask Argus)
        </li>
        <li>
          <strong>Nominate</strong> another individual to exercise rights on your behalf in the
          event of death or incapacity, by emailing the Grievance Officer with clear instructions
          and proof as we reasonably require
        </li>
        <li>
          <strong>Grievance redressal</strong> — contact details below; we aim to respond within{" "}
          <strong>30 days</strong>
        </li>
      </ul>
      <p>
        Export: use in-app/web Export. Delete:{" "}
        <Link href="/delete-account/">account deletion page</Link> or email{" "}
        <a href="mailto:support@argusinvoicing.com?subject=Request%20Account%20Deletion">
          support@argusinvoicing.com
        </a>
        . We process deletion requests within 30 days where feasible.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">8. Security</h2>
      <p>
        We use HTTPS, authentication, server-side entitlement checks for cloud sync, rate limits,
        and encrypted CA shares. No method is perfect — keep strong passwords and your own backups.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">9. GST / government portals</h2>
      <p>
        Argus helps you prepare invoices and GST-style summaries. It is{" "}
        <strong>not</strong> a GST Suvidha Provider (GSP) and does not file returns or generate
        e-invoice IRNs / e-way bills on the government network unless we later announce a licensed
        integration. You remain responsible for filings on the GST portal.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">10. Grievance Officer</h2>
      <p>
        <strong>Designation:</strong> Grievance Officer
        <br />
        <strong>Organisation:</strong> B&amp;L Softwares and Logistics
        <br />
        <strong>Email:</strong>{" "}
        <a href="mailto:support@argusinvoicing.com?subject=DPDP%20Grievance">
          support@argusinvoicing.com
        </a>
        <br />
        <strong>Country:</strong> India
        <br />
        <strong>Postal address:</strong> Available on written request to the Grievance Officer
        (email above) until published on this page.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">11. Changes</h2>
      <p>
        We may update this notice. The &quot;Last updated&quot; date will change. Material updates
        may be notified in-product or by email. Continued use after the update means you accept the
        revised notice.
      </p>

      <p className="mt-8 text-sm text-slate">
        Related: <Link href="/terms/">Terms of Service</Link> ·{" "}
        <Link href="/refund/">Refund Policy</Link>
      </p>
    </LegalLayout>
  );
}

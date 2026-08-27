import Link from "next/link";
import { LegalLayout } from "@/components/LegalLayout";

export default function RefundPage() {
  return (
    <LegalLayout title="Refund Policy">
      <p className="text-sm text-slate">Last updated: 27 August 2026</p>

      <p>
        This Refund Policy applies to Argus purchases from{" "}
        <strong>B&amp;L Softwares and Logistics</strong> via the website (Razorpay) or, where
        noted, Google Play. It should be read with our{" "}
        <Link href="/terms/">Terms of Service</Link>.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">1. Cancellation is not a refund</h2>
      <p>
        Cancelling a monthly or yearly subscription stops <em>future</em> renewals. Amounts already
        paid for the current billing period are <strong>not refunded</strong>, and we do not
        prorate unused days after cancellation, except where mandatory Indian law requires
        otherwise.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">2. Lifetime purchases</h2>
      <p>
        Lifetime Business licences are <strong>one-time and non-refundable</strong> once access has
        been granted, except where mandatory law requires a refund or we failed to deliver access
        after a confirmed successful payment. Lifetime scope is defined in the Terms (current
        product generation; add-ons and major overhauls excluded; maximum 25 years or earlier
        discontinuation of that generation).
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">3. Limited goodwill window (website)</h2>
      <p>
        For website (Razorpay) subscriptions, you may email us within{" "}
        <strong>7 days</strong> of first purchase if you could not access Business features due to
        a verified technical fault on our side and the account was not used materially for
        production invoices. Approvals are case-by-case and not guaranteed.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">4. Google Play</h2>
      <p>
        In-app purchases follow Google Play&apos;s refund rules. Request refunds through the Play
        Store where applicable; we cannot override Play&apos;s process.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-ink">5. Trials</h2>
      <p>Free trials have no charge and no refund.</p>

      <h2 className="mt-8 text-xl font-semibold text-ink">6. How to request</h2>
      <p>
        Email{" "}
        <a href="mailto:support@argusinvoicing.com?subject=Refund%20Request">
          support@argusinvoicing.com
        </a>{" "}
        with your account email, payment reference / order ID, and reason. We aim to respond within
        7 business days.
      </p>
    </LegalLayout>
  );
}

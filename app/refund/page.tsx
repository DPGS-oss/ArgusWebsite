import { LegalLayout } from "@/components/LegalLayout";

export default function RefundPage() {
  return (
    <LegalLayout title="Refund Policy">
      <p>
        Subscription refunds are handled on a case-by-case basis within 7 days of
        purchase if the service was not used materially.
      </p>
      <p>
        For Google Play purchases, refund requests must be submitted through the
        Play Store where applicable.
      </p>
      <p>
        Email{" "}
        <a href="mailto:support@argusinvoicing.com">support@argusinvoicing.com</a>{" "}
        with your account email and payment reference.
      </p>
    </LegalLayout>
  );
}

import { LegalLayout } from "@/components/LegalLayout";

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <p>
        By using Argus you agree to use the app for lawful business invoicing and
        GST compliance activities.
      </p>
      <p>
        Subscriptions are billed according to the plan selected in the app or
        website. You are responsible for the accuracy of GST data you file with
        government portals.
      </p>
      <p>
        The service is provided as-is. Contact{" "}
        <a href="mailto:support@argusinvoicing.com">support@argusinvoicing.com</a>{" "}
        for support.
      </p>
    </LegalLayout>
  );
}

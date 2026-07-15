import Link from "next/link";
import { LegalLayout } from "@/components/LegalLayout";

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>
        <strong>Argus GST Billing</strong> is operated by B&amp;L Softwares and Logistics
        (&quot;we&quot;, &quot;us&quot;). This policy explains how we handle information when you use
        our mobile app and website.
      </p>

      <h2 className="mt-6 text-xl text-starlight">Information we collect</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Account email and authentication identifiers (Firebase Auth)</li>
        <li>Business profile: name, GSTIN, phone, address</li>
        <li>Invoices, customers, purchases, inventory, and GST records you enter</li>
        <li>Optional camera, microphone, and file inputs for barcode scan and voice invoice entry</li>
        <li>App diagnostics, crash reports, and security logs when cloud features are enabled</li>
      </ul>

      <h2 className="mt-6 text-xl text-starlight">How we use data</h2>
      <p>
        Data is used to provide invoicing, sync, subscription management, support, fraud
        prevention, and product improvement. Invoice data is stored locally on your device first;
        cloud sync is optional.
      </p>

      <h2 className="mt-6 text-xl text-starlight">Third-party services</h2>
      <p>
        We use Google Firebase (authentication, Firestore), payment processors (Razorpay on web;
        Google Play when in-app billing is enabled), and hosting providers. These processors handle
        data according to their own policies.
      </p>

      <h2 className="mt-6 text-xl text-starlight">Data retention &amp; deletion</h2>
      <p>
        You may request export or deletion of your account and all associated data by visiting{" "}
        <Link href="/delete-account" className="text-mercury-blue underline">our account deletion page</Link>{" "}
        or using the &quot;Request Account &amp; Data Deletion&quot; link in your profile settings.
        You can also email{" "}
        <a href="mailto:support@argusinvoicing.com?subject=Request%20Account%20Deletion">support@argusinvoicing.com</a>.
        We will process your request within 30 days. We may retain records required for tax,
        fraud prevention, or legal compliance.
      </p>

      <h2 className="mt-6 text-xl text-starlight">Security</h2>
      <p>
        We use encryption in transit (HTTPS), encrypted local storage, and optional end-to-end
        encrypted sync for accountant sharing. No system is 100% secure; keep device backups and
        strong passwords.
      </p>

      <h2 className="mt-6 text-xl text-starlight">Children</h2>
      <p>Argus is not directed at children under 13. We do not knowingly collect children&apos;s data.</p>

      <h2 className="mt-6 text-xl text-starlight">Contact</h2>
      <p>
        Grievance / privacy contact:{" "}
        <a href="mailto:support@argusinvoicing.com">support@argusinvoicing.com</a>
        <br />
        B&amp;L Softwares and Logistics
      </p>
      <p className="text-sm text-silver">Last updated: July 2026</p>
    </LegalLayout>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export const metadata: Metadata = {
  title: "GST Billing Software for Indian Shops",
  description:
    "Argus is GST billing and accounting software for Indian shops — invoices, inventory, khata, and GSTR summaries. Free on Android (5 invoices/month); 14-day Business trial on web.",
  alternates: { canonical: "/gst-billing-software-india/" },
  keywords: [
    "GST billing software India",
    "GST invoicing software",
    "accounting app for shops",
    "khata billing GST",
  ],
};

export default function GstBillingSoftwarePage() {
  return (
    <main className="bg-white">
      <div className="container-page py-16 md:py-24">
        <BrandLogo size={32} />
        <p className="mt-8 text-xs font-semibold tracking-widest text-brand-violet uppercase">
          GST billing software India
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-ink md:text-5xl">
          GST billing and books for Indian shops
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate">
          Argus is more than invoices — sales, purchases, stock, dues, and filing-ready GST
          views in one workspace. Start free on Android (5 invoices/month). Unlock the full
          web suite with a 14-day Business trial or subscribe from ₹500/month.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/app/" className="btn-primary">
            Try the web app
          </Link>
          <a href="/#pricing" className="btn-outline">
            See pricing
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=com.getargus.billing"
            className="btn-secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            Get Android app
          </a>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {[
            {
              title: "Bill GST-compliant",
              text: "Tax invoices with CGST/SGST/IGST, HSN, and round-off — ready for everyday B2B and B2C.",
            },
            {
              title: "Keep full books",
              text: "Purchases, inventory, expenses, credit notes, and khata stay linked to the same parties.",
            },
            {
              title: "Share with your CA",
              text: "Invite your accountant to a free encrypted read-only portal. You keep control of billing.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-card border border-bone bg-mist p-6">
              <h2 className="mb-2 text-xl font-bold text-ink">{item.title}</h2>
              <p className="text-sm text-slate">{item.text}</p>
            </div>
          ))}
        </div>

        <p className="mt-12 text-sm text-slate">
          Looking for GSTR-1 help? See our{" "}
          <Link href="/gstr-1-filing-tool/" className="text-brand-violet underline">
            GSTR-1 filing tool
          </Link>{" "}
          overview. Web works best in Chrome or Edge.
        </p>
        <p className="mt-6">
          <Link href="/" className="text-sm text-slate hover:text-ink">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export const metadata: Metadata = {
  title: "GSTR-1 Summary Tool for Indian Businesses",
  description:
    "Turn daily GST invoices into GSTR-1 style summaries with Argus. Billing, books, and filing-ready views for Indian SMEs — final submission stays on the GST portal.",
  alternates: { canonical: "/gstr-1-filing-tool/" },
  keywords: [
    "GSTR-1 summary tool",
    "GSTR-1 software India",
    "GST return summary",
    "GST billing GSTR",
  ],
};

export default function Gstr1FilingToolPage() {
  return (
    <main className="bg-white">
      <div className="container-page py-16 md:py-24">
        <BrandLogo size={32} />
        <p className="mt-8 text-xs font-semibold tracking-widest text-brand-violet uppercase">
          GSTR-1 summaries
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-ink md:text-5xl">
          GSTR-1 style summaries from the invoices you already create
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate">
          Argus keeps outward supplies organised as you bill — so month-end is review, not
          rebuilding spreadsheets. Pair with GSTR-2B / 3B style views and a CA portal when you
          need help filing.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/app/" className="btn-primary">
            Open Argus Web
          </Link>
          <Link href="/gst-billing-software-india/" className="btn-outline">
            GST billing software
          </Link>
          <a href="/#pricing" className="btn-secondary">
            Start free trial
          </a>
        </div>

        <ol className="mt-16 max-w-2xl space-y-6">
          {[
            {
              step: "1",
              title: "Invoice as usual",
              text: "Create GST-compliant invoices with HSN and tax split. Stock and party balances update with you.",
            },
            {
              step: "2",
              title: "Open GST summaries",
              text: "Business unlocks GSTR-1, 2B, and 3B style views built from your books — not a separate data entry job.",
            },
            {
              step: "3",
              title: "File with confidence",
              text: "Export or share an encrypted CA invite so your accountant reviews the same numbers you see.",
            },
          ].map((item) => (
            <li key={item.step} className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-violet text-sm font-bold text-white">
                {item.step}
              </span>
              <div>
                <h2 className="text-xl font-bold text-ink">{item.title}</h2>
                <p className="mt-1 text-sm text-slate">{item.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-12 text-sm text-slate">
          Argus prepares filing-ready summaries from your books. Final submission stays on the
          government GST portal (or your GSP) as required.
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

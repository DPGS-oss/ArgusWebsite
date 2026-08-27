import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { Footer } from "@/components/Footer";

const SITE_URL = "https://argusinvoicing.com";

export const metadata: Metadata = {
  title: "Argus GST Billing",
  description:
    "Official Argus GST Billing site. GST invoicing, khata, inventory, and GSTR reports for Indian businesses.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

const INDEX_LINKS = [
  { href: "/", label: "Home" },
  { href: "/guide/", label: "User Guide" },
  { href: "/privacy/", label: "Privacy Policy" },
  { href: "/terms/", label: "Terms of Service" },
  { href: "/refund/", label: "Refund Policy" },
  { href: "/delete-account/", label: "Account deletion" },
];

export default function RedirectPage() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.location.replace(${JSON.stringify(`${SITE_URL}/`)});`,
        }}
      />
      <main className="flex min-h-screen flex-col bg-white">
        <div className="container-page flex flex-1 flex-col items-center justify-center py-24 text-center">
          <div className="mb-10">
            <BrandLogo size={32} priority />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">
            Continue to Argus
          </h1>
          <p className="mt-4 max-w-md text-lg text-slate">
            You are being sent to the official Argus GST Billing website for
            Google indexing and search results.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/" className="btn-primary">
              Go to homepage
            </Link>
            <Link href="/guide/" className="btn-outline">
              User Guide
            </Link>
          </div>
          <nav aria-label="Indexable pages" className="mt-12 max-w-md text-sm text-slate">
            <p className="mb-3 font-semibold text-ink">Pages to index</p>
            <ul className="flex flex-col gap-2">
              {INDEX_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-ink">
                    {`${SITE_URL}${link.href === "/" ? "/" : link.href}`}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </main>
      <Footer />
    </>
  );
}

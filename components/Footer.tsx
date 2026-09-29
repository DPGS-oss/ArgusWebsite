import Link from "next/link";
import { BrandLogo } from "./BrandLogo";

const columns: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Launch web app", href: "/app/" },
      { label: "CA portal", href: "/ca/" },
      { label: "User guide", href: "/guide/" },
    ],
  },
  {
    title: "GST",
    links: [
      { label: "GSTR summaries", href: "/gstr/" },
      { label: "GSTR-1 filing tool", href: "/gstr-1-filing-tool/" },
      { label: "GST billing software", href: "/gst-billing-software-india/" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/#about" },
      { label: "Contact", href: "/#contact" },
      { label: "Privacy Policy", href: "/privacy/" },
      { label: "Terms of Service", href: "/terms/" },
      { label: "Refund Policy", href: "/refund/" },
      { label: "Request data deletion", href: "/delete-account/" },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-bone bg-white pt-16">
      <div className="container-page">
        <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <BrandLogo size={32} showWordmark wordmarkClassName="font-display text-lg font-bold text-ink" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate">
              Accounting, GST, and collections for Indian shops — on your phone and in the browser.
            </p>
            <a
              href="mailto:support@argusinvoicing.com"
              className="mt-4 inline-block text-sm font-semibold text-brand-violet hover:underline"
            >
              support@argusinvoicing.com
            </a>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h2 className="mb-4 text-sm font-bold tracking-normal text-ink">{col.title}</h2>
              <ul className="space-y-2.5 text-sm text-slate">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="hover:text-ink">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-bone py-6 text-sm text-ash md:flex-row">
          <p>© {year} B&amp;L Softwares and Logistics. All rights reserved.</p>
          <p>Made in India</p>
        </div>
      </div>
    </footer>
  );
}

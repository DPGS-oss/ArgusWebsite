import Link from "next/link";
import { BrandLogo } from "./BrandLogo";
import { GRIEVANCE_OFFICER, LEGAL_ENTITY } from "@/lib/legal";

const columns: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "GST 2.0", href: "/gstr/" },
      { label: "Pricing", href: "/#pricing" },
      { label: "FAQ", href: "/#faq" },
      { label: "Web app", href: "/app/" },
      { label: "CA portal", href: "/ca/" },
      { label: "User guide", href: "/guide/" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/#about" },
      { label: "Contact", href: "/#contact" },
      { label: "GST billing software", href: "/gst-billing-software-india/" },
      { label: "GSTR-1 filing tool", href: "/gstr-1-filing-tool/" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", href: "/terms/" },
      { label: "Privacy", href: "/privacy/" },
      { label: "Refund Policy", href: "/refund/" },
      { label: "Delete my data", href: "/delete-account/" },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-navy-deep pt-16 text-white/70">
      <div className="container-page">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.6fr_repeat(4,1fr)]">
          <div>
            <BrandLogo size={32} showWordmark wordmarkClassName="font-display text-lg font-bold text-white" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed">
              Accounting made clear — one workspace for billing, stock, dues, and GST, built for
              Indian shops.
            </p>
            <a
              href="mailto:support@argusinvoicing.com"
              className="mt-4 inline-block text-sm font-semibold text-emerald-300 hover:underline"
            >
              support@argusinvoicing.com
            </a>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h2 className="mb-4 text-sm font-bold tracking-normal text-white">{col.title}</h2>
              <ul className="space-y-2.5 text-sm">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <h2 className="mb-4 text-sm font-bold tracking-normal text-white">Company entity</h2>
            <p className="text-sm leading-relaxed">{LEGAL_ENTITY.name}</p>
            <p className="mt-3 text-sm leading-relaxed">
              Grievance Officer:
              <br />
              {GRIEVANCE_OFFICER.name}
              {GRIEVANCE_OFFICER.phone ? (
                <>
                  <br />
                  <a href={`tel:${GRIEVANCE_OFFICER.phone.replace(/\s/g, "")}`} className="hover:text-white">
                    {GRIEVANCE_OFFICER.phone}
                  </a>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-white/10 py-6 text-sm text-white/50 md:flex-row">
          <p>© {year} {LEGAL_ENTITY.name}. All rights reserved.</p>
          <p>Made in India</p>
        </div>
      </div>
    </footer>
  );
}

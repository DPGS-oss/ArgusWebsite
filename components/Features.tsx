import {
  BarChart3,
  BookOpen,
  FileText,
  Package,
  ShieldCheck,
  Users,
  Wallet,
  Workflow,
} from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "./Reveal";

type Feature = {
  icon: typeof BookOpen;
  title: string;
  description: string;
  span?: string;
  accent?: boolean;
};

const features: Feature[] = [
  {
    icon: BarChart3,
    title: "Filing-ready GST views",
    description:
      "Daily invoices roll up into GSTR-1, GSTR-2B, and GSTR-3B style summaries — month-end becomes a review, not a reconstruction. Export GSTN-format JSON for your CA.",
    span: "lg:col-span-2",
    accent: true,
  },
  {
    icon: ShieldCheck,
    title: "GST 2.0 checklist",
    description:
      "Flags old 12% / 28% rates on new bills, short HSN codes, duplicate numbers, and missing place of supply before you file.",
  },
  {
    icon: FileText,
    title: "GST-compliant billing",
    description: "Tax invoices with auto CGST/SGST/IGST, HSN, ship-to, and round-off for everyday B2B and B2C.",
  },
  {
    icon: BookOpen,
    title: "Complete shop books",
    description:
      "Sales, purchases, expenses, credit and debit notes, and challans in one ledger — not scattered across notebooks.",
  },
  {
    icon: Package,
    title: "Inventory that follows sales",
    description: "Stock moves when you bill. See what's running low before a customer walks out empty-handed.",
  },
  {
    icon: Wallet,
    title: "Khata, payroll & collections",
    description: "Track who owes you, record UPI and cash payments, and log salaries straight into your books.",
  },
  {
    icon: Users,
    title: "CA collaboration",
    description: "Invite your accountant to a free, encrypted read-only portal. They see books; you keep control.",
  },
  {
    icon: Workflow,
    title: "Quotes to cash",
    description:
      "Quotations, recurring invoices, delivery challans, and UPI collect links — one path from estimate to paid.",
    span: "lg:col-span-2",
  },
];

export function Features() {
  return (
    <section id="features" className="relative bg-white py-24 md:py-32">
      <div className="container-page">
        <Reveal>
          <div className="section-header">
            <span className="eyebrow">Features</span>
            <h2>Everything a shop needs</h2>
            <p>Argus is a full accounting workspace — billing is just the first step.</p>
          </div>
        </Reveal>
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.06}>
          {features.map(({ icon: Icon, title, description, span, accent }) => (
            <StaggerItem
              key={title}
              y={24}
              className={`${span ?? ""} ${
                accent
                  ? "relative overflow-hidden rounded-card-lg bg-onyx p-7 text-white shadow-glow"
                  : "card p-7"
              }`}
            >
              {accent ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(closest-side,rgba(102,71,240,0.6),transparent)] blur-2xl"
                />
              ) : null}
              <div
                className={`relative mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl ${
                  accent
                    ? "bg-white/10 text-white ring-1 ring-white/15"
                    : "bg-gradient-to-br from-brand-violet/15 to-signal-blue/15 text-brand-violet"
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <h3 className={`relative mb-2 text-lg font-bold ${accent ? "text-white" : "text-ink"}`}>{title}</h3>
              <p className={`relative text-sm leading-relaxed ${accent ? "text-white/70" : "text-slate"}`}>
                {description}
              </p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

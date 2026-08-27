import {
  BarChart3,
  BookOpen,
  FileText,
  IndianRupee,
  Package,
  Users,
  Wallet,
  Workflow,
} from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "./Reveal";

const features = [
  {
    icon: BookOpen,
    title: "Complete shop books",
    description:
      "Sales, purchases, expenses, credit notes, and challans stay in one ledger — not scattered across notebooks and WhatsApp.",
  },
  {
    icon: FileText,
    title: "GST-compliant billing",
    description:
      "Professional tax invoices with auto CGST/SGST/IGST, HSN, and round-off. Ready for everyday B2B and B2C work.",
  },
  {
    icon: BarChart3,
    title: "Filing-ready GST views",
    description:
      "Turn daily invoices into GSTR-1, GSTR-2B, and GSTR-3B style summaries so month-end is review, not reconstruction.",
  },
  {
    icon: Package,
    title: "Inventory that follows sales",
    description:
      "Stock moves when you bill. Know what is low before a customer walks out empty-handed.",
  },
  {
    icon: Wallet,
    title: "Khata & collections",
    description:
      "Track who owes you, record payments, and keep party balances clear without a separate notebook.",
  },
  {
    icon: Users,
    title: "CA collaboration",
    description:
      "Invite your accountant to a free read-only portal. They see books; you keep control of billing.",
  },
  {
    icon: Workflow,
    title: "Quotes to cash",
    description:
      "Quotations, recurring invoices, delivery challans, and UPI collection links — one path from estimate to paid.",
  },
  {
    icon: IndianRupee,
    title: "Fair pricing that scales",
    description:
      "Start free on the phone. Unlock the full web suite from ₹500/month — no ads, no surprise seats.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 md:py-28">
      <div className="container-page">
        <Reveal>
          <div className="section-header">
            <h2>Everything a shop needs</h2>
            <p>
              Argus is a full accounting workspace — billing is just the first step
            </p>
          </div>
        </Reveal>
        <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" stagger={0.08}>
          {features.map(({ icon: Icon, title, description }) => (
            <StaggerItem
              key={title}
              className="group rounded-card border border-bone bg-mist p-6 transition hover:border-brand-violet/30 hover:bg-plaster"
            >
              <div className="mb-4 inline-flex rounded-full bg-brand-violet/10 p-3 text-brand-violet">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-ink">{title}</h3>
              <p className="text-sm leading-relaxed text-slate">{description}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

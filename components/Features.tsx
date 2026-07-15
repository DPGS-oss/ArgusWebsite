import {
  BarChart3,
  Bot,
  FileText,
  IndianRupee,
  Lock,
  MessageCircle,
  Mic,
  Smartphone,
} from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "./Reveal";

const features = [
  {
    icon: Smartphone,
    title: "100% Offline-First",
    description:
      "Works without internet. Create invoices anywhere, anytime. Sync when you're online.",
  },
  {
    icon: Lock,
    title: "End-to-End Encryption",
    description:
      "Share data securely with your accountant using military-grade encryption.",
  },
  {
    icon: FileText,
    title: "GSTR Reports",
    description: "Generate GSTR-1, GSTR-2B, GSTR-3B, and GSTR-4 reports instantly.",
  },
  {
    icon: Bot,
    title: "AI HSN Suggestions",
    description: "Auto-suggest HSN codes using AI. Save time and ensure compliance.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp Integration",
    description: "Share invoices via WhatsApp deep links (Business API coming soon).",
  },
  {
    icon: Mic,
    title: "Voice Input",
    description: "Create invoices using voice. Faster than typing, hands-free operation.",
  },
  {
    icon: BarChart3,
    title: "Multi-GST Support",
    description: "Manage multiple GSTINs for your businesses. Up to 5 per account.",
  },
  {
    icon: IndianRupee,
    title: "Affordable Pricing",
    description: "One-time purchase or subscription. No hidden fees, no ads.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 md:py-28">
      <div className="container-page">
        <Reveal>
          <div className="section-header">
            <h2>Powerful Features</h2>
            <p>Everything you need to manage your billing efficiently</p>
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

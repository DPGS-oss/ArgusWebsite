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
        <div className="section-header">
          <h2>Powerful Features</h2>
          <p>Everything you need to manage your billing efficiently</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group rounded-lg border border-lead/20 bg-midnight p-6 transition hover:border-mercury-blue/40 hover:bg-graphite"
            >
              <div className="mb-4 inline-flex rounded-full bg-mercury-blue/15 p-3 text-mercury-blue">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-xl text-starlight">{title}</h3>
              <p className="text-sm leading-relaxed text-silver">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

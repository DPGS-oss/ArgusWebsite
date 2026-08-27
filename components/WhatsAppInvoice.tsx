import { IndianRupee, MessageCircle } from "lucide-react";
import { Reveal } from "./Reveal";

export function WhatsAppInvoice() {
  return (
    <section id="whatsapp" className="bg-mist py-20 md:py-28">
      <div className="container-page">
        <Reveal>
          <div className="section-header">
            <h2>Send on WhatsApp. Collect on UPI.</h2>
            <p>
              The invoice screen leads with your shop&apos;s WhatsApp and a{" "}
              <code className="rounded bg-bone px-1.5 py-0.5 text-sm">upi://pay</code> collect
              link. No WhatsApp Business API. No payment gateway.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1} y={40}>
          <div className="mx-auto max-w-3xl overflow-hidden rounded-card border border-bone bg-white shadow-subtle">
            <div className="border-b border-bone px-5 py-4">
              <p className="text-xs uppercase tracking-wide text-slate">Invoice INV-2026-0001</p>
              <p className="text-lg font-bold text-ink">Sharma Traders · ₹1,180.00</p>
            </div>
            <div className="flex flex-wrap gap-3 px-5 py-5">
              <a
                href="/app/"
                className="inline-flex items-center gap-2 rounded-full bg-green-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-green-700"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
              <a
                href="/app/"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-violet"
              >
                <IndianRupee className="h-4 w-4" />
                Collect UPI
              </a>
            </div>
            <p className="border-t border-bone bg-plaster px-5 py-3 font-mono text-xs text-slate">
              upi://pay?pa=shop@okaxis&amp;am=1180.00&amp;tn=INV-2026-0001&amp;cu=INR
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

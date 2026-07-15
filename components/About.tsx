import { ShieldCheck, Target, Zap } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "./Reveal";

export function About() {
  return (
    <section id="about" className="py-20 md:py-28">
      <div className="container-page grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <h2 className="mb-6 text-4xl font-bold tracking-tightest text-ink md:text-5xl">
            About B&amp;L Softwares and Logistics
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="text-slate lg:text-right">
            Building tools for Indian businesses since 2024.
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <div>
            <p className="mb-4 text-slate">
              We&apos;re a technology company focused on building simple, powerful tools for
              Indian businesses. Our mission is to make GST compliance easy and affordable
              for everyone.
            </p>
            <p className="mb-8 text-slate">
              Founded with the belief that business software should be accessible to all,
              we&apos;ve built Argus to address the real pain points of Indian shopkeepers,
              retailers, and small business owners.
            </p>
            <Stagger className="grid gap-6 sm:grid-cols-3" stagger={0.1}>
              {[
                { icon: Target, title: "Simplicity First", text: "No accounting knowledge needed" },
                { icon: ShieldCheck, title: "Privacy Focused", text: "Your data stays yours" },
                { icon: Zap, title: "Reliable", text: "Works when you need it" },
              ].map(({ icon: Icon, title, text }) => (
                <StaggerItem key={title}>
                  <Icon className="mb-2 h-6 w-6 text-brand-violet" />
                  <h4 className="mb-1 font-bold text-ink">{title}</h4>
                  <p className="text-sm text-slate">{text}</p>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </Reveal>
        <Reveal delay={0.2} scale={0.95}>
          <div className="flex min-h-[280px] items-center justify-center rounded-card border border-bone bg-mist">
            <div className="text-center">
              <div className="mb-2 text-5xl">👥</div>
              <p className="text-slate">Our Team</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

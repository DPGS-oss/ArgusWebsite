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
            Building accounting tools for Indian businesses since 2024.
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <div>
            <p className="mb-4 text-slate">
              We build software that fits how Indian shops actually run — billing,
              stock, dues, and GST — without forcing you into a heavy desktop suite
              or a maze of add-ons.
            </p>
            <p className="mb-8 text-slate">
              Argus is designed for shopkeepers, distributors, and small teams who
              need clear books and filing-ready numbers, with a path that starts
              free on the phone and grows into a full web workspace when you are ready.
            </p>
            <Stagger className="grid gap-6 sm:grid-cols-3" stagger={0.1}>
              {[
                { icon: Target, title: "Clarity first", text: "Books you can explain to your CA" },
                { icon: ShieldCheck, title: "Your data, your control", text: "Cloud sync when you want it; folder backup on web" },
                { icon: Zap, title: "Built for speed", text: "Bill fast, stay compliant" },
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
          <div className="flex min-h-[280px] flex-col items-center justify-center rounded-card border border-bone bg-mist px-8 text-center">
            <p className="mb-2 text-sm font-semibold tracking-wide text-brand-violet uppercase">
              Our focus
            </p>
            <p className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
              One workspace for books, GST, and collections
            </p>
            <p className="mt-4 max-w-sm text-sm text-slate">
              Less paper. Fewer tools. Same login on Android and the web.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

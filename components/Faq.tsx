import { Plus } from "lucide-react";
import { HOME_FAQ } from "@/lib/faq";
import { Reveal } from "./Reveal";

export function Faq() {
  return (
    <section id="faq" className="py-24 md:py-32">
      <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.6fr]">
        <Reveal>
          <div className="lg:sticky lg:top-28">
            <span className="eyebrow">FAQ</span>
            <h2 className="mb-4 text-4xl font-bold tracking-tightest text-ink md:text-5xl">
              Questions, answered
            </h2>
            <p className="text-lg text-slate">
              Can&apos;t find what you need?{" "}
              <a href="#contact" className="font-semibold text-brand-violet hover:underline">
                Talk to us
              </a>
              .
            </p>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="divide-y divide-bone rounded-card-lg border border-bone bg-white">
            {HOME_FAQ.map(({ q, a }) => (
              <details key={q} className="group px-6 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left font-semibold text-ink">
                  {q}
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-bone text-slate transition group-open:rotate-45 group-open:border-brand-violet/40 group-open:text-brand-violet">
                    <Plus className="h-4 w-4" />
                  </span>
                </summary>
                <p className="-mt-1 pb-5 pr-10 text-sm leading-relaxed text-slate">{a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

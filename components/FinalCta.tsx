import { ArrowRight } from "lucide-react";
import { Reveal } from "./Reveal";

export function FinalCta() {
  return (
    <section className="px-4 pb-24 md:pb-32">
      <Reveal>
        <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[28px] bg-onyx px-6 py-16 text-center text-white md:py-20">
          <div
            aria-hidden
            className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 left-1/2 h-80 w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(102,71,240,0.6),transparent)] blur-3xl"
          />
          <h2 className="relative mx-auto max-w-2xl text-4xl font-bold tracking-tightest md:text-5xl">
            Close this month&apos;s GST with confidence
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-white/70">
            Try the full Business suite free for 14 days. No card required.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="/app/"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-ink hover:bg-white/90"
            >
              Start free trial
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </a>
            <a
              href="#pricing"
              className="inline-flex items-center rounded-full border border-white/20 px-7 py-3.5 text-sm font-semibold text-white hover:border-white/40 hover:bg-white/5"
            >
              Compare plans
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

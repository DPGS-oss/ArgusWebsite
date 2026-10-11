import { ArrowRight } from "lucide-react";
import { Reveal } from "./Reveal";
import { AnimatedHeading } from "./AnimatedHeading";

export function FinalCta() {
  return (
    <section className="relative isolate overflow-hidden bg-navy py-20 text-white md:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -bottom-40 -left-32 h-[460px] w-[460px] rounded-full bg-[radial-gradient(closest-side,rgba(20,184,166,0.35),transparent)] blur-2xl" />
        <div className="absolute -right-24 -top-32 h-[420px] w-[420px] animate-aurora rounded-full bg-[radial-gradient(closest-side,rgba(244,114,182,0.18),transparent)] blur-2xl" />
      </div>
      <Reveal>
        <div className="container-page text-center">
          <AnimatedHeading
            className="mx-auto max-w-2xl text-4xl font-bold tracking-tightest md:text-5xl"
            text="Close this month’s GST with confidence"
          />
          <p className="mx-auto mt-4 max-w-xl text-white/70">
            Try the full Business suite free for 14 days. No card required.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <a href="/app/" className="btn-primary group px-7 py-3.5 text-base">
              Start free trial
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </a>
            <a
              href="#pricing"
              className="inline-flex items-center rounded-xl border border-white/20 px-7 py-3.5 text-base font-semibold text-white hover:border-white/40 hover:bg-white/5"
            >
              Compare plans
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

"use client";

import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, CheckCircle2, FileText, ShieldCheck } from "lucide-react";
import { ShinyText } from "./ShinyText";
import { HeroDemo } from "./HeroDemo";

const trust = ["GST 2.0 rates built in", "Free CA access", "Same login on Android & web"];

export function Hero() {
  const reduce = useReducedMotion();
  const mouseX = useMotionValue(-1000);
  const mouseY = useMotionValue(-1000);
  const sx = useSpring(mouseX, { stiffness: 120, damping: 20 });
  const sy = useSpring(mouseY, { stiffness: 120, damping: 20 });
  const spotlight = useMotionTemplate`radial-gradient(420px circle at ${sx}px ${sy}px, rgba(143,184,255,0.12), transparent 70%)`;
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <section
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mouseX.set(e.clientX - r.left);
        mouseY.set(e.clientY - r.top);
      }}
      className="relative isolate overflow-hidden bg-onyx pb-20 pt-32 text-white md:pb-28 md:pt-40"
    >
      {!reduce ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: spotlight }}
        />
      ) : null}
      {/* Aurora backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
        <div className="absolute -top-40 left-1/2 h-[640px] w-[1100px] -translate-x-1/2 animate-aurora rounded-full bg-[radial-gradient(closest-side,rgba(102,71,240,0.55),transparent)] blur-3xl" />
        <div className="absolute right-[-10%] top-40 h-[420px] w-[520px] animate-aurora rounded-full bg-[radial-gradient(closest-side,rgba(0,145,255,0.35),transparent)] blur-3xl [animation-delay:-6s]" />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-b from-transparent to-onyx" />
      </div>

      <div className="container-page flex flex-col items-center text-center">
        <motion.a
          href="#features"
          {...rise(0)}
          className="group mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pl-1 pr-3 text-xs text-white/80 backdrop-blur hover:border-white/30"
        >
          <span className="rounded-full bg-gradient-to-r from-brand-violet to-signal-blue px-2 py-0.5 font-semibold text-white">
            New
          </span>
          GST 2.0 checklist for 0 / 5 / 18 / 40% rates
          <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
        </motion.a>

        <motion.h1
          {...rise(0.08)}
          className="max-w-4xl font-display text-5xl font-semibold leading-[0.95] tracking-tightest md:text-7xl xl:text-[5.5rem]"
        >
          Accounting{" "}
          <ShinyText text="made clear." baseColor="#8fb8ff" shineColor="#ffffff" duration={4} />
        </motion.h1>

        <motion.p {...rise(0.16)} className="mt-6 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
          Bill customers, track stock and dues, prepare GSTR summaries, and share books with your CA
          — one workspace for Indian shops, on your phone and in the browser.
        </motion.p>

        <motion.div {...rise(0.24)} className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/app/"
            className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-ink shadow-glow hover:bg-white/90 md:text-base"
          >
            Start 14-day free trial
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </a>
          <a
            href="#workflow"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur hover:border-white/40 hover:bg-white/10 md:text-base"
          >
            See how it works
          </a>
        </motion.div>

        <motion.ul {...rise(0.32)} className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/60">
          {trust.map((t) => (
            <li key={t} className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-mint" />
              {t}
            </li>
          ))}
        </motion.ul>

        <HeroPreview reduce={Boolean(reduce)} />
      </div>
    </section>
  );
}

/** Illustrative invoice card — sample data only. */
function HeroPreview({ reduce }: { reduce: boolean }) {
  // Scroll-linked tilt: the preview lies back slightly and straightens as you scroll.
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [14, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [0.94, 1]);
  return (
    <motion.div
      ref={ref}
      initial={reduce ? false : { opacity: 0, y: 48 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformPerspective: 1200, rotateX, scale }}
      className="relative mt-16 w-full max-w-4xl"
      aria-label="Sample: speak a bill in Hinglish, Argus builds the GST invoice, marks it paid and shares it on WhatsApp"
      role="img"
    >
      <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-2 shadow-[0_40px_120px_-40px_rgba(102,71,240,0.6)] backdrop-blur">
        <div className="overflow-hidden rounded-2xl bg-white text-left text-ink">
          <div className="flex items-center justify-between border-b border-bone px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </div>
            <span className="rounded-full bg-mist px-3 py-1 font-mono text-[11px] text-slate">
              argusinvoicing.com/app
            </span>
            <span className="w-10" />
          </div>
          <HeroDemo />
        </div>
      </div>

      <div className="absolute -left-10 top-10 hidden animate-float-slow items-center gap-2 rounded-2xl border border-white/15 bg-onyx/85 px-4 py-3 text-sm text-white shadow-xl backdrop-blur-md lg:flex">
        <FileText className="h-4 w-4 text-mint" />
        GSTR-1 ready
      </div>
      <div className="absolute -bottom-6 -right-10 hidden animate-float-slow items-center gap-2 rounded-2xl border border-white/15 bg-onyx/85 px-4 py-3 text-sm text-white shadow-xl backdrop-blur-md [animation-delay:-3s] lg:flex">
        <ShieldCheck className="h-4 w-4 text-mint" />
        CA invited · read-only
      </div>
    </motion.div>
  );
}

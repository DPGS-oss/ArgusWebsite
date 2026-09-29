"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle2, FileText, IndianRupee, MessageCircle, ShieldCheck } from "lucide-react";
import { ShinyText } from "./ShinyText";

const trust = ["GST 2.0 rates built in", "Free CA access", "Same login on Android & web"];

export function Hero() {
  const reduce = useReducedMotion();
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <section className="relative isolate overflow-hidden bg-onyx pb-20 pt-32 text-white md:pb-28 md:pt-40">
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
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 48, rotateX: 12 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 1.1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformPerspective: 1200 }}
      className="relative mt-16 w-full max-w-4xl"
      aria-hidden
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
          <div className="grid gap-4 p-5 md:grid-cols-[1.4fr_1fr] md:p-6">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-ash">Tax invoice</p>
                  <p className="font-display text-xl font-bold">INV-2026-0142</p>
                  <p className="text-sm text-slate">Sharma Traders · 27AAPFU0939F1ZV</p>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700">Paid</span>
              </div>
              <div className="mt-5 space-y-2 text-sm">
                {[
                  ["Steel almirah · HSN 9403", "₹9,000.00"],
                  ["Installation · SAC 9954", "₹1,576.27"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between border-b border-bone/70 pb-2">
                    <span className="text-slate">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
                <div className="flex justify-between text-slate">
                  <span>CGST 9% + SGST 9%</span>
                  <span>₹1,903.73</span>
                </div>
                <div className="flex justify-between pt-1 font-display text-lg font-bold">
                  <span>Total</span>
                  <span>₹12,480.00</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-bone bg-mist p-4">
                <p className="text-xs text-ash">This month</p>
                <p className="font-display text-2xl font-bold">₹1,24,500</p>
                <div className="mt-3 flex h-12 items-end gap-1">
                  {[35, 52, 44, 60, 48, 72, 66, 84, 70, 92].map((h, i) => (
                    <span
                      key={i}
                      style={{ height: `${h}%` }}
                      className="flex-1 rounded-sm bg-gradient-to-t from-brand-violet to-signal-blue opacity-80"
                    />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                <span className="inline-flex items-center justify-center gap-1.5 rounded-full bg-green-600 py-2.5 text-white">
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </span>
                <span className="inline-flex items-center justify-center gap-1.5 rounded-full bg-ink py-2.5 text-white">
                  <IndianRupee className="h-3.5 w-3.5" /> Collect UPI
                </span>
              </div>
            </div>
          </div>
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

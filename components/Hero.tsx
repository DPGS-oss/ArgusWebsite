"use client";

import { animate, motion, useMotionValue, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, FileCheck2, FileText, PackageCheck, PlayCircle, Sparkles, TrendingUp } from "lucide-react";

const trust = ["GST 2.0 rates built in", "Free CA access", "Same login on Android & web"];

const ease = [0.16, 1, 0.3, 1] as const;

export function Hero() {
  const reduce = useReducedMotion();
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.8, delay, ease },
        };

  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-[#f3f7fb] to-white pb-16 pt-28 md:pb-24 md:pt-36">
      {/* Soft mint / peach glows from the brand design */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full bg-[radial-gradient(closest-side,rgba(110,231,183,0.35),transparent)] blur-2xl" />
        <div className="absolute right-[-10%] top-10 h-[520px] w-[520px] animate-aurora rounded-full bg-[radial-gradient(closest-side,rgba(253,186,116,0.22),transparent)] blur-2xl" />
        <div className="absolute left-1/2 top-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(30,42,94,0.06),transparent)] blur-2xl" />
      </div>

      <div className="container-page flex flex-col items-center gap-16">
        <div className="flex flex-col items-center text-center">
          <motion.a
            href="#features"
            {...rise(0)}
            className="group mb-7 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-600 shadow-subtle hover:border-amber-300"
          >
            <Sparkles className="h-3.5 w-3.5" />
            New: GST 2.0 rates 0 / 5 / 18 / 40% built in
            <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
          </motion.a>

          <motion.h1
            {...rise(0.08)}
            className="font-display text-5xl font-extrabold leading-[1.02] tracking-tightest text-ink md:text-6xl xl:text-7xl"
          >
            Accounting
            <br />
            made <span className="text-brand-violet">clear.</span>
          </motion.h1>

          <motion.p {...rise(0.16)} className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate md:text-lg">
            Bill customers, track stock and dues, prepare GSTR summaries, and share books with your CA
            — one workspace for Indian shops, on your phone and in the browser.
          </motion.p>

          <motion.ul {...rise(0.22)} className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium text-ink">
            {trust.map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-brand-violet" />
                {t}
              </li>
            ))}
          </motion.ul>

          <motion.div {...rise(0.3)} className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a href="/app/" className="btn-primary group px-7 py-3.5 text-base">
              Start 14-day free trial
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </a>
            <a href="#workflow" className="btn-secondary px-7 py-3.5 text-base">
              <PlayCircle className="h-5 w-5 text-brand-violet" />
              See how it works
            </a>
          </motion.div>

        </div>

        <InvoiceVisual reduce={Boolean(reduce)} />
      </div>
    </section>
  );
}

/** Counts up to `to` once, formatted as Indian rupees. */
function Rupees({ to, delay, reduce }: { to: number; delay: number; reduce: boolean }) {
  const value = useMotionValue(reduce ? to : 0);
  const [text, setText] = useState(fmt(reduce ? to : 0));
  useEffect(() => {
    if (reduce) return;
    const controls = animate(value, to, { duration: 1.4, delay, ease });
    const unsub = value.on("change", (v) => setText(fmt(v)));
    return () => {
      controls.stop();
      unsub();
    };
  }, [to, delay, reduce, value]);
  return <>{text}</>;
}

function fmt(v: number) {
  return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Sample tax invoice with floating status chips — illustrative data only. */
function InvoiceVisual({ reduce }: { reduce: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const lift = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [24, -24]);

  const chip = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, scale: 0.9, y: 12 },
          animate: { opacity: 1, scale: 1, y: 0 },
          transition: { duration: 0.7, delay, ease },
        };

  return (
    <motion.div
      ref={ref}
      style={{ y: lift }}
      className="relative mx-auto mb-16 w-full max-w-md"
      role="img"
      aria-label="Sample tax invoice for Sharma Traders: taxable value 24,500 rupees, CGST and SGST 2,205 rupees each, total 28,910 rupees, marked paid"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.25, ease }}
        className="rounded-card-lg border border-bone bg-white p-6 shadow-[0_30px_80px_-30px_rgba(30,42,94,0.35)]"
      >
        <div className="flex items-center justify-between border-b border-bone pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-white">
              <FileText className="h-4 w-4" />
            </span>
            <span className="font-semibold text-ink">Tax Invoice</span>
          </div>
          <motion.span
            initial={reduce ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 1.7, ease }}
            className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"
          >
            Paid
          </motion.span>
        </div>
        <p className="mt-4 font-semibold text-ink">INV/26-27/0142</p>
        <p className="text-sm text-slate">Sharma Traders · 27AAPFU0939F1ZV</p>
        <dl className="mt-5 space-y-2.5 rounded-xl bg-mist p-4 text-sm">
          {[
            ["Taxable value", 24500],
            ["CGST (9%)", 2205],
            ["SGST (9%)", 2205],
          ].map(([label, amt], i) => (
            <div key={label as string} className="flex justify-between text-slate">
              <dt>{label}</dt>
              <dd className="tabular-nums text-ink">
                <Rupees to={amt as number} delay={0.5 + i * 0.15} reduce={reduce} />
              </dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-bone pt-3 font-bold text-ink">
            <dt>Total</dt>
            <dd className="tabular-nums">
              <Rupees to={28910} delay={0.95} reduce={reduce} />
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex items-center justify-between text-xs text-slate">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-brand-violet" /> Rule 46 fields included
          </span>
          <span>GST 2.0 rates</span>
        </div>
      </motion.div>

      <motion.div
        {...chip(0.9)}
        className="absolute -right-4 -top-8 hidden items-center gap-3 rounded-xl border border-bone bg-white px-4 py-3 shadow-lift sm:flex"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
          <TrendingUp className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-[11px] text-slate">Collected this month</span>
          <span className="font-bold text-ink">₹2.4L</span>
        </span>
      </motion.div>

      <motion.div
        {...chip(1.15)}
        className="absolute -bottom-16 -left-10 hidden animate-float-slow items-center gap-3 rounded-xl border border-bone bg-white px-4 py-3 shadow-lift sm:flex"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-soft text-navy">
          <PackageCheck className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-[11px] text-slate">Stock</span>
          <span className="font-bold text-ink">Updated</span>
        </span>
      </motion.div>

      <motion.div
        {...chip(1.4)}
        className="absolute -bottom-24 -right-6 hidden animate-float-slow items-center gap-3 rounded-xl border border-bone bg-white px-4 py-3 shadow-lift [animation-delay:-3s] sm:flex"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
          <FileCheck2 className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-[11px] text-slate">GSTR-3B summary</span>
          <span className="font-bold text-ink">Ready for your CA</span>
        </span>
      </motion.div>
    </motion.div>
  );
}

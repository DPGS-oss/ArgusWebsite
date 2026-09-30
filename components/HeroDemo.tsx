"use client";

import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { CheckCircle2, IndianRupee, MessageCircle, Mic } from "lucide-react";
import { useEffect, useState } from "react";

/** Illustrative sample only: voice → invoice → paid → shared, looping. */
const ITEMS = [
  { label: "Steel almirah × 2 · HSN 9403", amount: 18000 },
  { label: "Delivery · SAC 9965", amount: 500 },
];
const TAXABLE = 18500;
const GST = 3330; // 18% of 18,500
const TOTAL = TAXABLE + GST; // 21,830
const VOICE = "Sharma Traders ko do steel almirah, nau hazaar each, aur delivery paanch sau";

// Timeline (ms from loop start) for each beat of the demo.
const STEPS = [0, 1600, 2600, 3300, 4200, 5600, 6600, 9800];
const LOOP_MS = 11000;

const inr = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function CountUp({ to, run }: { to: number; run: boolean }) {
  const value = useMotionValue(0);
  const text = useTransform(value, (v) => inr(Math.round(v)));
  useEffect(() => {
    if (!run) {
      value.set(0);
      return;
    }
    const controls = animate(value, to, { duration: 1.1, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [run, to, value]);
  return <motion.span>{text}</motion.span>;
}

export function HeroDemo() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(reduce ? STEPS.length : 0);

  useEffect(() => {
    if (reduce) {
      setStep(STEPS.length);
      return;
    }
    let timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      timers.forEach(clearTimeout);
      timers = STEPS.map((at, i) => setTimeout(() => setStep(i + 1), at));
    };
    run();
    const loop = setInterval(() => {
      setStep(0);
      run();
    }, LOOP_MS);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(loop);
    };
  }, [reduce]);

  const show = (n: number) => step >= n;
  const spring = { type: "spring" as const, stiffness: 260, damping: 22 };

  return (
    <div className="grid gap-4 p-5 md:grid-cols-[1.4fr_1fr] md:p-6">
      <div className="min-h-[300px]">
        {/* 1. Voice */}
        <AnimatePresence>
          {show(1) && (
            <motion.div
              key="voice"
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={spring}
              className="mb-4 flex items-start gap-3 rounded-2xl bg-gradient-to-r from-brand-violet/10 to-signal-blue/10 p-3"
            >
              <span className="relative mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-violet text-white">
                <Mic className="h-4 w-4" />
                {!show(2) && !reduce ? (
                  <span className="absolute inset-0 animate-ping rounded-full bg-brand-violet/40" />
                ) : null}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-violet">
                  {show(2) ? "Heard you" : "Listening…"}
                </p>
                {show(2) ? (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-ink">
                    “{VOICE}”
                  </motion.p>
                ) : (
                  <div className="mt-1 flex h-5 items-end gap-0.5" aria-hidden>
                    {Array.from({ length: 22 }).map((_, i) => (
                      <motion.span
                        key={i}
                        className="w-1 rounded-full bg-brand-violet/70"
                        animate={reduce ? { height: 8 } : { height: [4, 18, 7, 14, 5] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.04 }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-ash">Tax invoice</p>
            <p className="font-display text-xl font-bold">INV-2026-0142</p>
            <p className="text-sm text-slate">Sharma Traders · 27AAPFU0939F1ZV</p>
          </div>
          <AnimatePresence>
            {show(6) && (
              <motion.span
                key="paid"
                initial={{ opacity: 0, scale: 2.2, rotate: -18 }}
                animate={{ opacity: 1, scale: 1, rotate: -6 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 16 }}
                className="rounded-md border-2 border-emerald-600 px-2 py-0.5 text-xs font-extrabold uppercase tracking-widest text-emerald-700"
              >
                Paid
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* 2–3. Line items and tax */}
        <div className="mt-4 space-y-2 text-sm">
          {ITEMS.map((item, i) => (
            <AnimatePresence key={item.label}>
              {show(3 + i) && (
                <motion.div
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={spring}
                  className="flex justify-between border-b border-bone/70 pb-2"
                >
                  <span className="text-slate">{item.label}</span>
                  <span className="font-medium">{inr(item.amount)}</span>
                </motion.div>
              )}
            </AnimatePresence>
          ))}
          <AnimatePresence>
            {show(5) && (
              <motion.div key="tax" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex justify-between text-slate">
                  <span>CGST 9% + SGST 9%</span>
                  <span>{inr(GST)}</span>
                </div>
                <div className="flex justify-between pt-1 font-display text-lg font-bold">
                  <span>Total</span>
                  <CountUp to={TOTAL} run={show(5)} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-bone bg-mist p-4">
          <p className="text-xs text-ash">This month</p>
          <p className="font-display text-2xl font-bold">
            {show(6) ? <CountUp to={124500 + TOTAL} run={show(6)} /> : inr(124500)}
          </p>
          <div className="mt-3 flex h-12 items-end gap-1">
            {[35, 52, 44, 60, 48, 72, 66, 84, 70, 92].map((h, i) => (
              <motion.span
                key={i}
                initial={false}
                animate={{ height: `${i === 9 && !show(6) ? 60 : h}%` }}
                transition={{ ...spring, delay: reduce ? 0 : i * 0.03 }}
                className="flex-1 rounded-sm bg-gradient-to-t from-brand-violet to-signal-blue opacity-80"
              />
            ))}
          </div>
        </div>
        <div className="relative grid grid-cols-2 gap-2 text-xs font-bold">
          <motion.span
            animate={show(7) && !show(8) && !reduce ? { scale: [1, 1.08, 1] } : { scale: 1 }}
            transition={{ duration: 0.6, repeat: show(7) && !show(8) ? 2 : 0 }}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-green-600 py-2.5 text-white"
          >
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </motion.span>
          <span className="inline-flex items-center justify-center gap-1.5 rounded-full bg-ink py-2.5 text-white">
            <IndianRupee className="h-3.5 w-3.5" /> Collect UPI
          </span>
          <AnimatePresence>
            {show(7) && (
              <motion.span
                key="sent"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={spring}
                className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-50 py-2 text-emerald-700"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Bill sent to Sharma Traders
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, FileText, IndianRupee, Mic, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * 30-second product walkthrough: speak → bill → WhatsApp → paid.
 * Set VIDEO_SRC to a recorded MP4 (in /public) to show a real video instead.
 */
const VIDEO_SRC: string | null = null;

const SCENE_MS = 7500;
const scenes = [
  { title: "1. Speak the bill", caption: "Say the order in Hindi or English. Argus listens on your phone." },
  { title: "2. Argus builds the GST bill", caption: "Items, quantities, prices and GST — check it once and save." },
  { title: "3. Share on WhatsApp", caption: "The bill PDF and a UPI payment link go straight to your customer." },
  { title: "4. Get paid", caption: "When the money arrives, mark it paid. Dues and reports update." },
];

const SAID = "Sharma Traders ko do steel almirah, nau hazaar each, aur delivery paanch sau";

function Typed({ text, ms }: { text: string; ms: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const step = Math.max(20, ms / text.length);
    const id = setInterval(() => setN((v) => (v >= text.length ? v : v + 1)), step);
    return () => clearInterval(id);
  }, [text, ms]);
  return <>{text.slice(0, n)}</>;
}

function SceneSpeak() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-brand-violet text-white">
        <span className="absolute inset-0 animate-ping rounded-full bg-brand-violet/40" />
        <Mic className="relative h-9 w-9" />
      </span>
      <p className="max-w-md text-lg font-medium text-ink">
        &ldquo;<Typed text={SAID} ms={4500} />&rdquo;
      </p>
      <p className="text-sm text-slate">Listening… works offline</p>
    </div>
  );
}

const lines = [
  ["Steel almirah × 2 · HSN 9403", "₹15,254.24"],
  ["Delivery (taxed with goods)", "₹423.73"],
  ["CGST 9% + SGST 9%", "₹2,822.03"],
];

function SceneBill() {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col justify-center px-6">
      <div className="rounded-xl border border-bone bg-white p-5 shadow-subtle">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
          <FileText className="h-4 w-4 text-navy" /> Tax Invoice · INV/26-27/0042
        </div>
        <p className="mb-3 text-sm text-slate">Sharma Traders</p>
        {lines.map(([l, a], i) => (
          <motion.div
            key={l}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + i * 0.5 }}
            className="flex justify-between border-t border-bone py-2 text-sm"
          >
            <span className="text-slate">{l}</span>
            <span className="tabular-nums text-ink">{a}</span>
          </motion.div>
        ))}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.2 }}
          className="flex justify-between border-t border-bone pt-3 font-bold text-ink"
        >
          <span>Total</span>
          <span className="tabular-nums">₹18,500.00</span>
        </motion.div>
      </div>
    </div>
  );
}

function SceneWhatsApp() {
  return (
    <div className="mx-auto flex h-full max-w-sm flex-col justify-center gap-3 px-6">
      <div className="rounded-xl bg-[#e7ffdb] p-3 text-sm text-ink shadow-subtle">
        <p className="font-semibold">Sharma Kirana Store</p>
        <p className="mt-1">Namaste! Your bill INV/26-27/0042 for ₹18,500 is attached.</p>
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-white p-2 text-xs">
          <FileText className="h-4 w-4 text-red-500" /> INV-26-27-0042.pdf
        </div>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mt-2 text-xs text-[#027eb5] underline">
          Pay with UPI: upi://pay?pa=sharmakirana@okaxis&am=18500
        </motion.p>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.4 }}
        className="ml-auto rounded-xl bg-white p-3 text-sm text-ink shadow-subtle"
      >
        Received, paying now 👍
      </motion.div>
    </div>
  );
}

function ScenePaid() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <motion.span
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"
      >
        <CheckCircle2 className="h-11 w-11" />
      </motion.span>
      <p className="font-display text-3xl font-bold text-ink">
        <IndianRupee className="mb-1 inline h-7 w-7" />
        18,500 received
      </p>
      <p className="text-slate">INV/26-27/0042 marked paid · Sharma Traders owes ₹0</p>
    </div>
  );
}

const SCENES = [SceneSpeak, SceneBill, SceneWhatsApp, ScenePaid];

export function Walkthrough() {
  const reduce = useReducedMotion();
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(!reduce);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(0);

  useEffect(() => {
    if (!playing) return;
    started.current = performance.now() - elapsed;
    let raf = 0;
    const tick = (now: number) => {
      const t = now - started.current;
      if (t >= SCENE_MS) {
        setScene((s) => (s + 1) % scenes.length);
        setElapsed(0);
        started.current = now;
      } else {
        setElapsed(t);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  if (VIDEO_SRC) {
    return (
      <video className="w-full rounded-card-lg" src={VIDEO_SRC} controls playsInline muted autoPlay loop>
        <track kind="captions" />
      </video>
    );
  }

  const Current = SCENES[scene];
  return (
    <div className="overflow-hidden rounded-card-lg border border-bone bg-mist shadow-[0_30px_80px_-30px_rgba(30,42,94,0.3)]">
      <div className="relative h-[340px] bg-gradient-to-b from-white to-mist">
        <AnimatePresence mode="wait">
          <motion.div
            key={scene}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.45 }}
            className="absolute inset-0"
          >
            <Current />
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="border-t border-bone bg-white px-5 py-4">
        <div className="mb-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause walkthrough" : "Play walkthrough"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-white"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <div>
            <p className="font-semibold text-ink">{scenes[scene].title}</p>
            <p className="text-sm text-slate" aria-live="polite">{scenes[scene].caption}</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1.5" aria-hidden>
          {scenes.map((s, i) => (
            <button
              key={s.title}
              type="button"
              tabIndex={-1}
              onClick={() => {
                setScene(i);
                setElapsed(0);
                started.current = performance.now();
              }}
              className="h-1.5 overflow-hidden rounded-full bg-bone"
            >
              <span
                className="block h-full rounded-full bg-brand-violet"
                style={{ width: i < scene ? "100%" : i === scene ? `${(elapsed / SCENE_MS) * 100}%` : "0%" }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

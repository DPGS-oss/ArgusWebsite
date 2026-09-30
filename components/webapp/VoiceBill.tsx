"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Mic, MicOff, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatCurrency } from "@/lib/gst";
import { parseVoiceBill, type VoiceBill } from "@/lib/voice-parser";

// Minimal typings for the Web Speech API (Chrome / Edge ship it prefixed).
type SpeechResultList = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as (new () => SpeechRecognitionLike) | null;
}

type Props = { onApply: (bill: VoiceBill) => void };

export function VoiceBill({ onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<"hi-IN" | "en-IN">("hi-IN");
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  const reduce = useReducedMotion();
  const supported = useMemo(() => !!getRecognition(), []);
  const bill = useMemo(() => (text.trim() ? parseVoiceBill(text) : null), [text]);

  useEffect(() => () => recRef.current?.stop(), []);

  function start() {
    const Rec = getRecognition();
    if (!Rec) return;
    setError("");
    finalRef.current = text ? text + " " : "";
    const rec = new Rec();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript + " ";
        else interim += r[0].transcript;
      }
      setText((finalRef.current + interim).trim());
    };
    rec.onerror = (e) => {
      setError(
        e.error === "not-allowed"
          ? "Microphone permission was blocked. Allow it in the browser's address bar, or type the order below."
          : "Could not hear clearly. Try again, or type the order below."
      );
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  function stop() {
    recRef.current?.stop();
    setListening(false);
  }

  function apply() {
    if (!bill || (!bill.items.length && !bill.delivery)) return;
    onApply(bill);
    setOpen(false);
    setText("");
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-brand !py-2">
        <Mic className="h-4 w-4" /> Speak the bill
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { stop(); setOpen(false); }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="voice-bill-title"
              className="w-full max-w-lg rounded-card-lg bg-white p-5 text-ink shadow-lift"
              initial={reduce ? false : { y: 24, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 id="voice-bill-title" className="text-lg font-bold">Speak the bill</h2>
                <button type="button" aria-label="Close" onClick={() => { stop(); setOpen(false); }} className="rounded-full p-1.5 hover:bg-mist">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mb-4 text-sm text-slate">
                Say it like you would to a helper, e.g. “Sharma Traders ko do steel almirah, nau hazaar each, aur delivery paanch sau”.
              </p>

              <div className="mb-4 flex items-center gap-3">
                <button
                  type="button"
                  disabled={!supported}
                  onClick={listening ? stop : start}
                  aria-pressed={listening}
                  className={`relative inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white transition ${
                    listening ? "bg-red-500" : "bg-gradient-to-br from-brand-violet to-signal-blue"
                  } disabled:opacity-40`}
                >
                  {listening && !reduce ? <span className="absolute inset-0 animate-ping rounded-full bg-red-400/50" /> : null}
                  {listening ? <MicOff className="relative h-6 w-6" /> : <Mic className="relative h-6 w-6" />}
                  <span className="sr-only">{listening ? "Stop listening" : "Start listening"}</span>
                </button>
                <div className="text-sm">
                  <div className="font-semibold">{listening ? "Listening…" : supported ? "Tap the mic and speak" : "Voice isn't available in this browser"}</div>
                  <div className="mt-1 inline-flex rounded-full border border-bone bg-mist p-0.5 text-xs">
                    {(["hi-IN", "en-IN"] as const).map((l) => (
                      <button
                        key={l}
                        type="button"
                        disabled={listening}
                        onClick={() => setLang(l)}
                        className={`rounded-full px-2.5 py-1 ${lang === l ? "bg-white font-semibold shadow-subtle" : "text-slate"}`}
                      >
                        {l === "hi-IN" ? "हिंदी / Hinglish" : "English"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label className="block text-xs font-medium text-slate">
                What Argus heard (you can edit it)
                <textarea
                  className="input-field mt-1 min-h-[80px]"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={supported ? "Your words appear here…" : "Type the order here, e.g. 2 kg sugar 45 rupees each"}
                />
              </label>
              {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

              {bill && (bill.items.length || bill.delivery || bill.customerName) ? (
                <div className="mt-4 rounded-xl border border-bone bg-mist p-3 text-sm">
                  {bill.customerName ? <div className="mb-2"><span className="text-slate">Customer:</span> <strong>{bill.customerName}</strong></div> : null}
                  {bill.items.map((it, i) => (
                    <div key={i} className="flex justify-between border-b border-bone/70 py-1 last:border-0">
                      <span>{it.quantity} × {it.name} <span className="text-xs text-slate">({it.gstRate}% GST)</span></span>
                      <span className="font-medium">{formatCurrency(it.quantity * it.price)}</span>
                    </div>
                  ))}
                  {bill.delivery ? (
                    <div className="flex justify-between py-1"><span>Delivery</span><span className="font-medium">{formatCurrency(bill.delivery)}</span></div>
                  ) : null}
                  <p className="mt-2 text-xs text-slate">Prices are what the customer pays (GST included). Check before saving.</p>
                </div>
              ) : null}

              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className="btn-secondary !py-2" onClick={() => { stop(); setOpen(false); }}>Cancel</button>
                <button
                  type="button"
                  className="btn-primary !py-2"
                  disabled={!bill || (!bill.items.length && !bill.delivery)}
                  onClick={() => { stop(); apply(); }}
                >
                  Add to bill
                </button>
              </div>
              <p className="mt-3 text-[11px] text-ash">
                Voice uses your browser&apos;s speech service ({"Chrome/Edge send audio to Google"}); the text is turned into a bill on this device.
              </p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

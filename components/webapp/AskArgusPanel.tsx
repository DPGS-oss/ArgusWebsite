"use client";

import { FormEvent, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import type { AppData } from "@/lib/types";
import { useAuth, hasValidSubscription } from "@/lib/auth-provider";
import { buildAskArgusSummary, askArgusQuestion } from "@/lib/ask-argus";

type AskArgusPanelProps = {
  data: AppData;
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fyStart(d = new Date()) {
  const year = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${year}-04-01`;
}

export function AskArgusPanel({ data }: AskArgusPanelProps) {
  const { user, token } = useAuth();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const includeParties = Boolean(data.settings.askArgusIncludeParties);
  const from = fyStart();
  const to = isoDate(new Date());

  const summary = useMemo(
    () => buildAskArgusSummary(data, from, to, includeParties),
    [data, from, to, includeParties],
  );

  if (!hasValidSubscription(user)) return null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token || !question.trim()) return;
    setLoading(true);
    setError("");
    setAnswer("");
    try {
      const result = await askArgusQuestion(token, question.trim(), summary);
      setAnswer(result.answer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach Ask Argus");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-card border border-bone bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-violet" />
            <h3 className="font-semibold text-ink">Ask Argus</h3>
          </div>
          <p className="text-xs text-slate">
            GST math and reports run on this device. OpenRouter free AI only when you tap Ask — summary strips party names
            {includeParties ? " (you opted in to include top party names)." : " unless you opt in under Settings."}
          </p>
        </div>
        <button type="button" className="btn-outline px-4 py-2 text-xs" onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "Ask Argus"}
        </button>
      </div>

      {open ? (
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            placeholder="e.g. Is my GST liability rising this quarter?"
            className="w-full rounded-card border border-bone px-3 py-2 text-sm"
          />
          <button type="submit" className="btn-primary px-5 py-2 text-sm" disabled={loading || !question.trim()}>
            {loading ? "Thinking…" : "Ask via OpenRouter (free tier)"}
          </button>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {answer ? (
            <div className="rounded-card bg-mist p-3 text-sm text-ink whitespace-pre-wrap">{answer}</div>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

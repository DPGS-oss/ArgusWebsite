"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Building2,
  Monitor,
  X,
} from "lucide-react";
import { isFileSystemSupported } from "@/lib/storage";

const TUTORIAL_KEY_PREFIX = "argus_web_tutorial_done_";

export function tutorialStorageKey(userId: string): string {
  return `${TUTORIAL_KEY_PREFIX}${userId}`;
}

export function hasCompletedTutorial(userId: string): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(tutorialStorageKey(userId)) === "1";
}

export function markTutorialComplete(userId: string): void {
  localStorage.setItem(tutorialStorageKey(userId), "1");
}

type Step = {
  icon: typeof Monitor;
  title: string;
  body: string;
};

function buildSteps(folderSupported: boolean): Step[] {
  return [
    {
      icon: BookOpen,
      title: "Welcome to Argus Web",
      body: "Full books workspace — invoices, stock, khata, purchases, and GST summaries. Same login as Android. Best in Chrome or Edge.",
    },
    {
      icon: Building2,
      title: "Add your business, then bill",
      body: folderSupported
        ? "Create your shop profile (GSTIN). Optionally attach a folder later in Settings for argus-books.json backup — cloud sync stays optional."
        : "Create your shop profile (GSTIN). On Firefox/Safari use Export in Settings for backups. Chrome/Edge can attach a disk folder.",
    },
    {
      icon: Monitor,
      title: "You're ready",
      body: "Create an invoice, open Books or GSTR views, and invite your CA when needed. You can skip this tour anytime.",
    },
  ];
}

type WebAppTutorialProps = {
  userId: string;
  onComplete: () => void;
  onGoToBusiness?: () => void;
  onGoToSettings?: () => void;
};

export function WebAppTutorial({
  userId,
  onComplete,
  onGoToBusiness,
  onGoToSettings,
}: WebAppTutorialProps) {
  const [index, setIndex] = useState(0);
  const folderSupported = isFileSystemSupported();
  const steps = buildSteps(folderSupported);
  const step = steps[index];
  const last = index >= steps.length - 1;
  const Icon = step.icon;

  function finish() {
    markTutorialComplete(userId);
    onComplete();
  }

  function next() {
    if (last) {
      finish();
      return;
    }
    setIndex((i) => i + 1);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "Enter") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish/next closed over index
  }, [index, userId]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="argus-tutorial-title"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-card border border-bone bg-white shadow-subtle">
        <button
          type="button"
          onClick={finish}
          className="absolute right-3 top-3 rounded-full p-2 text-slate hover:bg-mist hover:text-ink"
          aria-label="Skip tutorial"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="bg-gradient-to-br from-mist via-white to-plaster px-6 pb-4 pt-8">
          <div className="mb-4 inline-flex rounded-full bg-brand-violet/10 p-3 text-brand-violet">
            <Icon className="h-6 w-6" />
          </div>
          <p className="mb-1 text-xs font-semibold tracking-wide text-slate uppercase">
            Step {index + 1} of {steps.length}
          </p>
          <h2 id="argus-tutorial-title" className="text-2xl font-bold tracking-tight text-ink">
            {step.title}
          </h2>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm leading-relaxed text-slate">{step.body}</p>

          <div className="mt-4 flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${
                  i <= index ? "bg-brand-violet" : "bg-bone"
                }`}
              />
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={finish}
              className="text-sm font-medium text-slate hover:text-ink"
            >
              Skip tour
            </button>
            <div className="flex gap-2">
              {index === 2 && onGoToBusiness ? (
                <button
                  type="button"
                  onClick={() => {
                    finish();
                    onGoToBusiness();
                  }}
                  className="btn-outline !py-2 !text-xs"
                >
                  Add business
                </button>
              ) : null}
              {index === 3 && onGoToSettings ? (
                <button
                  type="button"
                  onClick={() => {
                    finish();
                    onGoToSettings();
                  }}
                  className="btn-outline !py-2 !text-xs"
                >
                  Open Settings
                </button>
              ) : null}
              <button type="button" onClick={next} className="btn-primary !py-2">
                {last ? "Get started" : "Next"}
                {!last ? <ArrowRight className="ml-1 h-4 w-4" /> : null}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

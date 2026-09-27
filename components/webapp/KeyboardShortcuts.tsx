"use client";

import { useEffect, useState } from "react";

type KeyboardShortcutsProps = {
  onNewInvoice: () => void;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function KeyboardShortcuts({ onNewInvoice }: KeyboardShortcutsProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "?" && !isTypingTarget(e.target)) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        onNewInvoice();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNewInvoice]);

  if (!open) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-72 rounded-card border border-bone bg-white p-4 shadow-subtle">
      <p className="text-sm font-bold text-ink">Keyboard</p>
      <ul className="mt-2 space-y-1 text-sm text-slate">
        <li><kbd className="rounded bg-mist px-1">N</kbd> New invoice</li>
        <li><kbd className="rounded bg-mist px-1">?</kbd> Show or hide this list</li>
        <li><kbd className="rounded bg-mist px-1">Esc</kbd> Close this list</li>
      </ul>
      <p className="mt-2 text-xs text-slate">Argus does not file GST or mint IRNs.</p>
    </div>
  );
}

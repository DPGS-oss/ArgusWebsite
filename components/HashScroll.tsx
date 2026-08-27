"use client";

import { useEffect } from "react";

function scrollToCurrentHash() {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return;
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    id = raw;
  }
  const el = document.getElementById(id);
  if (!el) return;
  const html = document.documentElement;
  const previous = html.style.scrollBehavior;
  html.style.scrollBehavior = "auto";
  el.scrollIntoView({ behavior: "auto", block: "start" });
  html.style.scrollBehavior = previous;
}

export function HashScroll() {
  useEffect(() => {
    const run = () => {
      scrollToCurrentHash();
    };

    run();
    const timers = [50, 150, 400, 800].map((ms) => window.setTimeout(run, ms));
    window.addEventListener("hashchange", run);
    window.addEventListener("load", run);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("hashchange", run);
      window.removeEventListener("load", run);
    };
  }, []);

  return null;
}

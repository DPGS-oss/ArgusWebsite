"use client";

/**
 * Usage analytics (PostHog), only for people who opt in.
 *
 * Under the DPDP Act, usage tracking tied to an account needs the person's
 * consent, so this sends nothing until they tick "Help improve Argus" (on the
 * consent screen or in Settings), and nothing at all without a project key
 * (NEXT_PUBLIC_POSTHOG_KEY at build time).
 *
 * What is sent: the event name (e.g. "bill_saved"), the screen, the plan and
 * a pseudonymous id (a hash of the account id). Never names, phone numbers,
 * GSTINs, amounts, customers or bill contents.
 */

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || "";
const HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/+$/, "");
const OPT_IN_KEY = "argus_analytics_opt_in";

let distinctId = "";
let queue: { event: string; properties: Record<string, unknown>; timestamp: string }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

export const analyticsConfigured = () => !!KEY;

export function analyticsAllowed(): boolean {
  if (!KEY || typeof window === "undefined") return false;
  try {
    return localStorage.getItem(OPT_IN_KEY) === "yes";
  } catch {
    return false;
  }
}

export function setAnalyticsAllowed(on: boolean) {
  try {
    localStorage.setItem(OPT_IN_KEY, on ? "yes" : "no");
  } catch {
    // private mode: stays off
  }
  if (!on) queue = [];
}

/** A stable, pseudonymous id for this account (no email, no name). */
export async function identifyAnalytics(uid: string) {
  if (!uid || typeof crypto === "undefined" || !crypto.subtle) return;
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`argus:${uid}`));
  distinctId = Array.from(new Uint8Array(bytes)).slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Records a usage event (only names of things, never content). */
export function track(event: string, properties: Record<string, string | number | boolean | undefined> = {}) {
  if (!analyticsAllowed() || !distinctId) return;
  queue.push({
    event,
    properties: { ...properties, surface: "web", $current_url: window.location.pathname },
    timestamp: new Date().toISOString(),
  });
  if (queue.length >= 20) void flush();
  else if (!timer) timer = setTimeout(() => void flush(), 10_000);
}

async function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!queue.length || !distinctId) return;
  const batch = queue.splice(0, queue.length).map((e) => ({ ...e, distinct_id: distinctId }));
  try {
    await fetch(`${HOST}/batch/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: KEY, batch }),
      keepalive: true,
    });
  } catch {
    // analytics never gets in the way
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => void flush());
}

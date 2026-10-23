"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-provider";
import { BrandLogo } from "./BrandLogo";
import { setAnalyticsAllowed } from "@/lib/analytics";

/** Bump when Privacy/Terms materially change so users re-consent. */
export const WEB_LEGAL_VERSION = "2026-10-23";

function storageKey(uid: string) {
  return `argus_web_legal_${uid}`;
}

export function hasAcceptedWebLegal(uid: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(storageKey(uid)) === WEB_LEGAL_VERSION;
  } catch {
    return false;
  }
}

export function markWebLegalAccepted(uid: string) {
  try {
    localStorage.setItem(storageKey(uid), WEB_LEGAL_VERSION);
  } catch {
    // private mode: the server's record still holds it
  }
}

/** Records the consent on the server (version, what was ticked, when): DPDP Act s.6(10). */
export async function recordConsent(token: string, surface: "web" | "ca_portal", items: string[]) {
  try {
    await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ legal_consent: { version: WEB_LEGAL_VERSION, surface, items } }),
    });
  } catch {
    // retried on the next visit (the gate shows again until the server has it)
  }
}

/**
 * First login / signup consent gate aligned with the Flutter LegalConsentScreen.
 * Blocks use of the signed-in experience until Terms + Privacy + authority are accepted.
 */
export function LegalConsentGate() {
  const { user, firebaseUser, authReady, token } = useAuth();
  // Chartered accountants opening the CA portal agree to the CA terms, not the shop owner's.
  const ca = (usePathname() || "").startsWith("/ca");
  const [confidential, setConfidential] = useState(false);
  // Optional, off unless ticked: usage analytics (DPDP: consent for this purpose alone).
  const [analytics, setAnalytics] = useState(false);
  const [open, setOpen] = useState(false);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [authority, setAuthority] = useState(false);
  const [age, setAge] = useState(false);

  useEffect(() => {
    if (!authReady || !user || !firebaseUser?.uid) {
      setOpen(false);
      return;
    }
    // Accepted already (this browser, or any device: the server's record).
    setOpen(!hasAcceptedWebLegal(firebaseUser.uid) && user.legal_consent_version !== WEB_LEGAL_VERSION);
  }, [authReady, user, firebaseUser?.uid]);

  if (!open || !firebaseUser?.uid) return null;

  const canContinue = terms && privacy && authority && age && (!ca || confidential);

  function accept() {
    markWebLegalAccepted(firebaseUser!.uid);
    setAnalyticsAllowed(analytics);
    if (token) {
      const items = ca
        ? ["age_18", "terms", "privacy", "ca_professional", "ca_confidentiality"]
        : ["age_18", "terms", "refund", "privacy", "authority"];
      void recordConsent(token, ca ? "ca_portal" : "web", analytics ? [...items, "analytics"] : items);
    }
    setOpen(false);
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card border border-bone bg-white p-6 shadow-subtle">
        <div className="mb-4 flex justify-center">
          <BrandLogo href={null} size={28} />
        </div>
        <h2 className="text-xl font-bold text-ink">Terms, Privacy &amp; consent</h2>
        <p className="mt-2 text-sm text-slate">
          Version {WEB_LEGAL_VERSION}. Same expectations as the Argus mobile app — please read and
          confirm before continuing.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/privacy/" target="_blank" className="text-brand-violet underline">
            Privacy Policy
          </Link>
          <Link href="/terms/" target="_blank" className="text-brand-violet underline">
            Terms of Service
          </Link>
          <Link href="/refund/" target="_blank" className="text-brand-violet underline">
            Refund Policy
          </Link>
        </div>

        {ca ? (
          <ul className="mt-4 space-y-3 text-sm text-slate">
            <li>
              The CA portal is free and read-only. You see a client&apos;s books only after the client
              invites you, and only until they remove you.
            </li>
            <li>
              You use a client&apos;s books only to give that client your professional services (returns,
              accounts, advice), keep them confidential, and do not share them except as the client
              allows or the law requires. You are responsible for the returns you prepare or file.
            </li>
            <li>
              We process your account details and your access to clients&apos; books to run the portal.
              See Privacy for your rights, retention and the Grievance Officer.
            </li>
          </ul>
        ) : (
        <ul className="mt-4 space-y-3 text-sm text-slate">
          <li>
            You must be 18+ and authorised for this business. You are responsible for invoices, GST
            data, and filings on government portals. Argus provides summaries and tools — not tax
            advice, and not GSP filing / e-invoice IRN / e-way generation.
          </li>
          <li>
            We process account, business, and books data to run Argus. Cloud sync (on by default with Business, off any time in Settings), people
            you add to your books, and CA shares send data to processors (including Google Cloud in
            the US); people you add see your books with the access you choose. See Privacy for
            rights, retention, and the Grievance Officer.
          </li>
          <li>
            Cancelled subscriptions and extra users (₹50 per user per month) are not prorated or
            refunded for unused time. Lifetime covers
            the current Business generation (max 25 years or earlier discontinuation); add-ons and
            major overhauls are separate.
          </li>
        </ul>
        )}

        <div className="mt-5 space-y-2">
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-1"
              checked={age}
              onChange={(e) => setAge(e.target.checked)}
            />
            I confirm I am at least 18 years old.
          </label>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-1"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
            />
            {ca ? "I agree to the Terms of Service." : "I agree to the Terms of Service and Refund Policy."}
          </label>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-1"
              checked={privacy}
              onChange={(e) => setPrivacy(e.target.checked)}
            />
            I consent to the Privacy Policy and described data processing.
          </label>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-1"
              checked={authority}
              onChange={(e) => setAuthority(e.target.checked)}
            />
            {ca ? "Each client whose books I open has authorised me as their accountant." : "I am authorised to use Argus for this business or client."}
          </label>
          {ca ? (
            <label className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" className="mt-1" checked={confidential} onChange={(e) => setConfidential(e.target.checked)} />
              I will keep clients&apos; books confidential and use them only for my work for that client.
            </label>
          ) : null}
        </div>

        <label className="mt-4 flex items-start gap-2 rounded-card bg-mist p-3 text-sm text-ink">
          <input type="checkbox" className="mt-1" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} />
          <span>
            <strong>Optional:</strong> help improve Argus by sharing which screens and features I use. No bill
            contents, names, amounts or GSTINs. You can turn this off in Settings.
          </span>
        </label>

        <button
          type="button"
          className="btn-primary mt-6 w-full"
          disabled={!canContinue}
          onClick={accept}
        >
          Accept and continue
        </button>
      </div>
    </div>
  );
}

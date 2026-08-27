"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-provider";
import { BrandLogo } from "./BrandLogo";

/** Bump when Privacy/Terms materially change so users re-consent. */
export const WEB_LEGAL_VERSION = "2026-08-27";

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
  localStorage.setItem(storageKey(uid), WEB_LEGAL_VERSION);
}

/**
 * First login / signup consent gate aligned with the Flutter LegalConsentScreen.
 * Blocks use of the signed-in experience until Terms + Privacy + authority are accepted.
 */
export function LegalConsentGate() {
  const { user, firebaseUser, authReady } = useAuth();
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
    setOpen(!hasAcceptedWebLegal(firebaseUser.uid));
  }, [authReady, user, firebaseUser?.uid]);

  if (!open || !firebaseUser?.uid) return null;

  const canContinue = terms && privacy && authority && age;

  function accept() {
    markWebLegalAccepted(firebaseUser!.uid);
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

        <ul className="mt-4 space-y-3 text-sm text-slate">
          <li>
            You must be 18+ and authorised for this business. You are responsible for invoices, GST
            data, and filings on government portals. Argus provides summaries and tools — not tax
            advice, and not GSP filing / e-invoice IRN / e-way generation.
          </li>
          <li>
            We process account, business, and books data to run Argus. Optional cloud sync and CA
            shares send data to processors (including Google Cloud in the US). See Privacy for
            rights, retention, and the Grievance Officer.
          </li>
          <li>
            Cancelled subscriptions are not prorated or refunded for unused time. Lifetime covers
            the current Business generation (max 25 years or earlier discontinuation); add-ons and
            major overhauls are separate.
          </li>
        </ul>

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
            I agree to the Terms of Service and Refund Policy.
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
            I am authorised to use Argus for this business or client.
          </label>
        </div>

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

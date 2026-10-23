"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { useAuth, hasValidSubscription } from "@/lib/auth-provider";
import { startRazorpayCheckout, validatePromoCode, type PromoOffer } from "@/lib/razorpay";
import { isBusinessPlanName, startBusinessTrial } from "@/lib/subscription";
import { BrandLogo } from "./BrandLogo";
import { initStorage, loadData } from "@/lib/storage";

export function SubscriptionGate() {
  const { user, token, logout, refreshProfile, firebaseUser } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [promoInput, setPromoInput] = useState("");
  const [promoOffer, setPromoOffer] = useState<PromoOffer | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [yearly, setYearly] = useState(true);
  const trialUsed = !!(user?.trial_used || user?.trial_started_at);
  // Someone invited to a shop's books uses the shop's plan: let them join from here.
  const [invite, setInvite] = useState<{ ownerName: string; access: string } | null>(null);
  const [lifetimeOpen, setLifetimeOpen] = useState(true);
  useEffect(() => {
    fetch("/api/auth/plans")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && d.lifetime_available === false) setLifetimeOpen(false); })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!token) return;
    fetch("/api/team", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => setInvite(me && me.invite ? me.invite : null))
      .catch(() => {});
  }, [token]);

  async function handleJoin() {
    if (!token) return;
    setLoading("join");
    setError("");
    try {
      const res = await fetch("/api/team/accept", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{}" });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Could not join");
      await refreshProfile();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join");
      setLoading(null);
    }
  }

  // A lapsed plan never locks owners out of their own books: they can always
  // take a copy (the cloud's, else the one kept in this browser).
  async function handleDownloadBooks() {
    setLoading("download");
    setError("");
    try {
      let books: unknown = null;
      if (token) {
        const res = await fetch("/api/data/load?export=1", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) books = (await res.json().catch(() => ({}))).data || null;
      }
      if (!books && firebaseUser) {
        const local = await initStorage(firebaseUser.uid);
        if ((local.invoices || []).length || (local.businesses || []).length) books = loadData();
      }
      if (!books) throw new Error("No books found for this account.");
      const blob = new Blob([JSON.stringify(books, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `argus-books-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download the books");
    } finally {
      setLoading(null);
    }
  }

  async function handleApplyPromo() {
    if (!token || !user) return;
    setPromoLoading(true);
    setPromoError("");
    try {
      const offer = await validatePromoCode(promoInput, token);
      setPromoOffer(offer);
      setError("");
    } catch (err) {
      setPromoOffer(null);
      setPromoError(err instanceof Error ? err.message : "Invalid offer code");
    } finally {
      setPromoLoading(false);
    }
  }

  async function handleSubscribe(planKey: string) {
    if (!token || !user) return;
    setLoading(planKey);
    setError("");
    try {
      await startRazorpayCheckout(planKey, token, user, {
        referralCode: referralCode.trim() || undefined,
        promoCode: promoOffer?.code,
      });
      await refreshProfile();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start payment";
      if (message !== "Checkout dismissed") setError(message);
    } finally {
      setLoading(null);
    }
  }

  async function handleStartTrial() {
    if (!token) return;
    setLoading("trial");
    setError("");
    try {
      await startBusinessTrial(token);
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start free trial");
    } finally {
      setLoading(null);
    }
  }

  const currentPlan = user?.subscription?.plan;
  const hasValidPlan = hasValidSubscription(user);
  const hadBusinessButExpired =
    !!currentPlan && isBusinessPlanName(currentPlan) && !hasValidPlan;

  const planKey = yearly ? "business_yearly" : "business";
  const priceLabel = promoOffer
    ? `₹${promoOffer.amount_rupees} for ${promoOffer.duration_months} months`
    : yearly
      ? "₹5,000 / year"
      : "₹500 / month";
  const savingsLabel = promoOffer ? "Offer" : yearly ? "Best value" : null;

  const freeFeatures = [
    "20 bills a month on Android",
    "Basic billing & customers",
    "UPI payment links",
    "Upgrade anytime for full books + web",
  ];

  const businessFeatures = [
    "Unlimited bills on phone & web, no watermark",
    "Full books: purchases, stock, khata",
    "GSTR-1, 2B, 3B summaries",
    "Quotes, credit notes & challans",
    "CA portal & reports",
    "Best on Chrome / Edge (folder backup)",
  ];

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-12">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <BrandLogo href="/app/" size={28} />
          </div>
          <h1 className="mb-2 text-3xl font-bold text-ink">
            {!trialUsed && !hasValidPlan ? "Try Argus Business free" : "Subscription Required"}
          </h1>
          <p className="max-w-md text-slate">
            {hasValidPlan
              ? "Your subscription is being verified. Please wait..."
              : hadBusinessButExpired
              ? "Your Business subscription has expired. Renew below to continue using the web app."
              : currentPlan
              ? `Your current plan (${currentPlan}) doesn't include web access. Upgrade to Business to continue.`
              : "Web books, GSTR summaries, and the CA portal are Business. Android Free covers 20 bills a month — it does not unlock this web suite. Start a 14-day trial, or subscribe below."}
          </p>
        </div>

        {invite && (
          <div className="mb-8 w-full max-w-md rounded-card border border-brand-violet bg-white p-5 text-center">
            <p className="text-ink">
              <b>{invite.ownerName || "A business"}</b> invited you to make bills in their books
              ({invite.access === "full" ? "full access" : "billing only"}). Their plan covers you.
            </p>
            <button onClick={handleJoin} disabled={loading === "join"} className="btn-primary mt-4 px-6 py-2.5 text-sm">
              {loading === "join" ? "Joining…" : "Join their books"}
            </button>
          </div>
        )}

        {hadBusinessButExpired && (
          <div className="mb-6 w-full max-w-md rounded-card border border-bone bg-white p-5 text-center">
            <p className="text-sm text-ink">
              Your books are safe. Renew to keep billing and syncing, or download a copy of everything now.
            </p>
            <button onClick={handleDownloadBooks} disabled={loading === "download"} className="btn-secondary mt-3 px-5 py-2 text-sm">
              {loading === "download" ? "Preparing…" : "Download my books"}
            </button>
          </div>
        )}

        {error && (
          <p className="mb-6 rounded-card bg-red-500/10 px-4 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {!hasValidPlan && !trialUsed ? (
          <div className="mb-6 w-full max-w-md rounded-card border border-emerald-500/40 bg-emerald-500/5 p-6">
            <h3 className="mb-1 text-lg font-semibold text-ink">14-day free trial</h3>
            <p className="mb-4 text-sm text-slate">
              Full Business suite on web (and the same login on Android). One trial per
              account, device, and network — no card required.
            </p>
            <button
              type="button"
              className="btn-primary w-full"
              disabled={loading === "trial"}
              onClick={handleStartTrial}
            >
              {loading === "trial" ? "Starting trial…" : "Start free trial"}
            </button>
          </div>
        ) : null}

        <div className="mb-6 w-full max-w-md space-y-4">
          <label className="block text-sm text-slate">
            Have a code?
            <input
              type="text"
              value={promoInput}
              onChange={(e) => {
                setPromoInput(e.target.value);
                setPromoOffer(null);
                setPromoError("");
              }}
              placeholder="Enter code"
              autoComplete="off"
              className="mt-1 w-full rounded-card border border-bone bg-white px-4 py-2.5 text-sm text-ink outline-none focus:border-brand-violet"
            />
          </label>
          <button
            type="button"
            className="btn-outline w-full"
            disabled={promoLoading || !promoInput.trim()}
            onClick={handleApplyPromo}
          >
            {promoLoading ? "Checking..." : "Apply"}
          </button>
          {promoError ? <p className="text-sm text-red-600">{promoError}</p> : null}
          {promoOffer ? (
            <p className="text-sm text-brand-violet">{promoOffer.message}</p>
          ) : null}

          <label className="block text-sm text-slate">
            Referral Code (optional)
            <input
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              placeholder="Enter referral code if you have one"
              className="mt-1 w-full rounded-card border border-bone bg-white px-4 py-2.5 text-sm text-ink outline-none focus:border-brand-violet"
            />
          </label>
          {user?.referralCode && (
            <p className="text-xs text-slate">
              Your referral code:{" "}
              <span className="font-bold text-brand-violet">{user.referralCode}</span>
            </p>
          )}
        </div>

        {!promoOffer ? (
          <div className="mb-6 flex items-center gap-2">
            <button
              onClick={() => setYearly(false)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                !yearly ? "bg-brand-violet text-white" : "text-slate hover:bg-plaster"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                yearly ? "bg-brand-violet text-white" : "text-slate hover:bg-plaster"
              }`}
            >
              Yearly
              {savingsLabel ? (
                <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">{savingsLabel}</span>
              ) : null}
            </button>
          </div>
        ) : null}

        <div className="relative w-full max-w-md rounded-card border border-brand-violet bg-mist p-8 shadow-subtle">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-violet px-4 py-1 text-xs font-bold text-white">
            {promoOffer ? promoOffer.label || "Launch offer" : "Business Plan"}
          </div>
          <div className="mb-6">
            <h3 className="mb-2 text-2xl font-bold text-ink">Business</h3>
            <div className="text-4xl font-bold text-ink">{priceLabel}</div>
            <div className="mt-1 text-xs text-slate">Incl. of all taxes · cancel auto-renew anytime from your profile</div>
            <p className="mt-1 text-sm text-slate">
              {promoOffer
                ? "Applied to this checkout"
                : "Same price as the Android app"}
            </p>
          </div>
          <ul className="mb-8 space-y-3 text-sm text-slate">
            {businessFeatures.map((feature) => (
              <li key={feature}>✓ {feature}</li>
            ))}
          </ul>
          <button
            className="btn-primary w-full"
            disabled={loading === planKey || loading === "business"}
            onClick={() => handleSubscribe(promoOffer ? "business" : planKey)}
          >
            {loading
              ? "Processing..."
              : promoOffer
                ? `Pay ₹${promoOffer.amount_rupees}`
                : "Subscribe Now"}
          </button>
        </div>

        <div className="mt-6 w-full max-w-md rounded-card border border-bone bg-white p-6">
          <h3 className="mb-2 text-lg font-semibold text-ink">Lifetime</h3>
          <div className="mb-2 text-3xl font-bold text-ink">₹18,000</div>
          <p className="mb-4 text-sm text-slate">
            One-time purchase on this website for our first 200 early adopters. Unlocks Android and web
            for the current Business generation (see Terms).
          </p>
          <button
            className="btn-outline w-full"
            disabled={loading === "business_lifetime" || !lifetimeOpen}
            onClick={() => handleSubscribe("business_lifetime")}
          >
            {!lifetimeOpen ? "Sold out" : loading === "business_lifetime" ? "Processing..." : "Buy Lifetime"}
          </button>
        </div>

        <div className="mt-6 w-full max-w-md rounded-card border border-bone bg-white p-6">
          <h3 className="mb-2 text-lg font-semibold text-ink">Free Plan</h3>
          <p className="mb-3 text-sm text-slate">Available in the Argus mobile app:</p>
          <ul className="space-y-2 text-sm text-slate">
            {freeFeatures.map((feature) => (
              <li key={feature}>✓ {feature}</li>
            ))}
          </ul>
        </div>

        <div className="mt-8 flex gap-4">
          <a href="/" className="text-sm text-slate hover:text-ink">
            ← Back to Home
          </a>
          <button
            onClick={() => logout()}
            className="text-sm text-slate hover:text-ink hover:text-red-600"
          >
            Logout
          </button>
        </div>
      </div>
    </>
  );
}

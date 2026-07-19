"use client";

import Script from "next/script";
import { useState } from "react";
import { useAuth } from "@/lib/auth-provider";
import { startRazorpayCheckout } from "@/lib/razorpay";

const ALLOWED_PLANS = ["business", "business_monthly", "business_yearly", "business_plus"];

export function SubscriptionGate() {
  const { user, token, logout, refreshProfile } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [yearly, setYearly] = useState(true);

  async function handleSubscribe(planKey: string) {
    if (!token || !user) return;
    setLoading(planKey);
    setError("");
    try {
      await startRazorpayCheckout(planKey, token, user, referralCode.trim() || undefined);
      await refreshProfile();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start payment";
      if (message !== "Checkout dismissed") setError(message);
    } finally {
      setLoading(null);
    }
  }

  const currentPlan = user?.subscription?.plan;
  const hasValidPlan = currentPlan && ALLOWED_PLANS.includes(currentPlan);

  const planKey = yearly ? "business_yearly" : "business";
  const priceLabel = yearly ? "₹6,600 / year" : "₹600 / month";

  const freeFeatures = [
    "Billing & invoices",
    "Customers",
    "Voice & photo entry (mobile app)",
    "UPI payment links",
    "Works fully offline (mobile app)",
  ];

  const businessFeatures = [
    "Everything in Free",
    "Purchases & input tax credit",
    "GSTR-1, 2B, 3B summaries",
    "E-way bill credentials",
    "Full inventory with barcode & CSV import",
    "Sales & profit reports",
    "Recurring invoices",
    "Accountant collaboration",
    "Up to 3 GSTINs",
  ];

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-ink">
            Subscription Required
          </h1>
          <p className="max-w-md text-slate">
            {hasValidPlan
              ? "Your subscription is being verified. Please wait..."
              : user?.subscription?.plan
              ? `Your current plan (${user.subscription.plan}) doesn't include web access. Upgrade to Business to continue.`
              : "The Argus Web App is available to Business members only. Choose a billing cycle below to get started."}
          </p>
        </div>

        {error && (
          <p className="mb-6 rounded-card bg-red-500/10 px-4 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mb-6 w-full max-w-md">
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
            <p className="mt-2 text-xs text-slate">
              Your referral code: <span className="font-bold text-brand-violet">{user.referralCode}</span>
              <br />Share this with others to track CAC per referrer.
            </p>
          )}
        </div>

        {/* Billing cycle toggle */}
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
            <span className="ml-1 text-xs text-emerald-500">Save ~8%</span>
          </button>
        </div>

        {/* Single Business plan card */}
        <div className="w-full max-w-md rounded-card border border-brand-violet bg-mist p-8 shadow-subtle">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-violet px-4 py-1 text-xs font-bold text-white">
            Business Plan
          </div>
          <div className="mb-6">
            <h3 className="mb-2 text-2xl font-bold text-ink">Business</h3>
            <div className="text-4xl font-bold text-ink">
              {priceLabel}
            </div>
          </div>
          <ul className="mb-8 space-y-3 text-sm text-slate">
            {businessFeatures.map((feature) => (
              <li key={feature}>✓ {feature}</li>
            ))}
          </ul>
          <button
            className="btn-primary w-full"
            disabled={loading === planKey}
            onClick={() => handleSubscribe(planKey)}
          >
            {loading === planKey ? "Processing..." : "Subscribe Now"}
          </button>
        </div>

        {/* Free plan info */}
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
            className="text-sm text-slate hover:text-red-600"
          >
            Logout
          </button>
        </div>
      </div>
    </>
  );
}

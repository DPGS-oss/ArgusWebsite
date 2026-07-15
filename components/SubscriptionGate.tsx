"use client";

import Script from "next/script";
import { useState } from "react";
import { useAuth } from "@/lib/auth-provider";
import { startRazorpayCheckout } from "@/lib/razorpay";

const ALLOWED_PLANS = ["business", "business_plus"];

const plans = [
  {
    key: "business",
    name: "Business",
    price: "₹400",
    suffix: "/month",
    featured: true,
    features: [
      "✓ 3 GSTINs included",
      "✓ Unlimited invoices",
      "✓ All GSTR reports",
      "✓ WhatsApp (deep link share)",
      "✓ Accountant collaboration",
      "✓ Priority support",
    ],
    cta: "Subscribe Now",
    buttonClass: "btn-primary w-full",
  },
  {
    key: "business_plus",
    name: "Business+",
    price: "₹600",
    suffix: "/month",
    featured: false,
    features: [
      "✓ Everything in Business",
      "✓ Inventory management",
      "✓ Sales & profit reports",
      "✓ Up to 3 GSTINs",
      "✓ Priority support",
    ],
    cta: "Subscribe Now",
    buttonClass: "btn-outline w-full",
  },
];

export function SubscriptionGate() {
  const { user, token, logout, refreshProfile } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [referralCode, setReferralCode] = useState("");

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
              ? `Your current plan (${user.subscription.plan}) doesn't include web access. Upgrade to Business or Business+ to continue.`
              : "The Argus Web App is available to Business and Business+ members only. Choose a plan below to get started."}
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

        <div className="grid w-full max-w-2xl gap-6 sm:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.key}
              className={`relative rounded-card border p-8 ${
                plan.featured
                  ? "border-brand-violet bg-mist shadow-subtle"
                  : "border-bone bg-white"
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-violet px-4 py-1 text-xs font-bold text-white">
                  Recommended
                </div>
              )}
              <div className="mb-6">
                <h3 className="mb-2 text-2xl font-bold text-ink">{plan.name}</h3>
                <div className="text-4xl font-bold text-ink">
                  {plan.price}
                  <span className="text-base text-slate">{plan.suffix}</span>
                </div>
              </div>
              <ul className="mb-8 space-y-3 text-sm text-slate">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <button
                className={plan.buttonClass}
                disabled={loading === plan.key}
                onClick={() => handleSubscribe(plan.key)}
              >
                {loading === plan.key ? "Processing..." : plan.cta}
              </button>
            </div>
          ))}
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

"use client";

import Script from "next/script";
import { useState } from "react";
import { useAuth } from "@/lib/auth-provider";
import { startRazorpayCheckout, validatePromoCode, type PromoOffer } from "@/lib/razorpay";
import { startBusinessTrial } from "@/lib/subscription";
import { Reveal, Stagger, StaggerItem } from "./Reveal";

type BillingInterval = "monthly" | "yearly";

const plans = [
  {
    key: "free",
    name: "Free",
    price: "₹0",
    suffix: "",
    featured: false,
    features: [
      "✓ Unlimited invoices on Android",
      "✓ Customers & basic billing",
      "✓ UPI payment links",
      "✓ Upgrade anytime for full books + web",
    ],
    cta: "Get Started",
    buttonClass: "btn-outline w-full",
  },
  {
    key: "business",
    name: "Business",
    priceMonthly: "₹500",
    priceYearly: "₹5,000",
    suffixMonthly: "/month",
    suffixYearly: "/year",
    featured: true,
    features: [
      "✓ Unlimited invoices on phone & web",
      "✓ Full books: purchases, stock, khata",
      "✓ GSTR-1, 2B, 3B summaries",
      "✓ Quotes, credit notes & challans",
      "✓ Reports, recurring & CA portal",
      "✓ Local folder backup on web",
      "✓ Auto-renews monthly or yearly",
    ],
    cta: "Subscribe Now",
    buttonClass: "btn-primary w-full",
  },
  {
    key: "business_lifetime",
    name: "Lifetime",
    price: "₹18,000",
    suffix: " once",
    featured: false,
    features: [
      "✓ Same Business suite for the current product generation",
      "✓ Buy once on this website only (max 25 years or earlier sunset)",
      "✓ Unlocks Android + web (same login)",
      "✓ Not sold inside the Play app",
      "✓ Add-ons & major overhauls not included — see Terms",
    ],
    cta: "Buy Lifetime",
    buttonClass: "btn-outline w-full",
  },
];

export function Pricing() {
  const { user, token, setShowAuthModal, refreshProfile } = useAuth();
  const [promoInput, setPromoInput] = useState("");
  const [promoOffer, setPromoOffer] = useState<PromoOffer | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [trialLoading, setTrialLoading] = useState(false);
  const [trialMessage, setTrialMessage] = useState("");

  async function handleStartTrial() {
    if (!token || !user) {
      setShowAuthModal(true);
      return;
    }
    setTrialLoading(true);
    setTrialMessage("");
    try {
      const result = await startBusinessTrial(token);
      await refreshProfile();
      setTrialMessage(result.message || "Business trial started — 14 days");
      window.location.href = "/app/";
    } catch (error) {
      setTrialMessage(error instanceof Error ? error.message : "Could not start trial");
    } finally {
      setTrialLoading(false);
    }
  }

  async function handleApplyPromo() {
    if (!token || !user) {
      setShowAuthModal(true);
      return;
    }
    setPromoLoading(true);
    setPromoError("");
    try {
      const offer = await validatePromoCode(promoInput, token);
      setPromoOffer(offer);
    } catch (error) {
      setPromoOffer(null);
      setPromoError(error instanceof Error ? error.message : "Invalid offer code");
    } finally {
      setPromoLoading(false);
    }
  }

  function businessPlanKey(): string {
    return billingInterval === "yearly" ? "business_yearly" : "business_monthly";
  }

  async function handlePlanClick(planKey: string) {
    if (planKey === "free") {
      if (!user) {
        setShowAuthModal(true);
        return;
      }
      window.location.href = "#download";
      return;
    }

    if (!token || !user) {
      setShowAuthModal(true);
      return;
    }

    try {
      const checkoutPlan = planKey === "business" ? businessPlanKey() : planKey;
      await startRazorpayCheckout(checkoutPlan, token, user, {
        promoCode: promoOffer?.code,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start payment";
      if (message !== "Checkout dismissed") alert(message);
    }
  }

  function businessPriceDisplay() {
    if (promoOffer?.billing_type === "subscription") {
      return `₹${promoOffer.amount_rupees}`;
    }
    if (promoOffer) {
      return `₹${promoOffer.amount_rupees}`;
    }
    return billingInterval === "yearly" ? "₹5,000" : "₹500";
  }

  function businessSuffixDisplay() {
    if (promoOffer?.billing_type === "subscription") {
      return "/month";
    }
    if (promoOffer) {
      return ` for ${promoOffer.duration_months} months`;
    }
    return billingInterval === "yearly" ? "/year" : "/month";
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <section id="pricing" className="py-20 md:py-28">
        <div className="container-page">
          <Reveal>
            <div className="section-header">
              <h2>Simple Pricing</h2>
              <p>
                Start free on the phone, or try 14 days of Business on web — then subscribe from
                ₹500/month or buy Lifetime once.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <div className="mx-auto mb-10 max-w-xl rounded-card border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
              <h3 className="text-lg font-bold text-ink">14-day Business trial</h3>
              <p className="mt-2 text-sm text-slate">
                Full web suite + same login on Android. One trial per account, device, and
                network — no card required.
              </p>
              <button
                type="button"
                className="btn-primary mt-4"
                disabled={trialLoading}
                onClick={handleStartTrial}
              >
                {trialLoading ? "Starting…" : "Start free trial"}
              </button>
              {trialMessage ? (
                <p className="mt-3 text-sm text-slate">{trialMessage}</p>
              ) : null}
            </div>
          </Reveal>
          <Stagger className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3" stagger={0.1}>
            {plans.map((plan) => (
              <StaggerItem
                key={plan.key}
                className={`relative rounded-card border p-8 ${
                  plan.featured
                    ? "border-brand-violet bg-mist shadow-subtle"
                    : "border-bone bg-white"
                }`}
              >
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-violet px-4 py-1 text-xs font-bold text-white">
                    Most Popular
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="mb-2 text-2xl font-bold text-ink">{plan.name}</h3>
                  <div className="text-4xl font-bold text-ink">
                    {plan.key === "business" ? businessPriceDisplay() : plan.price}
                    {plan.key === "business" ? (
                      <span className="text-base text-slate">{businessSuffixDisplay()}</span>
                    ) : plan.suffix ? (
                      <span className="text-base text-slate">{plan.suffix}</span>
                    ) : null}
                  </div>
                  {plan.key === "business" && promoOffer ? (
                    <p className="mt-2 text-sm text-brand-violet">{promoOffer.message}</p>
                  ) : plan.key === "business" ? (
                    <p className="mt-2 text-sm text-slate">Auto-renews until you cancel in Razorpay.</p>
                  ) : null}
                </div>
                <ul className="mb-8 space-y-3 text-sm text-slate">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                {plan.key === "business" ? (
                  <>
                    <div className="mb-4 flex rounded-card border border-bone bg-white p-1">
                      <button
                        type="button"
                        className={`flex-1 rounded-card px-3 py-2 text-sm font-medium ${
                          billingInterval === "monthly"
                            ? "bg-brand-violet text-white"
                            : "text-slate"
                        }`}
                        onClick={() => setBillingInterval("monthly")}
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        className={`flex-1 rounded-card px-3 py-2 text-sm font-medium ${
                          billingInterval === "yearly"
                            ? "bg-brand-violet text-white"
                            : "text-slate"
                        }`}
                        onClick={() => setBillingInterval("yearly")}
                      >
                        Yearly
                      </button>
                    </div>
                    <div className="mb-4 space-y-2">
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
                      {promoError ? (
                        <p className="text-sm text-red-600">{promoError}</p>
                      ) : null}
                    </div>
                  </>
                ) : null}
                <button
                  className={plan.buttonClass}
                  onClick={() => handlePlanClick(plan.key)}
                >
                  {plan.key === "business" && promoOffer
                    ? promoOffer.billing_type === "subscription"
                      ? `Subscribe at ₹${promoOffer.amount_rupees}/mo`
                      : `Pay ₹${promoOffer.amount_rupees}`
                    : plan.key === "business"
                      ? billingInterval === "yearly"
                        ? "Subscribe Yearly"
                        : plan.cta
                      : plan.cta}
                </button>
              </StaggerItem>
            ))}
          </Stagger>
          <Reveal delay={0.2}>
            <p className="mt-8 text-center text-sm text-slate">
              Free covers everyday billing on Android (unlimited invoices). The web app is part of
              Business — so your books, GST summaries, and CA invite stay in one paid workspace.
              Same login unlocks both. Lifetime is a one-time licence for the current Business
              generation (see Terms); cancelled renewals are not refunded for unused time.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}

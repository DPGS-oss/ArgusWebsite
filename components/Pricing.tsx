"use client";

import Script from "next/script";
import { useState } from "react";
import { useAuth } from "@/lib/auth-provider";
import { startRazorpayCheckout, validatePromoCode, type PromoOffer } from "@/lib/razorpay";
import { Reveal, Stagger, StaggerItem } from "./Reveal";

const plans = [
  {
    key: "free",
    name: "Free",
    price: "₹0",
    suffix: "",
    featured: false,
    features: [
      "✓ Up to 5 invoices (mobile app)",
      "✓ Basic billing & customers",
      "✓ Works fully offline (mobile)",
      "✓ UPI payment links",
    ],
    cta: "Get Started",
    buttonClass: "btn-outline w-full",
  },
  {
    key: "business",
    name: "Business",
    price: "₹500",
    suffix: "/month",
    featured: true,
    features: [
      "✓ Unlimited invoices",
      "✓ Web app access",
      "✓ Purchases & input tax credit",
      "✓ GSTR-1, 2B, 3B summaries",
      "✓ Inventory, reports & recurring",
      "✓ Quotations, credit notes & challans",
      "✓ Accountant collaboration",
      "✓ Or ₹5,000 / year on Play",
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
      "✓ Same Business features forever",
      "✓ Buy once on this website only",
      "✓ Unlocks Android app (same login)",
      "✓ Not sold inside the Play app",
      "✓ Best for owners who stay for years",
    ],
    cta: "Buy Lifetime",
    buttonClass: "btn-outline w-full",
  },
];

export function Pricing() {
  const { user, token, setShowAuthModal } = useAuth();
  const [promoInput, setPromoInput] = useState("");
  const [promoOffer, setPromoOffer] = useState<PromoOffer | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

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
      await startRazorpayCheckout(planKey, token, user, {
        promoCode: promoOffer?.code,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start payment";
      if (message !== "Checkout dismissed") alert(message);
    }
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <section id="pricing" className="py-20 md:py-28">
        <div className="container-page">
          <Reveal>
            <div className="section-header">
              <h2>Simple Pricing</h2>
              <p>Recurring on Play. Lifetime only here on the website.</p>
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
                    {plan.key === "business" && promoOffer
                      ? `₹${promoOffer.amount_rupees}`
                      : plan.price}
                    {plan.key === "business" && promoOffer ? (
                      <span className="text-base text-slate">
                        {" "}
                        for {promoOffer.duration_months} months
                      </span>
                    ) : plan.suffix ? (
                      <span className="text-base text-slate">{plan.suffix}</span>
                    ) : null}
                  </div>
                  {plan.key === "business" && promoOffer ? (
                    <p className="mt-2 text-sm text-brand-violet">{promoOffer.message}</p>
                  ) : null}
                </div>
                <ul className="mb-8 space-y-3 text-sm text-slate">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                {plan.key === "business" ? (
                  <div className="mb-4 space-y-2">
                    <label className="block text-sm text-slate">
                      Offer code
                      <input
                        type="text"
                        value={promoInput}
                        onChange={(e) => {
                          setPromoInput(e.target.value);
                          setPromoOffer(null);
                          setPromoError("");
                        }}
                        placeholder="ARGUS-XXXXXXXX"
                        className="mt-1 w-full rounded-card border border-bone bg-white px-4 py-2.5 text-sm text-ink outline-none focus:border-brand-violet"
                      />
                    </label>
                    <button
                      type="button"
                      className="btn-outline w-full"
                      disabled={promoLoading || !promoInput.trim()}
                      onClick={handleApplyPromo}
                    >
                      {promoLoading ? "Checking..." : "Apply code"}
                    </button>
                    {promoError ? (
                      <p className="text-sm text-red-600">{promoError}</p>
                    ) : null}
                  </div>
                ) : null}
                <button
                  className={plan.buttonClass}
                  onClick={() => handlePlanClick(plan.key)}
                >
                  {plan.key === "business" && promoOffer
                    ? `Pay ₹${promoOffer.amount_rupees}`
                    : plan.cta}
                </button>
              </StaggerItem>
            ))}
          </Stagger>
          <Reveal delay={0.2}>
            <p className="mt-8 text-center text-sm text-slate">
              Monthly/yearly on Google Play (₹500 / ₹5,000). Lifetime ₹18,000 is sold
              only on this website via Razorpay — never inside the Android app.
              Same Firebase login unlocks Business on web and mobile.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}

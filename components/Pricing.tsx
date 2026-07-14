"use client";

import Script from "next/script";
import { useAuth } from "@/lib/auth-provider";
import { startRazorpayCheckout } from "@/lib/razorpay";

const plans = [
  {
    key: "free",
    name: "Free",
    price: "₹0",
    suffix: "/month",
    featured: false,
    features: [
      "✓ 1 GSTIN",
      "✓ Khata & billing",
      "✓ Basic GSTR reports",
      "✓ Offline mode",
      "✗ WhatsApp Business API",
      "✗ Accountant collaboration",
    ],
    cta: "Get Started",
    buttonClass: "btn-outline w-full",
  },
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
  {
    key: "accountant",
    name: "Accountant",
    price: "₹199",
    suffix: "/month",
    featured: false,
    features: [
      "✓ Manage unlimited clients",
      "✓ Access client data securely",
      "✓ Collaborative tools",
      "✓ Bulk operations",
      "✓ Custom reports",
      "✓ Dedicated support",
    ],
    cta: "Subscribe Now",
    buttonClass: "btn-outline w-full",
  },
];

export function Pricing() {
  const { user, token, setShowAuthModal } = useAuth();

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
      await startRazorpayCheckout(planKey, token, user);
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
          <div className="section-header">
            <h2>Simple Pricing</h2>
            <p>Choose the plan that fits your business</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <div
                key={plan.key}
                className={`relative rounded-lg border p-8 ${
                  plan.featured
                    ? "border-mercury-blue bg-graphite shadow-xl shadow-mercury-blue/10"
                    : "border-lead/20 bg-midnight"
                }`}
              >
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-mercury-blue px-4 py-1 text-xs font-medium text-white">
                    Most Popular
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="mb-2 text-2xl text-starlight">{plan.name}</h3>
                  <div className="text-4xl font-light text-starlight">
                    {plan.price}
                    <span className="text-base text-silver">{plan.suffix}</span>
                  </div>
                </div>
                <ul className="mb-8 space-y-3 text-sm text-silver">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <button
                  className={plan.buttonClass}
                  onClick={() => handlePlanClick(plan.key)}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-silver">
            Add extra GSTINs for ₹199/month each (max 5 total) | Yearly plans save up to 17%
          </p>
        </div>
      </section>
    </>
  );
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

const PLAN_LABELS: Record<string, string> = {
  business: "Business Plan (Monthly)",
  business_monthly: "Business Plan (Monthly)",
  business_yearly: "Business Plan (Yearly)",
  business_plus: "Business Plan (Monthly)",
  business_plus_yearly: "Business Plan (Yearly)",
  business_lifetime: "Business Lifetime",
  accountant: "Accountant Plan",
  accountant_yearly: "Accountant Plan (Yearly)",
  extra_gstin: "Extra GSTIN",
};

export type PromoOffer = {
  code: string;
  plan: string;
  duration_months: number;
  amount_paise: number;
  amount_rupees: number;
  base_amount_paise: number;
  gst_percent: number;
  label: string;
  message: string;
};

async function fetchPlanAmount(plan: string): Promise<number> {
  const response = await fetch("/api/auth/plans");
  if (!response.ok) throw new Error("Unable to load plan pricing");
  const data = await response.json();
  const plans = data.plans as Record<string, { price: number }>;
  const amountRupees = plans[plan]?.price;
  if (!amountRupees) throw new Error(`Unknown plan: ${plan}`);
  return amountRupees * 100;
}

export async function validatePromoCode(
  code: string,
  token: string
): Promise<PromoOffer> {
  const res = await fetch("/api/promo/validate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.valid) {
    throw new Error(data.error || "Invalid offer code");
  }
  return data as PromoOffer;
}

export async function startRazorpayCheckout(
  plan: string,
  token: string,
  user: { email?: string; phone?: string; name?: string },
  options?: { referralCode?: string; promoCode?: string }
) {
  const referralCode = options?.referralCode;
  const promoCode = options?.promoCode?.trim();

  // Amount is still fetched for non-promo UX; server is source of truth for charge.
  if (!promoCode) {
    await fetchPlanAmount(plan);
  }

  const orderRes = await fetch("/api/payment/create-order", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      plan: promoCode ? "business" : plan,
      referralCode,
      promoCode: promoCode || undefined,
    }),
  });

  if (!orderRes.ok) {
    const err = await orderRes.json().catch(() => ({}));
    throw new Error(err.detail || err.error || "Failed to create order");
  }

  const order = await orderRes.json();

  if (!window.Razorpay) {
    throw new Error("Razorpay checkout script not loaded");
  }

  const description = order.promo?.label
    ? order.promo.label
    : PLAN_LABELS[plan] || plan;

  return new Promise<void>((resolve, reject) => {
    const rzpOptions = {
      key: order.key_id,
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency || "INR",
      name: "Argus - GST Billing",
      description,
      prefill: {
        email: user.email || "",
        contact: user.phone || "",
        name: user.name || "",
      },
      theme: { color: "#5266eb" },
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        try {
          const verifyRes = await fetch("/api/payment/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan: promoCode ? "business" : plan,
              referralCode,
              promoCode: promoCode || undefined,
            }),
          });
          const data = await verifyRes.json();
          if (verifyRes.ok && data.verified) {
            const months = order.promo?.duration_months;
            alert(
              months
                ? `Payment successful! Business is active for ${months} months (beta offer).`
                : plan === "business_lifetime"
                  ? "Payment successful! Business Lifetime is unlocked on web and the Android app (same login)."
                  : `Payment successful! Your ${PLAN_LABELS[plan] || plan} subscription is now active.`
            );
            window.location.reload();
            resolve();
          } else {
            reject(
              new Error(
                `Payment received but verification failed. Payment ID: ${response.razorpay_payment_id}`
              )
            );
          }
        } catch (error) {
          reject(error);
        }
      },
      modal: {
        ondismiss: () => reject(new Error("Checkout dismissed")),
      },
    };

    const rzp = new window.Razorpay(rzpOptions);
    rzp.on("payment.failed", (response: unknown) => {
      const failed = response as { error?: { description?: string } };
      reject(new Error(failed.error?.description || "Payment failed"));
    });
    rzp.open();
  });
}

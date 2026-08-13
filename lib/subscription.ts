/**
 * Shared subscription helpers for web.
 * Accepts plan strings written by Razorpay (web) and Flutter/Play (IAP).
 */

export type SubscriptionInfo = {
  plan?: string;
  plan_key?: string;
  details?: string;
  active?: boolean;
  expiry_date?: string | null;
  expiryDate?: string | null;
};

const BUSINESS_PLAN_KEYS = new Set([
  "business",
  "business_monthly",
  "business_yearly",
  "business_lifetime",
  "business_plus", // legacy alias
]);

/** Normalize plan names from Firestore / FastAPI / Razorpay. */
export function normalizePlanKey(plan: string | undefined | null): string {
  if (!plan) return "";
  return plan.trim().toLowerCase().replace(/\s+/g, "_");
}

export function isBusinessPlanName(plan: string | undefined | null): boolean {
  const key = normalizePlanKey(plan);
  if (!key) return false;
  if (BUSINESS_PLAN_KEYS.has(key)) return true;
  // FastAPI IAP may store display name "Business"
  if (key === "business" || key.startsWith("business_")) return true;
  return false;
}

export function getExpiryIso(sub?: SubscriptionInfo | null): string | null {
  if (!sub) return null;
  return sub.expiry_date || sub.expiryDate || null;
}

/** True when subscription is Business and not expired. */
export function isSubscriptionActive(sub?: SubscriptionInfo | null): boolean {
  const plan = sub?.plan_key ?? sub?.plan;
  if (!plan) return false;
  if (!isBusinessPlanName(plan)) return false;

  // Per requirements: must be both active and unexpired.
  if (sub?.active !== true) return false;

  const expiry = getExpiryIso(sub);
  if (!expiry) return false;

  const end = new Date(expiry);
  if (Number.isNaN(end.getTime())) return false;

  return end.getTime() > Date.now();
}

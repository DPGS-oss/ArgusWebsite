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
  "business_trial",
  "business_plus", // legacy alias
]);

/** Start one-time 14-day Business trial (web). */
const DEVICE_ID_KEY = "argus_device_id";

function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "server_placeholder_device";
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && /^[A-Za-z0-9_-]{16,128}$/.test(existing)) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `d_${crypto.randomUUID().replace(/-/g, "")}`
        : `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return `d_fallback_${Date.now().toString(36)}abcdef`;
  }
}

export async function startBusinessTrial(token: string): Promise<{
  subscription: SubscriptionInfo;
  message?: string;
}> {
  const deviceId = getOrCreateDeviceId();
  const res = await fetch("/api/trial/start", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Argus-Device-Id": deviceId,
    },
    body: JSON.stringify({ device_id: deviceId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Could not start free trial",
    );
  }
  return {
    subscription: data.subscription as SubscriptionInfo,
    message: typeof data.message === "string" ? data.message : undefined,
  };
}

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

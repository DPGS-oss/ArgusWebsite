export const SUB_CACHE_KEY = "argus.subscription.v1";

export type CachedSubscription = {
  plan?: string;
  plan_key?: string;
  details?: string;
  active?: boolean;
  expiry_date?: string | null;
};

export function parseCachedSubscription(raw: string | null | undefined): CachedSubscription | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as CachedSubscription;
    if (!parsed || typeof parsed !== "object") return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

/** Keep the last paid entitlement when /api/auth/sync fails or returns no subscription. */
export function keepSubscriptionOnSyncFailure(
  previous: CachedSubscription | undefined,
  incoming: CachedSubscription | undefined,
): CachedSubscription | undefined {
  if (incoming && (incoming.active || incoming.plan || incoming.plan_key)) {
    return incoming;
  }
  return previous;
}

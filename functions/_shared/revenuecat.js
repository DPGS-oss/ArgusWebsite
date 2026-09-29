/**
 * Google Play purchases verified through RevenueCat.
 *
 * The app buys through the RevenueCat SDK while logged in as the Firebase uid.
 * The server then asks RevenueCat directly (GET /v1/subscribers/{uid}) which
 * entitlements are active, so a client can never grant itself Business.
 * RevenueCat's public SDK key (goog_...) is sufficient for this read.
 */

const RC_V1 = 'https://api.revenuecat.com/v1';

/**
 * Play product ids look like "business_monthly" or "business_monthly:base-plan".
 * Returns our plan key, or null for anything we do not sell on Play.
 */
function planKeyForStoreProduct(productId) {
  const base = String(productId || '').split(':')[0].trim().toLowerCase();
  if (!base) return null;
  if (base.startsWith('business_yearly') || base.startsWith('business_annual')) return 'business_yearly';
  if (base.startsWith('business_monthly') || base === 'business') return 'business_monthly';
  return null;
}

/**
 * Pick the active entitlement from a RevenueCat v1 subscriber payload.
 * Prefers the product the app just bought; otherwise any active one.
 */
function activeEntitlement(subscriberPayload, preferredProductId, now = new Date()) {
  const subscriber = (subscriberPayload && subscriberPayload.subscriber) || {};
  const entitlements = subscriber.entitlements || {};
  const subscriptions = subscriber.subscriptions || {};
  let preferred = null;
  let fallback = null;
  for (const ent of Object.values(entitlements)) {
    if (!ent) continue;
    const expires = ent.expires_date ? new Date(ent.expires_date) : null;
    const active = !expires || expires > now;
    if (!active) continue;
    const productId = ent.product_identifier || '';
    const sub = subscriptions[productId] || subscriptions[productId.split(':')[0]] || {};
    const row = {
      productId,
      planKey: planKeyForStoreProduct(productId),
      expiryIso: expires ? expires.toISOString() : null,
      autoRenew: !sub.unsubscribe_detected_at,
      billingIssue: !!sub.billing_issues_detected_at,
      store: sub.store || 'play_store',
    };
    if (!row.planKey) continue;
    if (preferredProductId && productId.split(':')[0] === String(preferredProductId).split(':')[0]) {
      preferred = row;
      break;
    }
    if (!fallback) fallback = row;
  }
  return preferred || fallback;
}

async function fetchSubscriber(uid, apiKey) {
  const res = await fetch(`${RC_V1}/subscribers/${encodeURIComponent(uid)}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Platform': 'android',
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`RevenueCat ${res.status}`);
    err.status = res.status;
    err.details = body;
    throw err;
  }
  return body;
}

module.exports = { planKeyForStoreProduct, activeEntitlement, fetchSubscriber };

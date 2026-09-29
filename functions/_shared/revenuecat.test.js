const test = require('node:test');
const assert = require('node:assert/strict');
const { planKeyForStoreProduct, activeEntitlement } = require('./revenuecat');

const NOW = new Date('2026-09-29T00:00:00Z');

test('maps Play product ids (with base plans) to plan keys', () => {
  assert.equal(planKeyForStoreProduct('business_monthly'), 'business_monthly');
  assert.equal(planKeyForStoreProduct('business_monthly:monthly-autorenew'), 'business_monthly');
  assert.equal(planKeyForStoreProduct('business_yearly:p1y'), 'business_yearly');
  assert.equal(planKeyForStoreProduct('business_lifetime'), null); // website only
  assert.equal(planKeyForStoreProduct(''), null);
});

test('picks the active entitlement for the product just bought', () => {
  const payload = {
    subscriber: {
      entitlements: {
        business: { expires_date: '2026-10-29T00:00:00Z', product_identifier: 'business_monthly:m' },
      },
      subscriptions: { 'business_monthly:m': { store: 'play_store' } },
    },
  };
  const ent = activeEntitlement(payload, 'business_monthly', NOW);
  assert.equal(ent.planKey, 'business_monthly');
  assert.equal(ent.expiryIso, '2026-10-29T00:00:00.000Z');
  assert.equal(ent.autoRenew, true);
});

test('ignores expired entitlements and reports cancelled auto-renew', () => {
  const payload = {
    subscriber: {
      entitlements: {
        old: { expires_date: '2026-09-01T00:00:00Z', product_identifier: 'business_monthly' },
        cur: { expires_date: '2027-09-01T00:00:00Z', product_identifier: 'business_yearly' },
      },
      subscriptions: { business_yearly: { unsubscribe_detected_at: '2026-09-20T00:00:00Z' } },
    },
  };
  const ent = activeEntitlement(payload, null, NOW);
  assert.equal(ent.planKey, 'business_yearly');
  assert.equal(ent.autoRenew, false);
});

test('no active entitlement means no unlock', () => {
  assert.equal(activeEntitlement({ subscriber: { entitlements: {} } }, 'business_monthly', NOW), null);
  assert.equal(activeEntitlement({}, 'business_monthly', NOW), null);
});

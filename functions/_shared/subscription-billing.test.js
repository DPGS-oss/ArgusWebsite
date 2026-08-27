const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extendExpiryFrom,
  billingMonthsForPlan,
  buildSubscriptionRecord,
} = require('./subscription-billing');

test('billingMonthsForPlan returns 12 for yearly', () => {
  assert.equal(billingMonthsForPlan('business_yearly'), 12);
  assert.equal(billingMonthsForPlan('business_monthly'), 1);
});

test('extendExpiryFrom stacks renewal from current expiry', () => {
  const future = '2099-06-01T00:00:00.000Z';
  const extended = extendExpiryFrom(future, 'business_monthly', '2026-01-01T00:00:00.000Z');
  assert.equal(extended.slice(0, 7), '2099-07');
});

test('buildSubscriptionRecord marks auto renew', () => {
  const sub = buildSubscriptionRecord({
    planKey: 'business_monthly',
    label: 'Business Monthly',
    expiryIso: '2026-09-01T00:00:00.000Z',
    source: 'razorpay_subscription',
    autoRenew: true,
    razorpaySubscriptionId: 'sub_test',
  });
  assert.equal(sub.auto_renew, true);
  assert.equal(sub.razorpay_subscription_id, 'sub_test');
});

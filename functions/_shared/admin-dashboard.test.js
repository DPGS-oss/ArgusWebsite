const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const {
  hashAdminKey,
  generateAdminKey,
  isAdminEmail,
  parseAdminEmails,
} = require('./admin-auth');
const { buildCaReport } = require('./ca-report');
const { subscriptionStatus, summarizeUsers } = require('./subscription-utils');

test('admin email is hardwired to support@argusinvoicing.com', () => {
  const { HARDCODED_ADMIN_EMAIL } = require('./admin-auth');
  const set = parseAdminEmails();
  assert.equal(HARDCODED_ADMIN_EMAIL, 'support@argusinvoicing.com');
  assert.equal(set.size, 1);
  assert.equal(isAdminEmail('support@argusinvoicing.com'), true);
  assert.equal(isAdminEmail('admin@test.com'), false);
  delete process.env.ADMIN_EMAILS;
  assert.equal(isAdminEmail('support@argusinvoicing.com'), true);
});

test('admin key hash is stable', () => {
  const key = 'ARGUS-ADMIN-test';
  assert.equal(hashAdminKey(key), hashAdminKey(key));
  assert.notEqual(hashAdminKey(key), hashAdminKey('other'));
});

test('generated admin keys have prefix', () => {
  const key = generateAdminKey();
  assert.ok(key.startsWith('ARGUS-ADMIN-'));
  assert.ok(key.length > 20);
});

test('CA report aggregates sales and GST', () => {
  const report = buildCaReport(
    {
      invoices: [
        { date: '2026-04-10', grandTotal: 1180, totalTax: 180, balanceDue: 100 },
      ],
      purchases: [{ date: '2026-04-11', totalAmount: 590, totalTax: 90 }],
      expenses: [{ date: '2026-04-12', amount: 200 }],
      parties: [{ id: '1' }],
      stock: [{ currentStock: 1, minStock: 5 }],
    },
    '2026-04-01',
    '2026-04-30',
  );
  assert.equal(report.sales_total, 1180);
  assert.equal(report.sales_tax, 180);
  assert.equal(report.gst_payable_estimate, 90);
  assert.equal(report.low_stock_items, 1);
});

test('subscription status respects active flag and expiry', () => {
  const active = subscriptionStatus({
    plan_key: 'business_lifetime',
    active: true,
    expiry_date: '2099-12-31T00:00:00.000Z',
  });
  assert.equal(active, 'active');
  const expired = subscriptionStatus({
    plan_key: 'business',
    active: true,
    expiry_date: '2020-01-01T00:00:00.000Z',
  });
  assert.equal(expired, 'expired');
});

test('summarizeUsers counts tiers', () => {
  const summary = summarizeUsers([
    { subscription: { plan_key: 'business_lifetime', active: true, expiry_date: '2099-12-31' } },
    { subscription: null, account_type: 'accountant' },
  ]);
  assert.equal(summary.total_users, 2);
  assert.equal(summary.subscribed_active, 1);
  assert.equal(summary.accountants, 1);
});

test('intro promo code is complex and single-use configured', () => {
  const { generateIntroPromoCode, INTRO_CODE_PREFIX, INTRO_OFFER } = require('./promo');
  const code = generateIntroPromoCode();
  assert.ok(code.startsWith(INTRO_CODE_PREFIX));
  assert.equal(code.length, INTRO_CODE_PREFIX.length + 10);
  assert.equal(INTRO_OFFER.max_redemptions, 1);
});

test('subscription confirmation email copy for activation', () => {
  const { buildSubscriptionMessage, formatExpiry } = require('./subscription-email');
  assert.equal(formatExpiry('2099-12-31T00:00:00.000Z'), 'Lifetime access');
  const msg = buildSubscriptionMessage({
    name: 'Ravi',
    event: 'activated',
    subscription: { label: 'Business Lifetime', plan_key: 'business_lifetime', expiry_date: '2099-12-31' },
    source: 'razorpay',
  });
  assert.match(msg.subject, /confirmed/i);
  assert.match(msg.text, /Ravi/);
  assert.match(msg.html, /active/i);
});

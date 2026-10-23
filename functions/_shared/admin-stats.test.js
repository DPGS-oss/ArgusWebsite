const test = require('node:test');
const assert = require('node:assert/strict');
const {
  usageFromAppData,
  summarizePlatformUsage,
  summarizePayments,
  buildAdminReports,
} = require('./admin-stats');

test('usageFromAppData counts invoices and parties', () => {
  const usage = usageFromAppData({
    invoices: [{ id: 1 }, { id: 2 }],
    parties: [{ id: 'p1' }],
    purchases: [],
    stock: [{ id: 's1' }],
  });
  assert.equal(usage.invoices, 2);
  assert.equal(usage.parties, 1);
  assert.equal(usage.stock_items, 1);
});

test('summarizePlatformUsage aggregates cloud sync stats', () => {
  const summary = summarizePlatformUsage([
    {
      has_cloud_data: true,
      invoices: 10,
      parties: 4,
      purchases: 2,
      expenses: 1,
      stock_items: 3,
      last_sync_at: new Date().toISOString(),
    },
    { has_cloud_data: false, invoices: 0, parties: 0, purchases: 0, expenses: 0, stock_items: 0 },
  ]);
  assert.equal(summary.users_with_cloud_data, 1);
  assert.equal(summary.total_invoices, 10);
  assert.equal(summary.active_sync_7d, 1);
});

test('summarizePayments totals verified revenue', () => {
  const summary = summarizePayments([
    { status: 'verified', amount_paise: 50000, source: 'razorpay', plan: 'business_monthly', created_at: new Date().toISOString() },
    { status: 'renewed', amount_paise: 100, source: 'razorpay_subscription_webhook', plan: 'intro', created_at: new Date().toISOString() },
  ]);
  assert.equal(summary.verified_payments, 2);
  assert.equal(summary.total_amount_paise, 50100);
  assert.equal(summary.by_source.razorpay, 1);
});

test('buildAdminReports includes top users by invoices', () => {
  const reports = buildAdminReports({
    users: [
      {
        id: 'u1',
        email: 'a@test.com',
        name: 'A',
        business_name: 'A Corp',
        subscription_status: 'active',
      },
      {
        id: 'u2',
        email: 'b@test.com',
        name: 'B',
        business_name: 'B Corp',
        subscription_status: 'free',
      },
    ],
    usageByUserId: {
      u1: { has_cloud_data: true, invoices: 20, parties: 5, last_sync_at: '2026-08-01T00:00:00.000Z' },
      u2: { has_cloud_data: true, invoices: 3, parties: 1, last_sync_at: null },
    },
    payments: [],
    linksCount: 2,
  });
  assert.equal(reports.top_users_by_invoices[0].user_id, 'u1');
  assert.equal(reports.top_users_by_invoices[0].invoices, 20);
  assert.equal(reports.active_ca_links, 2);
});

test('payments: revenue by month and plan, failed payments, older team-seat records counted', () => {
  const { summarizePayments } = require('./admin-stats');
  const now = Date.parse('2026-10-23T10:00:00Z');
  const s = summarizePayments([
    { status: 'verified', amount_paise: 1800000, sku: 'business_lifetime', created_at: '2026-10-20T10:00:00Z', source: 'razorpay' },
    { status: 'renewed', amount_paise: 50000, plan: 'business_monthly', created_at: '2026-09-15T10:00:00Z', source: 'razorpay_subscription_webhook' },
    { status: 'verified', kind: 'team_seats', amount: 5000, at: '2026-10-01T10:00:00Z' },
    { status: 'failed', amount_paise: 50000, created_at: '2026-10-22T10:00:00Z', source: 'razorpay' },
  ], now);
  assert.equal(s.total_amount_paise, 1800000 + 50000 + 5000);
  assert.equal(s.amount_this_month_paise, 1800000 + 5000);
  assert.equal(s.failed_payments, 1);
  assert.equal(s.amount_by_plan_paise.business_lifetime, 1800000);
  assert.equal(s.amount_by_plan_paise.team_seats, 5000);
  assert.equal(s.by_month_paise['2026-09'], 50000);
});

test('activity: active users, signups, Lifetime against the cap, consent, revenue estimate', () => {
  const { summarizeActivity } = require('./admin-stats');
  const now = Date.parse('2026-10-23T10:00:00Z');
  const users = [
    { id: 'a', created_at: '2026-10-22T00:00:00Z', subscription: { plan_key: 'business_monthly', active: true, expiry_date: '2026-11-20T00:00:00Z' }, legal_consent_version: '2026-10-23', legal_consent_analytics: true },
    { id: 'b', created_at: '2026-01-01T00:00:00Z', subscription: { plan_key: 'business', active: true, expiry_date: '2099-12-31T00:00:00.000Z' } },
    { id: 'c', created_at: '2026-01-01T00:00:00Z', subscription: { plan_key: 'business_yearly', active: true, expiry_date: '2027-01-01T00:00:00Z' } },
  ];
  const usage = { a: { last_sync_at: '2026-10-23T09:00:00Z' }, b: { last_sync_at: '2026-10-18T00:00:00Z' }, c: { last_sync_at: '2026-08-01T00:00:00Z' } };
  const a = summarizeActivity(users, usage, { now, legalVersion: '2026-10-23', lifetimeExpiry: '2099-12-31T00:00:00.000Z', prices: { monthly: 50000, yearly: 500000 } });
  assert.deepEqual([a.active_1d, a.active_7d, a.active_30d], [1, 2, 2]);
  assert.equal(a.signups_7d, 1);
  assert.equal(a.lifetime_sold, 1);
  assert.equal(a.consent_current, 1);
  assert.equal(a.analytics_opt_in, 1);
  assert.equal(a.monthly_revenue_estimate_paise, 50000 + Math.round(500000 / 12));
});

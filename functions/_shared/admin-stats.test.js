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

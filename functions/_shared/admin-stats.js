const { countableAppData } = require('./books_store');
const { subscriptionStatus, normalizePlanKey } = require('./subscription-utils');

function usageFromAppData(appData) {
  if (!appData || typeof appData !== 'object') {
    return {
      invoices: 0,
      parties: 0,
      purchases: 0,
      expenses: 0,
      stock_items: 0,
      quotes: 0,
      credit_notes: 0,
      delivery_challans: 0,
      payments: 0,
      khata_entries: 0,
      businesses: 0,
    };
  }

  return {
    invoices: (appData.invoices || []).length,
    parties: (appData.parties || []).length,
    purchases: (appData.purchases || []).length,
    expenses: (appData.expenses || []).length,
    stock_items: (appData.stock || appData.inventory || []).length,
    quotes: (appData.quotes || []).length,
    credit_notes: (appData.creditNotes || []).length,
    delivery_challans: (appData.deliveryChallans || []).length,
    payments: (appData.payments || []).length,
    khata_entries: (appData.khataEntries || appData.khata || []).length,
    businesses: (appData.businesses || []).length,
  };
}

function usageFromAppDataDoc(docData) {
  // Bills, edit log etc. may sit in chunk documents; their counts are in the manifest.
  const appData = countableAppData(docData || {});
  const counts = usageFromAppData(appData);
  return {
    ...counts,
    last_sync_at: docData?.updated_at || null,
    device: docData?.device || null,
    has_cloud_data: Boolean(appData),
  };
}

function emptyUsageSummary() {
  return {
    users_with_cloud_data: 0,
    total_invoices: 0,
    total_parties: 0,
    total_purchases: 0,
    total_expenses: 0,
    total_stock_items: 0,
    active_sync_7d: 0,
    active_sync_30d: 0,
  };
}

function summarizePlatformUsage(rows) {
  const summary = emptyUsageSummary();
  const now = Date.now();
  const d7 = now - 7 * 24 * 60 * 60 * 1000;
  const d30 = now - 30 * 24 * 60 * 60 * 1000;

  for (const row of rows) {
    if (!row?.has_cloud_data) continue;
    summary.users_with_cloud_data += 1;
    summary.total_invoices += row.invoices || 0;
    summary.total_parties += row.parties || 0;
    summary.total_purchases += row.purchases || 0;
    summary.total_expenses += row.expenses || 0;
    summary.total_stock_items += row.stock_items || 0;

    const syncMs = row.last_sync_at ? Date.parse(row.last_sync_at) : 0;
    if (syncMs >= d7) summary.active_sync_7d += 1;
    if (syncMs >= d30) summary.active_sync_30d += 1;
  }

  return summary;
}

function extendUserSummary(users) {
  const summary = {
    by_source: {},
    by_status: { active: 0, expired: 0, free: 0, inactive: 0 },
    auto_renew_active: 0,
    intro_promo_users: 0,
    promo_beta_users: 0,
    signups_by_month: {},
  };

  for (const user of users) {
    const status = user.subscription_status || subscriptionStatus(user.subscription);
    summary.by_status[status] = (summary.by_status[status] || 0) + 1;

    const source = user.subscription?.source || 'none';
    summary.by_source[source] = (summary.by_source[source] || 0) + 1;

    if (user.subscription?.auto_renew === true && status === 'active') {
      summary.auto_renew_active += 1;
    }

    const created = user.created_at ? String(user.created_at).slice(0, 7) : null;
    if (created) {
      summary.signups_by_month[created] = (summary.signups_by_month[created] || 0) + 1;
    }
  }

  return summary;
}

function summarizePayments(paymentDocs, now = Date.now()) {
  const summary = {
    total_payments: 0,
    verified_payments: 0,
    renewed_payments: 0,
    failed_payments: 0,
    total_amount_paise: 0,
    amount_30d_paise: 0,
    amount_this_month_paise: 0,
    by_source: {},
    by_plan: {},
    amount_by_plan_paise: {},
    by_month_paise: {},
    recent_30d: 0,
  };

  const d30 = now - 30 * 24 * 60 * 60 * 1000;
  const thisMonth = new Date(now + 5.5 * 3600 * 1000).toISOString().slice(0, 7);

  for (const pay of paymentDocs) {
    summary.total_payments += 1;
    const paid = pay.status === 'verified' || pay.status === 'renewed';
    if (paid) summary.verified_payments += 1;
    if (pay.status === 'renewed') summary.renewed_payments += 1;
    if (pay.status === 'failed') summary.failed_payments += 1;

    // Team-seat payments were saved as `amount` / `at` before; read both.
    const amount = Number(pay.amount_paise ?? pay.amount) || 0;
    const when = String(pay.created_at || pay.at || '');
    const createdMs = when ? Date.parse(when) : 0;
    const source = pay.source || 'unknown';
    summary.by_source[source] = (summary.by_source[source] || 0) + 1;
    const plan = pay.sku || (pay.kind === 'team_seats' ? 'team_seats' : normalizePlanKey(pay.plan || pay.subscription?.plan_key)) || 'unknown';
    summary.by_plan[plan] = (summary.by_plan[plan] || 0) + 1;
    if (createdMs >= d30) summary.recent_30d += 1;
    if (!paid || amount <= 0) continue;

    summary.total_amount_paise += amount;
    summary.amount_by_plan_paise[plan] = (summary.amount_by_plan_paise[plan] || 0) + amount;
    if (createdMs >= d30) summary.amount_30d_paise += amount;
    const month = createdMs ? new Date(createdMs + 5.5 * 3600 * 1000).toISOString().slice(0, 7) : 'unknown';
    summary.by_month_paise[month] = (summary.by_month_paise[month] || 0) + amount;
    if (month === thisMonth) summary.amount_this_month_paise += amount;
  }

  return summary;
}

/**
 * Who is using Argus: active by last sync (today, 7 and 30 days), new
 * accounts, Lifetime sold against the cap, consent and analytics opt-ins,
 * and a monthly-revenue estimate from active renewing plans.
 */
function summarizeActivity(users, usageByUserId, opts = {}) {
  const { now = Date.now(), legalVersion = '', lifetimeExpiry = '', lifetimeCap = 200, prices = {} } = opts;
  const day = 24 * 60 * 60 * 1000;
  const out = {
    active_1d: 0, active_7d: 0, active_30d: 0, signups_7d: 0, signups_30d: 0,
    lifetime_sold: 0, lifetime_cap: lifetimeCap, consent_current: 0, analytics_opt_in: 0,
    monthly_revenue_estimate_paise: 0,
  };
  for (const u of users) {
    const usage = (usageByUserId && usageByUserId[u.id]) || {};
    const last = Date.parse(usage.last_sync_at || u.updated_at || '') || 0;
    if (now - last <= day) out.active_1d += 1;
    if (now - last <= 7 * day) out.active_7d += 1;
    if (now - last <= 30 * day) out.active_30d += 1;
    const created = Date.parse(u.created_at || '') || 0;
    if (now - created <= 7 * day) out.signups_7d += 1;
    if (now - created <= 30 * day) out.signups_30d += 1;
    const sub = u.subscription || {};
    if (lifetimeExpiry && sub.expiry_date === lifetimeExpiry) out.lifetime_sold += 1;
    if (legalVersion && u.legal_consent_version === legalVersion) out.consent_current += 1;
    if (u.legal_consent_analytics === true) out.analytics_opt_in += 1;
    const active = sub.active !== false && Date.parse(sub.expiry_date || '') > now && sub.expiry_date !== lifetimeExpiry;
    if (active && sub.auto_renew !== false) {
      const key = String(sub.plan_key || sub.plan || '');
      if (/year/.test(key) && prices.yearly) out.monthly_revenue_estimate_paise += Math.round(prices.yearly / 12);
      else if (prices.monthly) out.monthly_revenue_estimate_paise += prices.monthly;
    }
  }
  return out;
}

function topUsersByUsage(userRows, limit = 10) {
  return [...userRows]
    .filter((row) => row.usage?.has_cloud_data)
    .sort((a, b) => (b.usage?.invoices || 0) - (a.usage?.invoices || 0))
    .slice(0, limit)
    .map((row) => ({
      user_id: row.id,
      email: row.email,
      name: row.name,
      business_name: row.business_name,
      invoices: row.usage?.invoices || 0,
      parties: row.usage?.parties || 0,
      last_sync_at: row.usage?.last_sync_at || null,
      subscription_status: row.subscription_status,
    }));
}

function buildAdminReports({ users, usageByUserId, payments, linksCount, activity = {} }) {
  const userRows = users.map((user) => ({
    ...user,
    usage: usageByUserId[user.id] || null,
  }));

  return {
    subscription: extendUserSummary(users),
    usage: summarizePlatformUsage(Object.values(usageByUserId)),
    payments: summarizePayments(payments),
    active_ca_links: linksCount,
    activity: summarizeActivity(users, usageByUserId, activity),
    recent_signups: [...users]
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .slice(0, 20)
      .map((u) => ({ user_id: u.id, email: u.email, name: u.name, created_at: u.created_at || null, plan: u.subscription?.plan_key || null })),
    top_users_by_invoices: topUsersByUsage(userRows),
    generated_at: new Date().toISOString(),
  };
}

async function fetchUsageForUsers(db, userIds) {
  const usageByUserId = {};
  const chunkSize = 50;

  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    const refs = chunk.map((uid) => db.collection('users').doc(uid).collection('app_data').doc('main'));
    const snaps = await db.getAll(...refs);

    snaps.forEach((snap, index) => {
      const uid = chunk[index];
      if (!snap.exists) {
        usageByUserId[uid] = {
          ...usageFromAppData(null),
          last_sync_at: null,
          device: null,
          has_cloud_data: false,
        };
        return;
      }
      usageByUserId[uid] = usageFromAppDataDoc(snap.data());
    });
  }

  return usageByUserId;
}

async function fetchRecentPayments(db, limit = 500) {
  try {
    const snap = await db.collection('payments').orderBy('created_at', 'desc').limit(limit).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn('payments orderBy failed, falling back:', err.message);
    const snap = await db.collection('payments').limit(limit).get();
    return snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  }
}

module.exports = {
  usageFromAppData,
  usageFromAppDataDoc,
  summarizePlatformUsage,
  extendUserSummary,
  summarizePayments,
  summarizeActivity,
  topUsersByUsage,
  buildAdminReports,
  fetchUsageForUsers,
  fetchRecentPayments,
};

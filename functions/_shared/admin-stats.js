const { resolveAppData } = require('./app_data');
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
  const appData = resolveAppData(docData || {});
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

function summarizePayments(paymentDocs) {
  const summary = {
    total_payments: 0,
    verified_payments: 0,
    renewed_payments: 0,
    total_amount_paise: 0,
    by_source: {},
    by_plan: {},
    recent_30d: 0,
  };

  const now = Date.now();
  const d30 = now - 30 * 24 * 60 * 60 * 1000;

  for (const pay of paymentDocs) {
    summary.total_payments += 1;
    if (pay.status === 'verified' || pay.status === 'renewed') {
      summary.verified_payments += 1;
    }
    if (pay.status === 'renewed') summary.renewed_payments += 1;

    const amount = Number(pay.amount_paise) || 0;
    if (amount > 0) summary.total_amount_paise += amount;

    const source = pay.source || 'unknown';
    summary.by_source[source] = (summary.by_source[source] || 0) + 1;

    const plan = normalizePlanKey(pay.plan || pay.subscription?.plan_key) || 'unknown';
    summary.by_plan[plan] = (summary.by_plan[plan] || 0) + 1;

    const createdMs = pay.created_at ? Date.parse(pay.created_at) : 0;
    if (createdMs >= d30) summary.recent_30d += 1;
  }

  return summary;
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

function buildAdminReports({ users, usageByUserId, payments, linksCount }) {
  const userRows = users.map((user) => ({
    ...user,
    usage: usageByUserId[user.id] || null,
  }));

  return {
    subscription: extendUserSummary(users),
    usage: summarizePlatformUsage(Object.values(usageByUserId)),
    payments: summarizePayments(payments),
    active_ca_links: linksCount,
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
  topUsersByUsage,
  buildAdminReports,
  fetchUsageForUsers,
  fetchRecentPayments,
};

const BUSINESS_KEYS = new Set([
  'business',
  'business_monthly',
  'business_yearly',
  'business_lifetime',
  'business_trial',
  'business_plus',
]);

function normalizePlanKey(plan) {
  return String(plan || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function isBusinessPlan(plan) {
  const key = normalizePlanKey(plan);
  if (!key) return false;
  if (BUSINESS_KEYS.has(key)) return true;
  return key === 'business' || key.startsWith('business_');
}

/** True when user has an unexpired Business (or trial) subscription. */
function hasActiveBusinessSubscription(user) {
  return subscriptionStatus(user && user.subscription) === 'active';
}

function subscriptionStatus(sub) {
  if (!sub || typeof sub !== 'object') return 'free';
  const plan = sub.plan_key || sub.plan;
  if (!isBusinessPlan(plan)) return 'free';
  if (sub.active !== true) return 'inactive';
  const expiry = sub.expiry_date || sub.expiryDate;
  if (!expiry) return 'inactive';
  const end = new Date(expiry).getTime();
  if (!Number.isFinite(end) || end <= Date.now()) return 'expired';
  return 'active';
}

function summarizeUsers(users) {
  const summary = {
    total_users: users.length,
    subscribed_active: 0,
    subscribed_expired: 0,
    free_users: 0,
    accountants: 0,
    by_plan: {},
    recent_signups_7d: 0,
    recent_signups_30d: 0,
  };

  const now = Date.now();
  const d7 = now - 7 * 24 * 60 * 60 * 1000;
  const d30 = now - 30 * 24 * 60 * 60 * 1000;

  for (const user of users) {
    const type = String(user.account_type || user.role || '').toLowerCase();
    if (type === 'accountant') summary.accountants += 1;

    const status = subscriptionStatus(user.subscription);
    if (status === 'active') summary.subscribed_active += 1;
    else if (status === 'expired') summary.subscribed_expired += 1;
    else summary.free_users += 1;

    const plan = normalizePlanKey(user.subscription?.plan_key || user.subscription?.plan) || 'free';
    summary.by_plan[plan] = (summary.by_plan[plan] || 0) + 1;

    const created = user.created_at ? new Date(user.created_at).getTime() : 0;
    if (created >= d7) summary.recent_signups_7d += 1;
    if (created >= d30) summary.recent_signups_30d += 1;
  }

  return summary;
}

function sanitizeUser(docId, data) {
  const sub = data.subscription || null;
  return {
    id: docId,
    name: data.name || '',
    email: data.email || '',
    business_name: data.business_name || '',
    gstin: data.gstin || '',
    phone: data.phone || '',
    account_type: data.account_type || data.role || 'owner',
    created_at: data.created_at || null,
    updated_at: data.updated_at || null,
    subscription: sub
      ? {
          plan: sub.plan || null,
          plan_key: sub.plan_key || sub.plan || null,
          active: sub.active === true,
          expiry_date: sub.expiry_date || sub.expiryDate || null,
          auto_renew: sub.auto_renew === true,
          source: sub.source || null,
          label: sub.label || null,
        }
      : null,
    subscription_status: subscriptionStatus(sub),
  };
}

module.exports = {
  subscriptionStatus,
  summarizeUsers,
  sanitizeUser,
  isBusinessPlan,
  normalizePlanKey,
  hasActiveBusinessSubscription,
};

/** Subscription plans — must match Flutter / Play Store (₹500 / ₹5,000).
 *  Lifetime (₹18,000) is website-only; never sold in the mobile app.
 *
 *  Vyapar model: Free Android billing is unlimited. Web books, GSTR JSON,
 *  CA portal, and Tally XML stay on Business. Do not add a ₹299 SKU.
 */
const LIFETIME_EXPIRY_ISO = '2099-12-31T00:00:00.000Z';

const FREE_ENTITLEMENTS = {
  android_billing: true,
  android_invoice_limit: null,
  web_invoicing: false,
  web_books: false,
  ca_portal: false,
  gstr_json: false,
  tally_xml: false,
};

const BUSINESS_ENTITLEMENTS = {
  android_billing: true,
  android_invoice_limit: null,
  web_invoicing: true,
  web_books: true,
  ca_portal: true,
  gstr_json: true,
  tally_xml: true,
};

const PLANS = {
  business: {
    price: 500,
    amount: 500 * 100,
    label: 'Business Monthly',
    plan_key: 'business',
    duration_months: 1,
  },
  business_monthly: {
    price: 500,
    amount: 500 * 100,
    label: 'Business Monthly',
    plan_key: 'business',
    duration_months: 1,
  },
  business_yearly: {
    price: 5000,
    amount: 5000 * 100,
    label: 'Business Yearly',
    plan_key: 'business',
    duration_months: 12,
  },
  business_lifetime: {
    price: 18000,
    amount: 18000 * 100,
    label: 'Business Lifetime',
    plan_key: 'business',
    duration_months: null,
    lifetime: true,
    expiry_iso: LIFETIME_EXPIRY_ISO,
  },
};

const BUSINESS_PLAN_KEYS = new Set([
  'business',
  'business_monthly',
  'business_yearly',
  'business_lifetime',
  'business_plus',
]);

function normalizePlanKey(planId) {
  return String(planId || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function isBusinessPlan(planId) {
  const key = normalizePlanKey(planId);
  if (!key) return false;
  if (BUSINESS_PLAN_KEYS.has(key)) return true;
  return key.startsWith('business_');
}

function getEntitlements(planId) {
  if (isBusinessPlan(planId)) return { ...BUSINESS_ENTITLEMENTS };
  return { ...FREE_ENTITLEMENTS };
}

function getPlan(planId) {
  return PLANS[planId] || null;
}

function getAllPlans() {
  const result = {};
  for (const [key, val] of Object.entries(PLANS)) {
    result[key] = {
      price: val.price,
      label: val.label,
      lifetime: Boolean(val.lifetime),
    };
  }
  return result;
}

function getExpiryIsoForPlan(planConfig, overrideMonths) {
  if (planConfig.lifetime) {
    return planConfig.expiry_iso || LIFETIME_EXPIRY_ISO;
  }
  const months = overrideMonths != null ? overrideMonths : planConfig.duration_months;
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + months);
  return expiryDate.toISOString();
}

module.exports = {
  PLANS,
  LIFETIME_EXPIRY_ISO,
  FREE_ENTITLEMENTS,
  BUSINESS_ENTITLEMENTS,
  getPlan,
  getAllPlans,
  getExpiryIsoForPlan,
  getEntitlements,
  isBusinessPlan,
};

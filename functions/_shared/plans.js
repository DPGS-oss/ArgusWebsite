/** Subscription plans — must match Flutter / Play Store (₹500 / ₹5,000).
 *  Lifetime (₹18,000) is website-only; never sold in the mobile app.
 */
const LIFETIME_EXPIRY_ISO = '2099-12-31T00:00:00.000Z';

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

module.exports = { PLANS, LIFETIME_EXPIRY_ISO, getPlan, getAllPlans, getExpiryIsoForPlan };
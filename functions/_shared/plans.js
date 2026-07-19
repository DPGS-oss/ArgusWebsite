const PLANS = {
  business: { price: 600, amount: 600 * 100, label: 'Business Monthly', plan_key: 'business', duration_months: 1 },
  business_yearly: { price: 6600, amount: 6600 * 100, label: 'Business Yearly', plan_key: 'business', duration_months: 12 },
  accountant: { price: 199, amount: 199 * 100, label: 'Accountant Monthly', plan_key: 'accountant', duration_months: 1 },
  accountant_yearly: { price: 1983, amount: Math.round(199 * 12 * 0.83 * 100), label: 'Accountant Yearly', plan_key: 'accountant', duration_months: 12 },
  extra_gstin: { price: 199, amount: 199 * 100, label: 'Extra GSTIN', plan_key: 'extra_gstin', duration_months: 1 },
};

function getPlan(planId) {
  return PLANS[planId] || null;
}

function getAllPlans() {
  const result = {};
  for (const [key, val] of Object.entries(PLANS)) {
    result[key] = { price: val.price, label: val.label };
  }
  return result;
}

module.exports = { PLANS, getPlan, getAllPlans };

const { getPlan } = require('./plans');

function addMonths(isoDate, months) {
  const base = isoDate ? new Date(isoDate) : new Date();
  const start = Number.isFinite(base.getTime()) ? base : new Date();
  const next = new Date(start);
  next.setMonth(next.getMonth() + months);
  return next.toISOString();
}

function billingMonthsForPlan(planKey) {
  const normalized = String(planKey || '').toLowerCase();
  if (normalized.includes('yearly') || normalized.includes('year')) return 12;
  return 1;
}

function extendExpiryFrom(currentExpiryIso, planKey, fromIso) {
  const months = billingMonthsForPlan(planKey);
  const anchor = currentExpiryIso ? new Date(currentExpiryIso) : null;
  const from = fromIso ? new Date(fromIso) : new Date();
  const base =
    anchor && Number.isFinite(anchor.getTime()) && anchor.getTime() > from.getTime()
      ? anchor
      : from;
  return addMonths(base.toISOString(), months);
}

function buildSubscriptionRecord({
  planKey,
  label,
  expiryIso,
  source,
  autoRenew = true,
  razorpaySubscriptionId = null,
  introPromo = null,
  followUpPlan = null,
}) {
  const planConfig = getPlan(planKey) || getPlan('business_monthly');
  return {
    plan: planConfig?.plan_key || 'business',
    plan_key: planKey,
    label: label || planConfig?.label || planKey,
    expiry_date: expiryIso,
    active: true,
    auto_renew: autoRenew,
    razorpay_subscription_id: razorpaySubscriptionId,
    intro_promo: introPromo || null,
    follow_up_plan: followUpPlan || null,
    updated_at: new Date().toISOString(),
    source,
  };
}

module.exports = {
  addMonths,
  billingMonthsForPlan,
  extendExpiryFrom,
  buildSubscriptionRecord,
};

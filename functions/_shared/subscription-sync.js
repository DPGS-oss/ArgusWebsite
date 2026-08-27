const { getDb, updateUser } = require('./firebase-admin');
const { notifySubscriptionChange } = require('./subscription-email');
const {
  buildSubscriptionRecord,
  extendExpiryFrom,
  billingMonthsForPlan,
  addMonths,
} = require('./subscription-billing');
const {
  createRazorpaySubscription,
  getOrCreateRazorpayCustomer,
} = require('./razorpay-subscriptions');

async function upsertCentralSubscription(uid, payload) {
  await getDb().collection('subscriptions').doc(uid).set(payload, { merge: true });
}

async function applySubscriptionCharge({
  uid,
  user,
  planKey,
  label,
  source,
  razorpaySubscriptionId,
  razorpayPaymentId,
  introPromo = null,
  followUpPlan = null,
  isRenewal = false,
}) {
  const previous = user?.subscription || null;
  const nowIso = new Date().toISOString();
  const expiryIso = isRenewal
    ? extendExpiryFrom(previous?.expiry_date, planKey, nowIso)
    : addMonths(nowIso, billingMonthsForPlan(planKey));

  const subscription = buildSubscriptionRecord({
    planKey,
    label,
    expiryIso,
    source,
    autoRenew: true,
    razorpaySubscriptionId,
    introPromo,
    followUpPlan,
  });

  const updateData = {
    subscription,
    updated_at: nowIso,
  };

  if (introPromo) {
    updateData.intro_promo_used = true;
    updateData.intro_promo_code = introPromo;
  }

  const updatedUser = await updateUser(uid, updateData);

  await upsertCentralSubscription(uid, {
    user_id: uid,
    plan: subscription.plan,
    plan_key: subscription.plan_key,
    active: true,
    source,
    store: 'web',
    auto_renew: true,
    razorpay_subscription_id: razorpaySubscriptionId,
    expiry_date: expiryIso,
    updated_at: nowIso,
  });

  if (razorpayPaymentId) {
    const { recordPayment } = require('./promo');
    await recordPayment(razorpayPaymentId, {
      user_id: uid,
      status: isRenewal ? 'renewed' : 'verified',
      source,
      plan: subscription.plan_key,
      amount_paise: null,
      razorpay_subscription_id: razorpaySubscriptionId,
      subscription,
      created_at: nowIso,
    });
  }

  try {
    await notifySubscriptionChange(updatedUser, subscription, {
      event: isRenewal ? 'renewed' : 'activated',
      previousSubscription: previous,
      source,
    });
  } catch (mailErr) {
    console.error('subscription email failed:', mailErr);
  }

  return { subscription, user: updatedUser };
}

async function transitionIntroToStandard(user, uid, followUpPlan = 'business_monthly') {
  const customerId = user.razorpay_customer_id;
  if (!customerId) {
    console.warn('intro transition skipped: missing razorpay_customer_id', uid);
    return null;
  }

  const subscription = await createRazorpaySubscription({
    planKey: followUpPlan,
    customerId,
    uid,
    followUpPlan: null,
  });

  const nowIso = new Date().toISOString();
  const expiryIso = addMonths(nowIso, billingMonthsForPlan(followUpPlan));
  const nextSub = buildSubscriptionRecord({
    planKey: followUpPlan,
    label: 'Business Monthly',
    expiryIso,
    source: 'razorpay_subscription_renewal',
    autoRenew: true,
    razorpaySubscriptionId: subscription.id,
    introPromo: null,
    followUpPlan: null,
  });

  await updateUser(uid, {
    subscription: nextSub,
    updated_at: nowIso,
  });

  await upsertCentralSubscription(uid, {
    user_id: uid,
    plan: nextSub.plan,
    plan_key: nextSub.plan_key,
    active: true,
    source: 'razorpay_subscription_renewal',
    store: 'web',
    auto_renew: true,
    razorpay_subscription_id: subscription.id,
    expiry_date: expiryIso,
    updated_at: nowIso,
  });

  return subscription;
}

module.exports = {
  applySubscriptionCharge,
  transitionIntroToStandard,
  upsertCentralSubscription,
};

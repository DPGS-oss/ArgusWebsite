const { getDb } = require('./firebase-admin');
const { razorpayFetch } = require('./razorpay-client');

const PLAN_CATALOG = {
  business_monthly: {
    period: 'monthly',
    interval: 1,
    amount_paise: 50000,
    name: 'Argus Business Monthly',
    total_count: 120,
  },
  business_yearly: {
    period: 'yearly',
    interval: 1,
    amount_paise: 500000,
    name: 'Argus Business Yearly',
    total_count: 10,
  },
  intro_1rupee_monthly: {
    period: 'monthly',
    interval: 1,
    amount_paise: 100,
    name: 'Argus Business Intro (₹1/month)',
    total_count: 12,
  },
};

const CONFIG_DOC = 'system/razorpay_plans';

async function readPlanCache() {
  const db = getDb();
  const snap = await db.doc(CONFIG_DOC).get();
  return snap.exists ? snap.data().plans || {} : {};
}

async function writePlanCache(plans) {
  const db = getDb();
  await db.doc(CONFIG_DOC).set(
    {
      plans,
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  );
}

async function createRazorpayPlan(planKey, def) {
  const plan = await razorpayFetch('/v1/plans', {
    method: 'POST',
    body: JSON.stringify({
      period: def.period,
      interval: def.interval,
      item: {
        name: def.name,
        amount: def.amount_paise,
        currency: 'INR',
        description: def.name,
      },
      notes: {
        plan_key: planKey,
      },
    }),
  });
  return plan.id;
}

async function ensureRazorpayPlan(planKey) {
  const def = PLAN_CATALOG[planKey];
  if (!def) {
    const err = new Error(`Unknown subscription plan: ${planKey}`);
    err.status = 400;
    throw err;
  }

  const cache = await readPlanCache();
  if (cache[planKey]) return cache[planKey];

  const planId = await createRazorpayPlan(planKey, def);
  const next = { ...cache, [planKey]: planId };
  await writePlanCache(next);
  return planId;
}

async function getOrCreateRazorpayCustomer(user, uid) {
  if (user?.razorpay_customer_id) {
    return user.razorpay_customer_id;
  }

  const payload = {
    name: user?.name || user?.email || 'Argus user',
    email: user?.email || undefined,
    contact: user?.phone || undefined,
    fail_existing: '0',
    notes: { uid },
  };

  const customer = await razorpayFetch('/v1/customers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return customer.id;
}

async function createRazorpaySubscription({
  planKey,
  customerId,
  uid,
  promoCode = null,
  followUpPlan = null,
}) {
  const def = PLAN_CATALOG[planKey];
  const planId = await ensureRazorpayPlan(planKey);

  const subscription = await razorpayFetch('/v1/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      plan_id: planId,
      customer_id: customerId,
      total_count: def.total_count,
      customer_notify: 1,
      notes: {
        uid,
        plan_key: planKey,
        promo_code: promoCode || '',
        follow_up_plan: followUpPlan || '',
      },
    }),
  });

  return subscription;
}

async function fetchRazorpaySubscription(subscriptionId) {
  return razorpayFetch(`/v1/subscriptions/${subscriptionId}`);
}

async function fetchRazorpayPayment(paymentId) {
  return razorpayFetch(`/v1/payments/${paymentId}`);
}

const { safeEqualString, hmacSha256Hex } = require('./crypto-safe');

function verifySubscriptionPaymentSignature(paymentId, subscriptionId, signature, secret) {
  if (!secret || !signature) return false;
  const expected = hmacSha256Hex(secret, `${paymentId}|${subscriptionId}`);
  return safeEqualString(expected, signature);
}

function verifyWebhookSignature(rawBody, signature, secret) {
  if (!secret || !signature) return false;
  const expected = hmacSha256Hex(secret, rawBody);
  return safeEqualString(expected, signature);
}

module.exports = {
  PLAN_CATALOG,
  ensureRazorpayPlan,
  getOrCreateRazorpayCustomer,
  createRazorpaySubscription,
  fetchRazorpaySubscription,
  fetchRazorpayPayment,
  verifySubscriptionPaymentSignature,
  verifyWebhookSignature,
};

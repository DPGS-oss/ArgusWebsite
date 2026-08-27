const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const crypto = require('crypto');
const { verifyToken, getUser, createUser, updateUser, getDb, getAuth } = require('./_shared/firebase-admin');
const { getPlan, getAllPlans, getExpiryIsoForPlan } = require('./_shared/plans');
const { apiCa } = require('./ca');
exports.apiCa = apiCa;
const { apiAdmin } = require('./admin');
exports.apiAdmin = apiAdmin;
const { apiAsk } = require('./ask');
exports.apiAsk = apiAsk;
const { rotateAdminAccessKey } = require('./_shared/admin-key');
const { notifySubscriptionChange } = require('./_shared/subscription-email');
const { checkRateLimit } = require('./_shared/rate-limit');
const {
  OFFER,
  INTRO_OFFER,
  LAUNCH_OFFER,
  LAUNCH_CODE,
  normalizeCode,
  validateCodeForUser,
  reserveCode,
  attachOrderToReservation,
  redeemCode,
  seedIntroPromoCode,
  seedLaunchPromoCode,
  assertPromoReadyForVerify,
  findRedemptionByPaymentId,
  findPaymentRecord,
  recordPayment,
  CAMPAIGN,
} = require('./_shared/promo');
const {
  createRazorpaySubscription,
  fetchRazorpaySubscription,
  fetchRazorpayPayment,
  getOrCreateRazorpayCustomer,
  verifySubscriptionPaymentSignature,
  verifyWebhookSignature,
} = require('./_shared/razorpay-subscriptions');
const { getRazorpayCredentials } = require('./_shared/razorpay-client');
const { applySubscriptionCharge, transitionIntroToStandard } = require('./_shared/subscription-sync');
const { hasActiveBusinessSubscription } = require('./_shared/subscription-utils');
const { sendEmail } = require('./_shared/resend-client');
const {
  startTrialWithGuards,
  clientIpFromReq,
  TRIAL_DAYS,
} = require('./_shared/trial');
const { safeEqualString, hmacSha256Hex } = require('./_shared/crypto-safe');

const RAZORPAY_KEY_ID = (process.env.RAZORPAY_KEY_ID || '').trim().replace(/[\r\n]/g, '');
const RAZORPAY_KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || '').trim().replace(/[\r\n]/g, '');

/** Ops seed/test gate — must be set in Functions env. No baked-in default. */
const PROMO_OPS_TOKEN = (process.env.PROMO_OPS_TOKEN || '').trim();
const PROMO_TARGET_COUNT = 50;
const PROMO_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function requirePromoOps(req, res) {
  const token = (req.get('x-promo-ops-token') || req.body?.ops_token || '').trim();
  if (!PROMO_OPS_TOKEN || !token) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  const a = Buffer.from(token, 'utf8');
  const b = Buffer.from(PROMO_OPS_TOKEN, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

function generatePromoCode() {
  const bytes = crypto.randomBytes(8);
  let body = '';
  for (let i = 0; i < 8; i++) body += PROMO_CODE_ALPHABET[bytes[i] % PROMO_CODE_ALPHABET.length];
  return `ARGUS-${body}`;
}
const FIREBASE_SECRETS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
];
const RAZORPAY_SECRETS = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'RESEND_API_KEY'];
// Webhook HMAC is fail-closed in handler when RAZORPAY_WEBHOOK_SECRET is missing.

const SUBSCRIPTION_PLANS = new Set(['business', 'business_monthly', 'business_yearly']);

function extractToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

function rateLimitHeaders(result) {
  if (!result) return {};
  return {
    'X-RateLimit-Limit': result.limit || '',
    'X-RateLimit-Remaining': result.remaining !== undefined ? String(result.remaining) : '',
    'Retry-After': result.retryAfterSeconds ? String(result.retryAfterSeconds) : '',
  };
}

// ==================== /api/config ====================
exports.apiConfig = onRequest({ region: 'us-central1', maxInstances: 10, secrets: FIREBASE_SECRETS }, (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const clean = (v) => (v || '').trim().replace(/[\r\n]/g, '');
  const firebase_api_key = clean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  const firebase_auth_domain = clean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
  const firebase_project_id = clean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  const firebase_app_id = clean(process.env.NEXT_PUBLIC_FIREBASE_APP_ID);

  if (!firebase_api_key || !firebase_project_id) {
    return res.status(503).json({ error: 'Firebase not configured' });
  }

  return res.status(200).json({
    firebase_api_key,
    firebase_auth_domain,
    firebase_project_id,
    firebase_app_id,
  });
});

// ==================== /api/auth/plans ====================
exports.apiAuthPlans = onRequest({ region: 'us-central1', maxInstances: 10 }, (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  return res.status(200).json({ plans: getAllPlans() });
});

// ==================== /api/auth/sync ====================
exports.apiAuthSync = onRequest({ region: 'us-central1', maxInstances: 10, secrets: FIREBASE_SECRETS }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const uid = decoded.uid;
  const email = decoded.email || '';
  const name = decoded.name || (email ? email.split('@')[0] : 'User');

  const body = req.body || {};
  const displayName = body.name || name;

  const rl = await checkRateLimit(uid, 'auth_sync');
  if (!rl.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Sync is limited to once per hour.',
      retry_after_seconds: rl.retryAfterSeconds,
    });
  }

  let user = await getUser(uid);

  if (!user) {
    const now = new Date().toISOString();
    const referralCode = 'ARG' + uid.substring(0, 6).toUpperCase();
    const newUserData = {
      name: displayName,
      email,
      business_name: '',
      gstin: '',
      phone: '',
      subscription: null,
      customer_id: null,
      referral_code: referralCode,
      referred_by: null,
      created_at: now,
      updated_at: now,
    };
    user = await createUser(uid, newUserData);
    return res.status(200).json({ user, requires_subscription: true });
  }

  return res.status(200).json({ user });
});

// ==================== /api/user/profile ====================
exports.apiUserProfile = onRequest({ region: 'us-central1', maxInstances: 10, secrets: FIREBASE_SECRETS }, async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const uid = decoded.uid;

  if (req.method === 'GET') {
    const rl = await checkRateLimit(uid, 'user_profile_get');
    if (!rl.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retry_after_seconds: rl.retryAfterSeconds,
      });
    }

    const user = await getUser(uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json({ user });
  }

  if (req.method === 'PUT') {
    const rl = await checkRateLimit(uid, 'user_profile_put');
    if (!rl.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Too many profile updates.',
        retry_after_seconds: rl.retryAfterSeconds,
      });
    }

    const body = req.body || {};
    const updateData = { updated_at: new Date().toISOString() };
    if (body.business_name !== undefined) updateData.business_name = body.business_name;
    if (body.gstin !== undefined) updateData.gstin = body.gstin;
    if (body.phone !== undefined) updateData.phone = body.phone;
    // Never allow self-promotion to admin or accountant via profile API.
    if (body.role !== undefined || body.account_type !== undefined) {
      return res.status(403).json({ error: 'Account role cannot be changed from the profile API' });
    }

    const user = await updateUser(uid, updateData);
    return res.status(200).json({ user });
  }

  return res.status(405).json({ error: 'Method not allowed' });
});

// ==================== /api/trial/start ====================
exports.apiTrialStart = onRequest({ region: 'us-central1', maxInstances: 10, secrets: FIREBASE_SECRETS }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  const uid = decoded.uid;
  const rl = await checkRateLimit(uid, 'trial_start');
  if (!rl.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded', retry_after_seconds: rl.retryAfterSeconds });
  }

  const body = req.body || {};
  const deviceId =
    body.device_id ||
    body.deviceId ||
    req.get('x-argus-device-id') ||
    '';
  const ip = clientIpFromReq(req);

  const started = await startTrialWithGuards({
    db: getDb(),
    uid,
    deviceId,
    ip,
    email: decoded.email || '',
  });
  if (!started.ok) {
    return res.status(started.status).json({ error: started.error });
  }

  try {
    await notifySubscriptionChange(
      { ...started.user, email: started.user.email || decoded.email },
      started.subscription,
      { event: 'activated', source: 'trial' },
    );
  } catch (_) {
    // email optional
  }
  return res.status(200).json({
    message: `Business trial started — ${TRIAL_DAYS} days`,
    subscription: started.subscription,
    user: started.user,
  });
});

// ==================== /api/contact ====================
exports.apiContact = onRequest(
  { region: 'us-central1', maxInstances: 10, secrets: ['RESEND_API_KEY'] },
  async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const body = req.body || {};
    const name = String(body.name || '').trim().slice(0, 120);
    const email = String(body.email || '').trim().slice(0, 200);
    const subject = String(body.subject || '').trim().slice(0, 200);
    const message = String(body.message || '').trim().slice(0, 4000);
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Name, email, subject, and message are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    const ip = clientIpFromReq(req) || 'unknown';
    const rl = await checkRateLimit(`contact_${ip}`, 'contact_form');
    if (!rl.allowed) {
      return res.status(429).json({ error: 'Too many messages. Try again later.' });
    }
    const mail = await sendEmail({
      to: 'support@argusinvoicing.com',
      subject: `[Argus contact] ${subject}`,
      reply_to: email,
      text: [
        `From: ${name} <${email}>`,
        `IP: ${ip}`,
        '',
        message,
      ].join('\n'),
      html: [
        `<p><strong>From:</strong> ${name} &lt;${email}&gt;</p>`,
        `<p><strong>Subject:</strong> ${subject}</p>`,
        `<pre style="white-space:pre-wrap;font-family:inherit">${message
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')}</pre>`,
      ].join('\n'),
    });
    if (!mail.sent) {
      return res.status(503).json({ error: 'Could not send message right now. Email support@argusinvoicing.com.' });
    }
    return res.status(200).json({ ok: true, message: 'Message sent' });
  },
);

// ==================== /api/promo/seed (ops) ====================
exports.apiPromoSeed = onRequest({ region: 'us-central1', maxInstances: 2 }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requirePromoOps(req, res)) return;

  const db = getDb();
  const existing = await db.collection('promo_codes').where('campaign', '==', CAMPAIGN).get();
  const exportCodes = String(req.query.export || req.body?.export || '') === '1';

  if (existing.size >= PROMO_TARGET_COUNT) {
    const summary = { available: 0, reserved: 0, redeemed: 0, disabled: 0 };
    const codes = [];
    existing.docs.forEach((doc) => {
      const d = doc.data();
      summary[d.status] = (summary[d.status] || 0) + 1;
      if (exportCodes) codes.push({ code: doc.id, status: d.status });
    });
    return res.status(200).json({
      already_seeded: true,
      campaign: CAMPAIGN,
      count: existing.size,
      summary,
      codes: exportCodes ? codes : undefined,
      offer: {
        amount_paise: OFFER.amount_paise,
        duration_months: OFFER.duration_months,
        label: OFFER.label,
      },
    });
  }

  const need = PROMO_TARGET_COUNT - existing.size;
  const existingIds = new Set(existing.docs.map((d) => d.id));
  const created = [];
  const expires = new Date();
  expires.setMonth(expires.getMonth() + 6);
  const nowIso = new Date().toISOString();

  while (created.length < need) {
    const code = generatePromoCode();
    if (existingIds.has(code)) continue;
    const doc = {
      code,
      campaign: CAMPAIGN,
      status: 'available',
      plan: OFFER.plan,
      plan_key: OFFER.plan_key,
      label: OFFER.label,
      duration_months: OFFER.duration_months,
      base_amount_paise: OFFER.base_amount_paise,
      gst_percent: OFFER.gst_percent,
      amount_paise: OFFER.amount_paise,
      max_redemptions: 1,
      redemption_count: 0,
      reserved_by: null,
      reserved_at: null,
      reserved_order_id: null,
      redeemed_by: null,
      redeemed_at: null,
      redeemed_payment_id: null,
      expires_at: expires.toISOString(),
      created_at: nowIso,
      updated_at: nowIso,
    };
    try {
      await db.collection('promo_codes').doc(code).create(doc);
      existingIds.add(code);
      created.push(code);
    } catch (err) {
      if (err && err.code === 6) continue; // ALREADY_EXISTS
      throw err;
    }
  }

  return res.status(200).json({
    seeded: true,
    campaign: CAMPAIGN,
    created_count: created.length,
    total_count: existing.size + created.length,
    codes: created,
    offer: {
      amount_paise: OFFER.amount_paise,
      amount_rupees: OFFER.amount_paise / 100,
      duration_months: OFFER.duration_months,
      label: OFFER.label,
    },
  });
});

// ==================== /api/promo/self-test (ops) ====================
exports.apiPromoSelfTest = onRequest({ region: 'us-central1', maxInstances: 2 }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requirePromoOps(req, res)) return;

  const db = getDb();
  const results = [];
  const uidA = `test_promo_a_${Date.now()}`;
  const uidB = `test_promo_b_${Date.now()}`;
  const code = generatePromoCode();
  const multiCode = generatePromoCode();
  const nowIso = new Date().toISOString();
  const expires = new Date();
  expires.setMonth(expires.getMonth() + 1);

  try {
    await db.collection('promo_codes').doc(code).create({
      code,
      campaign: CAMPAIGN,
      status: 'available',
      plan: OFFER.plan,
      plan_key: OFFER.plan_key,
      label: OFFER.label,
      duration_months: OFFER.duration_months,
      base_amount_paise: OFFER.base_amount_paise,
      gst_percent: OFFER.gst_percent,
      amount_paise: OFFER.amount_paise,
      max_redemptions: 1,
      redemption_count: 0,
      reserved_by: null,
      reserved_at: null,
      reserved_order_id: null,
      redeemed_by: null,
      redeemed_at: null,
      redeemed_payment_id: null,
      expires_at: expires.toISOString(),
      created_at: nowIso,
      updated_at: nowIso,
      test_only: true,
    });
    results.push({ step: 'create_test_code', ok: true, code });

    const v1 = await validateCodeForUser(code, uidA, {});
    results.push({ step: 'validate_available', ok: v1.valid === true, detail: v1 });

    await reserveCode(code, uidA, 'order_test_1');
    results.push({ step: 'reserve_uidA', ok: true });

    let rejectedB = false;
    try {
      await reserveCode(code, uidB, 'order_test_2');
    } catch (err) {
      rejectedB = err.status === 409 || /unavailable|already/i.test(err.message || '');
      results.push({ step: 'reserve_uidB_rejected', ok: rejectedB, error: err.message });
    }
    if (!rejectedB) results.push({ step: 'reserve_uidB_rejected', ok: false, error: 'expected rejection' });

    const payId = `pay_test_${Date.now()}`;
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 3);
    await redeemCode(code, uidA, {
      email: 'promo-selftest@argus.test',
      amount_paise: OFFER.amount_paise,
      razorpay_order_id: 'order_test_1',
      razorpay_payment_id: payId,
      granted_expiry: expiry.toISOString(),
    });
    results.push({ step: 'redeem_uidA', ok: true });

    const after = await db.collection('promo_codes').doc(code).get();
    const afterData = after.data();
    results.push({
      step: 'status_redeemed',
      ok: afterData.status === 'redeemed' && afterData.redemption_count === 1,
      status: afterData.status,
      redemption_count: afterData.redemption_count,
    });

    let secondRedeemBlocked = false;
    try {
      await redeemCode(code, uidB, {
        email: 'other@argus.test',
        amount_paise: OFFER.amount_paise,
        razorpay_order_id: 'order_test_3',
        razorpay_payment_id: `pay_test_other_${Date.now()}`,
        granted_expiry: expiry.toISOString(),
      });
    } catch (err) {
      secondRedeemBlocked = true;
      results.push({ step: 'second_redeem_blocked', ok: true, error: err.message });
    }
    if (!secondRedeemBlocked) results.push({ step: 'second_redeem_blocked', ok: false });

    const vBad = await validateCodeForUser('NOT-A-REAL-CODE', uidA, {});
    results.push({ step: 'invalid_code', ok: vBad.valid === false });

    const amountOk = OFFER.amount_paise === 11800 && OFFER.duration_months === 3;
    results.push({ step: 'offer_constants', ok: amountOk, amount_paise: OFFER.amount_paise, duration_months: OFFER.duration_months });

    const launchOk = LAUNCH_OFFER.amount_paise === 10000 && LAUNCH_OFFER.max_redemptions === 10;
    results.push({
      step: 'launch_offer_constants',
      ok: launchOk,
      amount_paise: LAUNCH_OFFER.amount_paise,
      max_redemptions: LAUNCH_OFFER.max_redemptions,
    });

    await db.collection('promo_codes').doc(multiCode).create({
      code: multiCode,
      campaign: 'launch_100_3m',
      status: 'available',
      plan: 'business',
      plan_key: 'business',
      label: LAUNCH_OFFER.label,
      duration_months: 3,
      amount_paise: 10000,
      max_redemptions: 2,
      redemption_count: 0,
      reservations: {},
      expires_at: expires.toISOString(),
      created_at: nowIso,
      updated_at: nowIso,
      test_only: true,
    });
    await reserveCode(multiCode, uidA, 'multi_order_a');
    await reserveCode(multiCode, uidB, 'multi_order_b');
    results.push({ step: 'multi_reserve_two_users', ok: true });
    await redeemCode(multiCode, uidA, {
      email: 'promo-selftest@argus.test',
      amount_paise: 10000,
      razorpay_order_id: 'multi_order_a',
      razorpay_payment_id: `pay_multi_a_${Date.now()}`,
      granted_expiry: expiry.toISOString(),
    });
    await redeemCode(multiCode, uidB, {
      email: 'other@argus.test',
      amount_paise: 10000,
      razorpay_order_id: 'multi_order_b',
      razorpay_payment_id: `pay_multi_b_${Date.now()}`,
      granted_expiry: expiry.toISOString(),
    });
    const afterMulti = (await db.collection('promo_codes').doc(multiCode).get()).data();
    results.push({
      step: 'multi_two_redeems',
      ok: afterMulti.redemption_count === 2 && afterMulti.status === 'redeemed',
      status: afterMulti.status,
      redemption_count: afterMulti.redemption_count,
    });
    let thirdBlocked = false;
    try {
      await redeemCode(multiCode, `test_promo_c_${Date.now()}`, {
        email: 'third@argus.test',
        amount_paise: 10000,
        razorpay_order_id: 'multi_order_c',
        razorpay_payment_id: `pay_multi_c_${Date.now()}`,
        granted_expiry: expiry.toISOString(),
      });
    } catch (_) {
      thirdBlocked = true;
    }
    results.push({ step: 'multi_third_blocked', ok: thirdBlocked });
  } catch (err) {
    results.push({ step: 'fatal', ok: false, error: err.message || String(err) });
  } finally {
    try {
      await db.collection('promo_codes').doc(code).delete();
      await db.collection('promo_codes').doc(multiCode).delete();
    } catch (_) {
      /* ignore */
    }
  }

  const passed = results.every((r) => r.ok);
  return res.status(passed ? 200 : 500).json({ passed, results });
});

// ==================== /api/promo/validate ====================
exports.apiPromoValidate = onRequest({ region: 'us-central1', maxInstances: 10, secrets: FIREBASE_SECRETS }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const uid = decoded.uid;
  const rl = await checkRateLimit(uid, 'promo_validate');
  if (!rl.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Too many code checks.',
      retry_after_seconds: rl.retryAfterSeconds,
    });
  }

  const body = req.body || {};
  const code = normalizeCode(body.code || body.promoCode || '');
  const user = await getUser(uid);
  const result = await validateCodeForUser(code, uid, user);

  if (!result.valid) {
    return res.status(400).json({ valid: false, error: result.error });
  }

  return res.status(200).json({
    valid: true,
    code: result.code,
    plan: result.plan,
    duration_months: result.duration_months,
    amount_paise: result.amount_paise,
    amount_rupees: result.amount_rupees,
    base_amount_paise: result.base_amount_paise,
    gst_percent: result.gst_percent,
    label: result.label,
    message: result.message,
    billing_type: result.billing_type,
    remaining_uses: result.remaining_uses,
  });
});

// ==================== /api/payment/create-order ====================
exports.apiPaymentCreateOrder = onRequest({ region: 'us-central1', maxInstances: 10, secrets: RAZORPAY_SECRETS }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ error: 'Payment service not configured' });
  }

  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const uid = decoded.uid;

  const rl = await checkRateLimit(uid, 'payment_create_order');
  if (!rl.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Too many payment attempts.',
      retry_after_seconds: rl.retryAfterSeconds,
    });
  }

  const body = req.body || {};
  const plan = body.plan || 'business';
  const referralCode = (body.referralCode || '').trim();
  const promoCode = normalizeCode(body.promoCode || body.code || '');
  const planConfig = getPlan(plan);
  if (!planConfig) return res.status(400).json({ error: 'Invalid plan' });

  if (!promoCode && SUBSCRIPTION_PLANS.has(plan) && !planConfig.lifetime) {
    return res.status(400).json({
      error: 'Monthly and yearly plans auto-renew. Use subscription checkout.',
      use_subscription: true,
    });
  }

  let amount = Math.round(planConfig.amount);
  let durationMonths = planConfig.lifetime ? null : planConfig.duration_months;
  let offerLabel = planConfig.label;
  let reservedCode = null;
  let offerCampaign = '';

  if (promoCode) {
    const user = await getUser(uid);
    const validation = await validateCodeForUser(promoCode, uid, user);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    if (validation.billing_type === 'subscription') {
      return res.status(400).json({
        error: 'This offer uses auto-renew subscription checkout.',
        use_subscription: true,
      });
    }

    // Reserve a checkout slot before creating the Razorpay order.
    const provisionalId = `pending_${uid}_${Date.now()}`;
    try {
      await reserveCode(promoCode, uid, provisionalId);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message || 'Unable to reserve offer code' });
    }

    amount = validation.amount_paise;
    durationMonths = validation.duration_months;
    offerLabel = validation.label;
    reservedCode = validation.code;
    offerCampaign = validation.campaign || '';
  }

  if (amount < 100) return res.status(400).json({ error: 'Amount must be at least 100 paise (Rs. 1)' });

  const receipt = `web_${promoCode ? 'promo_' : ''}${plan}_${Date.now()}`.slice(0, 40);
  const authHeaderRz = 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');

  try {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeaderRz,
      },
      body: JSON.stringify({
        amount,
        currency: 'INR',
        receipt,
        payment_capture: 1,
        notes: {
          uid,
          plan: promoCode ? 'business' : plan,
          plan_key: planConfig.plan_key,
          product_id: promoCode ? 'business' : plan,
          duration_months: planConfig.lifetime ? 'lifetime' : String(durationMonths),
          referral_code: referralCode || '',
          promo_code: reservedCode || '',
          offer: offerCampaign,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Razorpay order creation failed:', errorData);
      return res.status(500).json({ error: 'Failed to create order', details: errorData.error?.description });
    }

    const order = await response.json();

    if (reservedCode) {
      try {
        await attachOrderToReservation(reservedCode, uid, order.id);
      } catch (err) {
        console.error('Failed to attach order to promo reservation:', err);
        return res.status(409).json({ error: err.message || 'Offer code reservation failed' });
      }
    }

    return res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: RAZORPAY_KEY_ID,
      promo: reservedCode
        ? {
            code: reservedCode,
            duration_months: durationMonths,
            amount_paise: amount,
            label: offerLabel,
          }
        : null,
    });
  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// ==================== /api/payment/create-subscription ====================
exports.apiPaymentCreateSubscription = onRequest({ region: 'us-central1', maxInstances: 10, secrets: RAZORPAY_SECRETS }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { keyId } = getRazorpayCredentials();
  if (!keyId || !RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ error: 'Payment service not configured' });
  }

  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const uid = decoded.uid;
  const rl = await checkRateLimit(uid, 'payment_create_subscription');
  if (!rl.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Too many payment attempts.',
      retry_after_seconds: rl.retryAfterSeconds,
    });
  }

  const body = req.body || {};
  let plan = body.plan || 'business_monthly';
  if (plan === 'business') plan = 'business_monthly';
  const promoCode = normalizeCode(body.promoCode || body.code || '');

  let subscriptionPlanKey = plan;
  let offerLabel = getPlan(plan)?.label || plan;
  let followUpPlan = null;
  let introPromo = null;

  const user = await getUser(uid);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (promoCode) {
    const validation = await validateCodeForUser(promoCode, uid, user);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    if (validation.billing_type !== 'subscription') {
      return res.status(400).json({ error: 'This offer code is not for subscription checkout' });
    }

    const provisionalId = `sub_pending_${uid}_${Date.now()}`;
    try {
      await reserveCode(promoCode, uid, provisionalId);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message || 'Unable to reserve offer code' });
    }

    subscriptionPlanKey = validation.subscription_plan || INTRO_OFFER.subscription_plan;
    followUpPlan = validation.follow_up_plan || INTRO_OFFER.follow_up_plan;
    offerLabel = validation.label;
    introPromo = validation.code;
  } else if (!SUBSCRIPTION_PLANS.has(plan) || plan === 'business_lifetime') {
    return res.status(400).json({ error: 'Invalid subscription plan' });
  }

  try {
    const razorpayCustomerId = await getOrCreateRazorpayCustomer(user, uid);
    const subscription = await createRazorpaySubscription({
      planKey: subscriptionPlanKey,
      customerId: razorpayCustomerId,
      uid,
      promoCode: introPromo,
      followUpPlan,
    });

    if (introPromo) {
      try {
        await attachOrderToReservation(introPromo, uid, subscription.id);
      } catch (err) {
        console.error('Failed to attach subscription to promo reservation:', err);
        return res.status(409).json({ error: err.message || 'Offer code reservation failed' });
      }
    }

    if (!user.razorpay_customer_id) {
      await updateUser(uid, { razorpay_customer_id: razorpayCustomerId, updated_at: new Date().toISOString() });
    }

    return res.status(200).json({
      subscription_id: subscription.id,
      key_id: keyId,
      plan: subscriptionPlanKey,
      auto_renew: true,
      promo: introPromo
        ? {
            code: introPromo,
            label: offerLabel,
            amount_paise: INTRO_OFFER.amount_paise,
            intro_cycles: INTRO_OFFER.intro_cycles,
            follow_up_plan: followUpPlan,
          }
        : null,
    });
  } catch (error) {
    console.error('Create subscription error:', error);
    return res.status(error.status || 500).json({
      error: error.message || 'Failed to create subscription',
      details: error.details || undefined,
    });
  }
});

// ==================== /api/payment/verify-subscription ====================
exports.apiPaymentVerifySubscription = onRequest({ region: 'us-central1', maxInstances: 10, secrets: RAZORPAY_SECRETS }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ error: 'Payment service not configured' });
  }

  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const uid = decoded.uid;
  const rl = await checkRateLimit(uid, 'payment_verify_subscription');
  if (!rl.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded.',
      retry_after_seconds: rl.retryAfterSeconds,
    });
  }

  const body = req.body || {};
  const {
    razorpay_subscription_id: razorpaySubscriptionId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature,
    promoCode: promoCodeRaw,
  } = body;

  if (!razorpaySubscriptionId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(400).json({ error: 'Missing subscription payment fields' });
  }

  if (
    !verifySubscriptionPaymentSignature(
      razorpayPaymentId,
      razorpaySubscriptionId,
      razorpaySignature,
      RAZORPAY_KEY_SECRET
    )
  ) {
    return res.status(400).json({ error: 'Invalid payment signature' });
  }

  const existingPayment = await findPaymentRecord(razorpayPaymentId);
  if (existingPayment) {
    if (existingPayment.user_id !== uid) {
      return res.status(409).json({ error: 'Payment already used by another account' });
    }
    return res.status(200).json({
      verified: true,
      subscription: existingPayment.subscription || null,
      replay: true,
    });
  }

  try {
    const subscriptionEntity = await fetchRazorpaySubscription(razorpaySubscriptionId);
    const payment = await fetchRazorpayPayment(razorpayPaymentId);
    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      return res.status(400).json({ error: 'Payment not captured' });
    }
    if (subscriptionEntity.notes?.uid && subscriptionEntity.notes.uid !== uid) {
      return res.status(403).json({ error: 'Subscription account mismatch' });
    }

    const planKey = subscriptionEntity.notes?.plan_key || body.plan || 'business_monthly';
    const promoCode = normalizeCode(promoCodeRaw || subscriptionEntity.notes?.promo_code || '');
    const followUpPlan = subscriptionEntity.notes?.follow_up_plan || null;
    const user = await getUser(uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (promoCode) {
      const validation = await validateCodeForUser(promoCode, uid, user);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
    }

    const label =
      promoCode && planKey === INTRO_OFFER.subscription_plan
        ? INTRO_OFFER.label
        : getPlan(planKey)?.label || planKey;

    const result = await applySubscriptionCharge({
      uid,
      user,
      planKey,
      label,
      source: promoCode ? 'razorpay_subscription_promo' : 'razorpay_subscription',
      razorpaySubscriptionId,
      razorpayPaymentId,
      introPromo: promoCode || null,
      followUpPlan: followUpPlan || null,
      isRenewal: false,
    });

    if (promoCode) {
      await redeemCode(promoCode, uid, {
        email: user.email || decoded.email || null,
        amount_paise: Number(payment.amount),
        razorpay_subscription_id: razorpaySubscriptionId,
        razorpay_payment_id: razorpayPaymentId,
        granted_expiry: result.subscription.expiry_date,
      });
    }

    if (!user.razorpay_customer_id && subscriptionEntity.customer_id) {
      await updateUser(uid, {
        razorpay_customer_id: subscriptionEntity.customer_id,
        updated_at: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      message: 'Subscription activated with auto-renew',
      verified: true,
      subscription: result.subscription,
      user: result.user,
    });
  } catch (error) {
    console.error('Subscription verification error:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Subscription verification failed' });
  }
});

// ==================== /api/webhooks/razorpay ====================
exports.apiRazorpayWebhook = onRequest({ region: 'us-central1', maxInstances: 10, secrets: RAZORPAY_SECRETS }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
  const signature = req.get('x-razorpay-signature') || '';
  const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});

  // Fail closed — never accept unsigned webhooks (would allow free Business grants).
  if (!webhookSecret) {
    console.error('RAZORPAY_WEBHOOK_SECRET is not configured');
    return res.status(503).json({ error: 'Webhook not configured' });
  }
  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  const event = req.body || {};
  const eventName = event.event || '';
  const payload = event.payload || {};

  try {
    if (eventName === 'subscription.charged') {
      const subEntity = payload.subscription?.entity;
      const payEntity = payload.payment?.entity;
      const uid = subEntity?.notes?.uid;
      const paymentId = payEntity?.id;
      if (uid && paymentId) {
        const existing = await findPaymentRecord(paymentId);
        if (!existing) {
          const user = await getUser(uid);
          if (user) {
            const planKey = subEntity.notes?.plan_key || user.subscription?.plan_key || 'business_monthly';
            await applySubscriptionCharge({
              uid,
              user,
              planKey,
              label: getPlan(planKey)?.label || planKey,
              source: 'razorpay_subscription_webhook',
              razorpaySubscriptionId: subEntity.id,
              razorpayPaymentId: paymentId,
              introPromo: user.intro_promo_code || null,
              followUpPlan: subEntity.notes?.follow_up_plan || user.subscription?.follow_up_plan || null,
              isRenewal: true,
            });
          }
        }
      }
    }

    if (eventName === 'subscription.completed') {
      const subEntity = payload.subscription?.entity;
      const uid = subEntity?.notes?.uid;
      const followUpPlan = subEntity?.notes?.follow_up_plan;
      if (uid && followUpPlan) {
        const user = await getUser(uid);
        if (user?.subscription?.auto_renew !== false) {
          await transitionIntroToStandard(user, uid, followUpPlan);
        }
      }
    }

    if (eventName === 'subscription.cancelled' || eventName === 'subscription.halted') {
      const subEntity = payload.subscription?.entity;
      const uid = subEntity?.notes?.uid;
      if (uid) {
        const user = await getUser(uid);
        if (user?.subscription) {
          await updateUser(uid, {
            subscription: {
              ...user.subscription,
              auto_renew: false,
              active: eventName === 'subscription.halted' ? user.subscription.active : user.subscription.active,
              updated_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Razorpay webhook error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ==================== /api/promo/seed-intro (ops) ====================
exports.apiPromoSeedIntro = onRequest({ region: 'us-central1', maxInstances: 2 }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requirePromoOps(req, res)) return;

  try {
    const result = await seedIntroPromoCode();
    return res.status(200).json({
      ...result,
      single_use: true,
      offer: {
        code: result.code,
        amount_rupees: INTRO_OFFER.amount_paise / 100,
        intro_cycles: INTRO_OFFER.intro_cycles,
        follow_up_plan: INTRO_OFFER.follow_up_plan,
        label: INTRO_OFFER.label,
        max_redemptions: 1,
      },
    });
  } catch (error) {
    console.error('Intro promo seed error:', error);
    return res.status(500).json({ error: error.message || 'Failed to seed intro promo' });
  }
});

// ==================== /api/promo/seed-launch (ops) ====================
exports.apiPromoSeedLaunch = onRequest({ region: 'us-central1', maxInstances: 2 }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requirePromoOps(req, res)) return;

  try {
    const result = await seedLaunchPromoCode();
    return res.status(200).json({
      ...result,
      offer: {
        code: LAUNCH_CODE,
        amount_rupees: LAUNCH_OFFER.amount_paise / 100,
        duration_months: LAUNCH_OFFER.duration_months,
        max_redemptions: LAUNCH_OFFER.max_redemptions,
        label: LAUNCH_OFFER.label,
      },
    });
  } catch (error) {
    console.error('Launch promo seed error:', error);
    return res.status(500).json({ error: error.message || 'Failed to seed launch promo' });
  }
});

// ==================== /api/payment/verify ====================
exports.apiPaymentVerify = onRequest({ region: 'us-central1', maxInstances: 10, secrets: RAZORPAY_SECRETS }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ error: 'Payment service not configured' });
  }

  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const uid = decoded.uid;

  const rl = await checkRateLimit(uid, 'payment_verify');
  if (!rl.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Too many verification attempts.',
      retry_after_seconds: rl.retryAfterSeconds,
    });
  }

  const body = req.body || {};
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    plan,
    referralCode,
  } = body;
  const promoCode = normalizeCode(body.promoCode || body.code || '');

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing required fields: razorpay_order_id, razorpay_payment_id, razorpay_signature' });
  }

  const planConfig = getPlan(plan || 'business');
  if (!planConfig) return res.status(400).json({ error: 'Invalid plan' });

  try {
    const expectedSignature = hmacSha256Hex(RAZORPAY_KEY_SECRET, `${razorpay_order_id}|${razorpay_payment_id}`);

    if (!safeEqualString(expectedSignature, razorpay_signature)) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Replay protection
    const existingPayment = await findPaymentRecord(razorpay_payment_id);
    if (existingPayment && existingPayment.status === 'verified') {
      if (existingPayment.user_id && existingPayment.user_id !== uid) {
        return res.status(409).json({ error: 'Payment already used by another account' });
      }
      return res.status(200).json({
        message: 'Payment already verified',
        verified: true,
        subscription: existingPayment.subscription || null,
        customer_id: existingPayment.customer_id || null,
      });
    }

    const existingPromoRedeem = await findRedemptionByPaymentId(razorpay_payment_id);
    if (existingPromoRedeem && existingPromoRedeem.user_id !== uid) {
      return res.status(409).json({ error: 'Payment already used by another account' });
    }

    // Confirm amount/status with Razorpay (do not trust client).
    const authHeaderRz = 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    const payRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      headers: { Authorization: authHeaderRz },
    });
    if (!payRes.ok) {
      return res.status(400).json({ error: 'Unable to confirm payment with Razorpay' });
    }
    const payment = await payRes.json();
    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      return res.status(400).json({ error: 'Payment not captured' });
    }
    if (payment.order_id && payment.order_id !== razorpay_order_id) {
      return res.status(400).json({ error: 'Payment order mismatch' });
    }

    let months = planConfig.duration_months;
    let expectedAmount = Math.round(planConfig.amount);
    let source = 'razorpay';
    let offerLabel = planConfig.label;

    if (promoCode) {
      const userForPromo = await getUser(uid);
      if (userForPromo?.promo_offer_used && userForPromo?.promo_code_used !== promoCode) {
        return res.status(400).json({ error: 'You have already used a beta offer' });
      }

      const db = getDb();
      const snap = await db.collection('promo_codes').doc(promoCode).get();
      if (!snap.exists) {
        return res.status(400).json({ error: 'Invalid offer code' });
      }
      const promoData = snap.data();
      try {
        assertPromoReadyForVerify(promoData, uid, {
          razorpay_payment_id,
          razorpay_order_id,
        });
      } catch (err) {
        return res.status(err.status || 400).json({ error: err.message || 'Offer code is not available' });
      }

      expectedAmount = promoData.amount_paise || OFFER.amount_paise;
      months = promoData.duration_months || OFFER.duration_months;
      offerLabel = promoData.label || OFFER.label;

      if (Number(payment.amount) !== Number(expectedAmount)) {
        return res.status(400).json({
          error: `Payment amount mismatch. Expected ${expectedAmount} paise for this offer.`,
        });
      }
      source = 'razorpay_promo';
    } else if (Number(payment.amount) !== Number(expectedAmount)) {
      return res.status(400).json({
        error: `Payment amount mismatch. Expected ${expectedAmount} paise.`,
      });
    }

    // Security: never trust client-provided billing duration.
    // Lifetime plans use a fixed far-future expiry (website-only SKU).
    const expiryIso = getExpiryIsoForPlan(planConfig, months);
    const nowIso = new Date().toISOString();

    const subscription = {
      plan: planConfig.plan_key,
      plan_key: planConfig.plan_key,
      label: offerLabel,
      expiry_date: expiryIso,
      active: true,
      updated_at: nowIso,
      source,
    };

    const user = await getUser(uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (promoCode) {
      try {
        await redeemCode(promoCode, uid, {
          email: user.email || decoded.email || null,
          amount_paise: expectedAmount,
          razorpay_order_id,
          razorpay_payment_id,
          granted_expiry: expiryIso,
        });
      } catch (err) {
        return res.status(err.status || 400).json({ error: err.message || 'Unable to redeem offer code' });
      }
    }

    let customerId = user.customer_id;
    if (!customerId) {
      const hash = crypto.createHash('sha256').update(uid + (user.email || '')).digest('hex');
      customerId = `cust_${hash.substring(0, 16)}`;
    }

    const updateData = {
      subscription,
      customer_id: customerId,
      updated_at: nowIso,
    };

    if (referralCode) {
      updateData.referred_by = referralCode;
    }
    if (!user.referral_code) {
      updateData.referral_code = 'ARG' + uid.substring(0, 6).toUpperCase();
    }
    if (promoCode) {
      updateData.promo_offer_used = true;
      updateData.promo_code_used = promoCode;
    }

    const updatedUser = await updateUser(uid, updateData);

    const centralSubscription = {
      user_id: uid,
      plan: planConfig.plan_key,
      plan_key: planConfig.plan_key,
      active: true,
      source,
      store: 'web',
      expiry_date: expiryIso,
      updated_at: nowIso,
    };
    await getDb().collection('subscriptions').doc(uid).set(centralSubscription, { merge: true });

    await recordPayment(razorpay_payment_id, {
      user_id: uid,
      status: 'verified',
      source,
      plan: planConfig.plan_key,
      amount_paise: Number(payment.amount),
      razorpay_order_id,
      promo_code: promoCode || null,
      subscription,
      customer_id: customerId,
      created_at: nowIso,
    });

    try {
      await notifySubscriptionChange(updatedUser, subscription, {
        event: 'activated',
        previousSubscription: user.subscription || null,
        source,
      });
    } catch (mailErr) {
      console.error('subscription email failed (payment verify):', mailErr);
    }

    return res.status(200).json({
      message: 'Payment verified and subscription activated',
      verified: true,
      subscription,
      customer_id: customerId,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return res.status(500).json({ error: 'Payment verification failed' });
  }
});

// ==================== /api/account/delete ====================
exports.apiAccountDelete = onRequest({ region: 'us-central1', maxInstances: 10, secrets: FIREBASE_SECRETS }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const email = (body.email || '').trim().toLowerCase();
  const name = (body.name || '').trim();
  const reason = (body.reason || '').trim();

  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Rate limit by email
  const rl = await checkRateLimit(`delete_${email}`, 'account_delete');
  if (!rl.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded. You have already submitted a deletion request recently.',
      retry_after_seconds: rl.retryAfterSeconds,
    });
  }

  let uid = null;

  // If auth token is provided, verify and use it for actual deletion
  const token = extractToken(req);
  if (token) {
    try {
      const decoded = await verifyToken(token);
      uid = decoded.uid;
    } catch (err) {
      // Token invalid — continue as unauthenticated request
    }
  }

  const db = getDb();
  const requestData = {
    email,
    name,
    reason,
    uid,
    status: uid ? 'pending' : 'pending_verification',
    created_at: new Date().toISOString(),
  };

  await db.collection('deletion_requests').add(requestData);

  // If user is authenticated, delete their data immediately
  if (uid) {
    try {
      const auth = getAuth();
      // Delete Firestore user document
      await db.collection('users').doc(uid).delete();
      await db.collection('users').doc(uid).collection('app_data').doc('main').delete();
      await db.collection('users').doc(uid).collection('scan_results').doc('latest').delete();
      // Delete the auth account
      await auth.deleteUser(uid);
      // Update request status
      // Note: we can't update the doc we just added without a reference,
      // but the deletion is done
    } catch (err) {
      console.error('Account deletion error:', err);
      // Don't fail the response — the request is recorded
    }
  }

  return res.status(200).json({
    message: 'Deletion request received. We will process it within 30 days.',
    email,
  });
});

// ==================== /api/data/load ====================
exports.apiDataLoad = onRequest({ region: 'us-central1', maxInstances: 10, secrets: FIREBASE_SECRETS }, async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const uid = decoded.uid;
  const user = await getUser(uid);
  if (!hasActiveBusinessSubscription(user)) {
    return res.status(402).json({
      error: 'Business subscription required for cloud sync',
      requires_subscription: true,
    });
  }

  const rl = await checkRateLimit(uid, 'data_load');
  if (!rl.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded', retry_after_seconds: rl.retryAfterSeconds });
  }

  const db = getDb();

  try {
    const doc = await db.collection('users').doc(uid).collection('app_data').doc('main').get();
    if (doc.exists) {
      const data = doc.data();
      const { resolveAppData } = require('./_shared/app_data');
      return res.status(200).json({
        data: resolveAppData(data),
        updated_at: data.updated_at || null,
        version: data.version || 1,
      });
    }
    return res.status(200).json({ data: null, updated_at: null, version: 0 });
  } catch (error) {
    console.error('Data load error:', error);
    return res.status(500).json({ error: 'Failed to load data' });
  }
});

// ==================== /api/data/save ====================
exports.apiDataSave = onRequest({ region: 'us-central1', maxInstances: 10, secrets: FIREBASE_SECRETS }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const uid = decoded.uid;
  const user = await getUser(uid);
  if (!hasActiveBusinessSubscription(user)) {
    return res.status(402).json({
      error: 'Business subscription required for cloud sync',
      requires_subscription: true,
    });
  }

  const body = req.body || {};

  if (!body.appData) {
    return res.status(400).json({ error: 'Missing appData field' });
  }

  const payloadSize = Buffer.byteLength(JSON.stringify(body.appData), 'utf8');
  if (payloadSize > 4_000_000) {
    return res.status(413).json({ error: 'Payload too large (max 4MB)' });
  }

  const rl = await checkRateLimit(uid, 'data_save');
  if (!rl.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Too many sync attempts.',
      retry_after_seconds: rl.retryAfterSeconds,
    });
  }

  const db = getDb();
  const now = new Date().toISOString();

  try {
    await db.collection('users').doc(uid).collection('app_data').doc('main').set({
      appData: body.appData,
      updated_at: now,
      version: body.version || 1,
      device: body.device || 'unknown',
    }, { merge: true });

    return res.status(200).json({ success: true, updated_at: now });
  } catch (error) {
    console.error('Data save error:', error);
    return res.status(500).json({ error: 'Failed to save data' });
  }
});

// ==================== /api/files ====================
exports.apiFiles = onRequest({ region: 'us-central1', maxInstances: 10, secrets: FIREBASE_SECRETS }, async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  const uid = decoded.uid;
  const db = getDb();
  const col = db.collection('users').doc(uid).collection('files');
  try {
    if (req.method === 'GET') {
      const snap = await col.orderBy('createdAt', 'desc').limit(50).get();
      const files = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return res.status(200).json({ files });
    }
    if (req.method === 'POST') {
      const body = req.body || {};
      const id = String(body.id || body.invoiceId || Date.now());
      const dataB64 = String(body.dataB64 || '');
      if (dataB64.length > 700000) {
        return res.status(413).json({ error: 'File too large for Firestore (use a smaller PDF)' });
      }
      await col.doc(id).set({
        id,
        invoiceNumber: body.invoiceNumber || '',
        name: body.name || `${id}.pdf`,
        mime: body.mime || 'application/pdf',
        size: body.size || 0,
        createdAt: new Date().toISOString(),
        dataB64,
      }, { merge: true });
      return res.status(200).json({ ok: true, id });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('apiFiles', error);
    return res.status(500).json({ error: 'Failed to load files' });
  }
});

// ==================== /api/data/scan-result ====================
// Used by phone-as-scanner: mobile page posts scan result, PC polls for it
exports.apiDataScanResult = onRequest({ region: 'us-central1', maxInstances: 10, secrets: FIREBASE_SECRETS }, async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const uid = decoded.uid;
  const db = getDb();
  const scanRef = db.collection('users').doc(uid).collection('scan_results').doc('latest');

  if (req.method === 'GET') {
    try {
      const doc = await scanRef.get();
      if (doc.exists) {
        const data = doc.data();
        return res.status(200).json({ code: data.code || null, timestamp: data.timestamp || null });
      }
      return res.status(200).json({ code: null, timestamp: null });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to get scan result' });
    }
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    if (!body.code) return res.status(400).json({ error: 'Missing code field' });

    try {
      await scanRef.set({
        code: body.code,
        timestamp: new Date().toISOString(),
      });
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to save scan result' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await scanRef.delete();
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to clear scan result' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
});

// ==================== Scheduled cleanup for rate_limits ====================
exports.cleanupRateLimits = onSchedule(
  { schedule: '0 3 * * *', region: 'us-central1', maxInstances: 1 },
  async () => {
    const db = getDb();
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    const usersSnapshot = await db.collection('rate_limits').get();

    let deletedCount = 0;
    for (const userDoc of usersSnapshot.docs) {
      const endpoints = await userDoc.ref.listCollections();
      for (const endpointCol of endpoints) {
        const oldDocs = await endpointCol.where('timestamp', '<', cutoff).get();
        for (const doc of oldDocs.docs) {
          await doc.ref.delete();
          deletedCount++;
        }
      }
    }

    console.log(`Rate limit cleanup: deleted ${deletedCount} old entries`);
  }
);

// ==================== Admin access key rotation (every 14 days) ====================
exports.rotateAdminAccessKey = onSchedule(
  {
    schedule: '0 4 * * *',
    region: 'us-central1',
    maxInstances: 1,
    secrets: ['RESEND_API_KEY'],
  },
  async () => {
    const db = getDb();
    const result = await rotateAdminAccessKey(db);
    console.log('Admin key rotation:', JSON.stringify({
      rotated: result.rotated,
      expires_at: result.expires_at,
      email_sent: Boolean(result.email && result.email.sent),
    }));
  },
);

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const crypto = require('crypto');
const { verifyToken, getUser, createUser, updateUser, getDb, getAuth } = require('./_shared/firebase-admin');
const { getPlan, getAllPlans, getExpiryIsoForPlan } = require('./_shared/plans');
const { apiCa } = require('./ca');
exports.apiCa = apiCa;
const { checkRateLimit } = require('./_shared/rate-limit');
const {
  OFFER,
  normalizeCode,
  validateCodeForUser,
  reserveCode,
  attachOrderToReservation,
  redeemCode,
  findRedemptionByPaymentId,
  findPaymentRecord,
  recordPayment,
  CAMPAIGN,
} = require('./_shared/promo');

const RAZORPAY_KEY_ID = (process.env.RAZORPAY_KEY_ID || '').trim().replace(/[\r\n]/g, '');
const RAZORPAY_KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || '').trim().replace(/[\r\n]/g, '');

/** Ops seed/test gate — rotate after beta if this endpoint is kept. */
const PROMO_OPS_TOKEN = (process.env.PROMO_OPS_TOKEN || 'argus-promo-ops-2026-beta-k9f2m8').trim();
const PROMO_TARGET_COUNT = 50;
const PROMO_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function requirePromoOps(req, res) {
  const token = (req.get('x-promo-ops-token') || req.body?.ops_token || '').trim();
  if (!token || token !== PROMO_OPS_TOKEN) {
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
const RAZORPAY_SECRETS = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'];

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

    const user = await updateUser(uid, updateData);
    return res.status(200).json({ user });
  }

  return res.status(405).json({ error: 'Method not allowed' });
});

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
  } catch (err) {
    results.push({ step: 'fatal', ok: false, error: err.message || String(err) });
  } finally {
    try {
      await db.collection('promo_codes').doc(code).delete();
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

  let amount = Math.round(planConfig.amount);
  let durationMonths = planConfig.lifetime ? null : planConfig.duration_months;
  let offerLabel = planConfig.label;
  let reservedCode = null;

  if (promoCode) {
    const user = await getUser(uid);
    const validation = await validateCodeForUser(promoCode, uid, user);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Reserve before creating the Razorpay order so two checkouts cannot share one code.
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
          offer: promoCode ? OFFER.campaign : '',
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
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
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
      const reservedBySelf = promoData.status === 'reserved' && promoData.reserved_by === uid;
      const alreadyOwnRedeem =
        promoData.status === 'redeemed' &&
        promoData.redeemed_by === uid &&
        promoData.redeemed_payment_id === razorpay_payment_id;

      if (promoData.status === 'redeemed' && !alreadyOwnRedeem) {
        return res.status(400).json({ error: 'This offer code has already been used' });
      }
      if (promoData.status === 'disabled') {
        return res.status(400).json({ error: 'This offer code is no longer valid' });
      }
      if (!reservedBySelf && !alreadyOwnRedeem && promoData.status !== 'available') {
        // Allow available only if reservation expired mid-flight; redeemCode will re-check.
        if (promoData.status === 'reserved' && promoData.reserved_by !== uid) {
          return res.status(409).json({ error: 'This offer code is temporarily unavailable' });
        }
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
  const db = getDb();

  try {
    const doc = await db.collection('users').doc(uid).collection('app_data').doc('main').get();
    if (doc.exists) {
      const data = doc.data();
      return res.status(200).json({
        data: data.appData || null,
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
  const body = req.body || {};

  if (!body.appData) {
    return res.status(400).json({ error: 'Missing appData field' });
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

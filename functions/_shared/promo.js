const { getDb } = require('./firebase-admin');
const crypto = require('crypto');
const {
  RESERVATION_TTL_MS,
  maxRedemptions,
  isExhausted,
  pruneReservations,
  slotsTaken,
  hasRedeemedPayment,
  hasRedeemedUid,
  fail,
} = require('./promo-logic');

const CAMPAIGN = 'beta_118_3m';
const INTRO_CAMPAIGN = 'intro_1rupee_12m';
const LAUNCH_CAMPAIGN = 'launch_100_3m';
const LAUNCH_CODE = 'ARGUS100';
const INTRO_CODE_PREFIX = 'ARGUS1-';
const INTRO_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const OFFER = {
  campaign: CAMPAIGN,
  plan: 'business',
  plan_key: 'business',
  label: 'Business (Beta offer — 3 months)',
  duration_months: 3,
  base_amount_paise: 10000,
  gst_percent: 18,
  amount_paise: 11800, // ₹100 + 18% GST
  max_redemptions: 1,
  billing_type: 'order',
};
const INTRO_OFFER = {
  campaign: INTRO_CAMPAIGN,
  billing_type: 'subscription',
  subscription_plan: 'intro_1rupee_monthly',
  follow_up_plan: 'business_monthly',
  plan: 'business',
  plan_key: 'business',
  label: 'Business — ₹1/month for 12 months',
  intro_cycles: 12,
  amount_paise: 100,
  max_redemptions: 1,
};
const LAUNCH_OFFER = {
  campaign: LAUNCH_CAMPAIGN,
  billing_type: 'order',
  plan: 'business',
  plan_key: 'business',
  label: 'Business — ₹100 for 3 months',
  duration_months: 3,
  base_amount_paise: 10000,
  gst_percent: 0,
  amount_paise: 10000,
  max_redemptions: 10,
  code: LAUNCH_CODE,
};

const ALLOWED_CAMPAIGNS = new Set([CAMPAIGN, INTRO_CAMPAIGN, LAUNCH_CAMPAIGN]);

function defaultsForCampaign(campaign) {
  if (campaign === INTRO_CAMPAIGN) return INTRO_OFFER;
  if (campaign === LAUNCH_CAMPAIGN) return LAUNCH_OFFER;
  return OFFER;
}

function generateIntroPromoCode() {
  const bytes = crypto.randomBytes(10);
  let body = '';
  for (let i = 0; i < 10; i++) body += INTRO_CODE_ALPHABET[bytes[i] % INTRO_CODE_ALPHABET.length];
  return `${INTRO_CODE_PREFIX}${body}`;
}

function isLegacyIntroCode(code) {
  return normalizeCode(code) === 'ARGUS1RUPEE';
}

function normalizeCode(input) {
  return String(input || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function codeRef(db, code) {
  return db.collection('promo_codes').doc(code);
}

function isReservationExpired(data, nowMs) {
  if (!data || data.status !== 'reserved') return true;
  const reservedAt = data.reserved_at ? Date.parse(data.reserved_at) : 0;
  if (!reservedAt) return true;
  return nowMs - reservedAt > RESERVATION_TTL_MS;
}

/**
 * Read-only validation for UI. Does not reserve.
 */
async function validateCodeForUser(codeInput, uid, user) {
  const code = normalizeCode(codeInput);
  if (!code) {
    return { valid: false, error: 'Enter an offer code' };
  }
  if (isLegacyIntroCode(code)) {
    return { valid: false, error: 'This offer code is no longer valid' };
  }
  if (!uid) {
    return { valid: false, error: 'Sign in required' };
  }

  const db = getDb();
  const snap = await codeRef(db, code).get();
  if (!snap.exists) {
    return { valid: false, error: 'Invalid offer code' };
  }

  const data = snap.data();
  const nowMs = Date.now();
  const campaign = data.campaign || CAMPAIGN;
  const defaults = defaultsForCampaign(campaign);

  if (campaign === INTRO_CAMPAIGN && user && user.intro_promo_used) {
    return { valid: false, error: 'This code cannot be used on this account' };
  }
  if (campaign !== INTRO_CAMPAIGN && user && user.promo_offer_used) {
    return { valid: false, error: 'This code cannot be used on this account' };
  }
  if (hasRedeemedUid(data, uid)) {
    return { valid: false, error: 'This code cannot be used on this account' };
  }

  if (data.campaign && !ALLOWED_CAMPAIGNS.has(data.campaign)) {
    return { valid: false, error: 'Invalid offer code' };
  }
  if (data.expires_at && Date.parse(data.expires_at) < nowMs) {
    return { valid: false, error: 'This offer code has expired' };
  }
  if (data.status === 'disabled') {
    return { valid: false, error: 'This offer code is no longer valid' };
  }
  if (isExhausted(data)) {
    return { valid: false, error: 'This offer code has already been used' };
  }

  const billingType = data.billing_type || defaults.billing_type || 'order';
  const multiUse = maxRedemptions(data) > 1;
  if (multiUse) {
    const reservations = pruneReservations(data, nowMs);
    if (!reservations[uid] && slotsTaken(data.redemption_count, reservations) >= maxRedemptions(data)) {
      return { valid: false, error: 'This offer code is temporarily unavailable' };
    }
  } else if (
    data.status === 'reserved' &&
    data.reserved_by &&
    data.reserved_by !== uid &&
    !isReservationExpired(data, nowMs)
  ) {
    return { valid: false, error: 'This offer code is temporarily unavailable' };
  }

  const amountPaise = data.amount_paise || defaults.amount_paise;
  const durationMonths = data.duration_months || defaults.duration_months || OFFER.duration_months;
  const label = data.label || defaults.label;

  const message =
    billingType === 'subscription'
      ? `₹${Math.round(amountPaise / 100)}/month for ${data.intro_cycles || INTRO_OFFER.intro_cycles} months, then ₹500/month (auto-renews)`
      : campaign === LAUNCH_CAMPAIGN
        ? `Pay ₹${Math.round(amountPaise / 100)} for ${durationMonths} months of Business`
        : `Pay ₹${Math.round(amountPaise / 100)} for ${durationMonths} months of Business (₹100 + GST)`;

  return {
    valid: true,
    code,
    campaign,
    billing_type: billingType,
    subscription_plan: data.subscription_plan || defaults.subscription_plan || null,
    follow_up_plan: data.follow_up_plan || defaults.follow_up_plan || null,
    intro_cycles: data.intro_cycles || defaults.intro_cycles,
    plan: data.plan || defaults.plan || OFFER.plan,
    duration_months: durationMonths,
    base_amount_paise: data.base_amount_paise || defaults.base_amount_paise || amountPaise,
    gst_percent: data.gst_percent ?? defaults.gst_percent ?? 0,
    amount_paise: amountPaise,
    amount_rupees: Math.round(amountPaise / 100),
    max_redemptions: maxRedemptions(data),
    remaining_uses: Math.max(0, maxRedemptions(data) - (data.redemption_count || 0)),
    label,
    message,
  };
}

/**
 * Atomically reserve a checkout slot. Single-use codes lock globally;
 * multi-use codes reserve one of N slots without blocking other buyers.
 */
async function reserveCode(codeInput, uid, orderId) {
  const code = normalizeCode(codeInput);
  const db = getDb();
  const ref = codeRef(db, code);
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw fail('Invalid offer code');
    const data = snap.data();

    if (data.expires_at && Date.parse(data.expires_at) < nowMs) {
      throw fail('This offer code has expired');
    }
    if (data.status === 'disabled') {
      throw fail('This offer code is no longer valid');
    }
    if (isExhausted(data)) {
      throw fail('This offer code has already been used');
    }
    if (hasRedeemedUid(data, uid)) {
      throw fail('This code cannot be used on this account');
    }

    if (maxRedemptions(data) > 1) {
      const reservations = pruneReservations(data, nowMs);
      if (!reservations[uid]) {
        if (slotsTaken(data.redemption_count, reservations) >= maxRedemptions(data)) {
          throw fail('This offer code is temporarily unavailable', 409);
        }
      }
      reservations[uid] = { at: nowIso, order_id: orderId || null };
      tx.update(ref, {
        status: 'available',
        reservations,
        reserved_count: Object.keys(reservations).length,
        reserved_by: uid,
        reserved_at: nowIso,
        reserved_order_id: orderId || null,
        updated_at: nowIso,
      });
      return;
    }

    if (
      data.status === 'reserved' &&
      data.reserved_by &&
      data.reserved_by !== uid &&
      !isReservationExpired(data, nowMs)
    ) {
      throw fail('This offer code is temporarily unavailable', 409);
    }

    tx.update(ref, {
      status: 'reserved',
      reserved_by: uid,
      reserved_at: nowIso,
      reserved_order_id: orderId || null,
      updated_at: nowIso,
    });
  });

  const after = await ref.get();
  return { code, ...(after.data() || {}) };
}

/**
 * Attach Razorpay order id to an existing reservation (same uid).
 */
async function attachOrderToReservation(codeInput, uid, orderId) {
  const code = normalizeCode(codeInput);
  const db = getDb();
  const ref = codeRef(db, code);
  const nowIso = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      const err = new Error('Invalid offer code');
      err.status = 400;
      throw err;
    }
    const data = snap.data();
    if (maxRedemptions(data) > 1) {
      const reservations = pruneReservations(data, Date.now());
      if (!reservations[uid]) {
        throw fail('Offer code is not reserved for this account', 409);
      }
      reservations[uid] = { at: nowIso, order_id: orderId };
      tx.update(ref, {
        reservations,
        reserved_by: uid,
        reserved_order_id: orderId,
        reserved_at: nowIso,
        updated_at: nowIso,
      });
      return;
    }
    if (data.status !== 'reserved' || data.reserved_by !== uid) {
      throw fail('Offer code is not reserved for this account', 409);
    }
    tx.update(ref, {
      reserved_order_id: orderId,
      reserved_at: nowIso,
      updated_at: nowIso,
    });
  });
}

/**
 * Finalize redemption after verified payment.
 */
async function redeemCode(codeInput, uid, paymentMeta) {
  const code = normalizeCode(codeInput);
  const db = getDb();
  const ref = codeRef(db, code);
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  let redeemedData = null;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      const err = new Error('Invalid offer code');
      err.status = 400;
      throw err;
    }
    const data = snap.data();

    if (hasRedeemedPayment(data, paymentMeta.razorpay_payment_id) && hasRedeemedUid(data, uid)) {
      redeemedData = data;
      return; // idempotent replay of same verify
    }
    if (isExhausted(data)) {
      throw fail('This offer code has already been used');
    }
    if (hasRedeemedUid(data, uid)) {
      throw fail('This code cannot be used on this account');
    }

    const checkoutRef =
      paymentMeta.razorpay_subscription_id || paymentMeta.razorpay_order_id || null;
    const multiUse = maxRedemptions(data) > 1;
    const reservations = multiUse ? pruneReservations(data, nowMs) : {};
    const reservedOk = multiUse
      ? Boolean(reservations[uid]) &&
        (!reservations[uid].order_id ||
          reservations[uid].order_id === paymentMeta.razorpay_order_id ||
          reservations[uid].order_id === paymentMeta.razorpay_subscription_id)
      : data.status === 'reserved' &&
        data.reserved_by === uid &&
        (!data.reserved_order_id ||
          data.reserved_order_id === paymentMeta.razorpay_order_id ||
          data.reserved_order_id === paymentMeta.razorpay_subscription_id);

    const staleAvailable =
      !multiUse &&
      (data.status === 'available' || isReservationExpired(data, nowMs)) &&
      (data.redemption_count || 0) < maxRedemptions(data);

    const multiAvailable =
      multiUse &&
      !reservations[uid] &&
      slotsTaken(data.redemption_count, reservations) < maxRedemptions(data);

    if (!reservedOk && !staleAvailable && !multiAvailable) {
      throw fail('Offer code reservation mismatch', 409);
    }

    if (multiUse) delete reservations[uid];
    const nextCount = (data.redemption_count || 0) + 1;
    const exhausted = nextCount >= maxRedemptions(data);
    const redeemedUids = [...(data.redeemed_uids || [])];
    if (!redeemedUids.includes(uid)) redeemedUids.push(uid);
    const redeemedPaymentIds = [...(data.redeemed_payment_ids || [])];
    if (paymentMeta.razorpay_payment_id && !redeemedPaymentIds.includes(paymentMeta.razorpay_payment_id)) {
      redeemedPaymentIds.push(paymentMeta.razorpay_payment_id);
    }

    const next = {
      status: exhausted ? 'redeemed' : 'available',
      redemption_count: nextCount,
      redeemed_uids: redeemedUids,
      redeemed_payment_ids: redeemedPaymentIds,
      redeemed_by: uid,
      redeemed_at: nowIso,
      redeemed_payment_id: paymentMeta.razorpay_payment_id,
      reserved_by: exhausted ? uid : null,
      reserved_order_id: exhausted ? checkoutRef : null,
      reservations: multiUse ? reservations : data.reservations || {},
      reserved_count: multiUse ? Object.keys(reservations).length : 0,
      updated_at: nowIso,
    };
    tx.update(ref, next);
    redeemedData = { ...data, ...next };
  });

  const redemptionRef = db.collection('promo_redemptions').doc();
  await redemptionRef.set({
    code,
    user_id: uid,
    email: paymentMeta.email || null,
    amount_paise: paymentMeta.amount_paise || redeemedData?.amount_paise || OFFER.amount_paise,
    razorpay_order_id: paymentMeta.razorpay_order_id || null,
    razorpay_subscription_id: paymentMeta.razorpay_subscription_id || null,
    razorpay_payment_id: paymentMeta.razorpay_payment_id,
    granted_expiry: paymentMeta.granted_expiry,
    campaign: redeemedData?.campaign || CAMPAIGN,
    created_at: nowIso,
  });

  return { code, redemption_id: redemptionRef.id, ...(redeemedData || {}) };
}

async function findRedemptionByPaymentId(paymentId) {
  if (!paymentId) return null;
  const db = getDb();
  const snap = await db
    .collection('promo_redemptions')
    .where('razorpay_payment_id', '==', paymentId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

async function findPaymentRecord(paymentId) {
  if (!paymentId) return null;
  const db = getDb();
  const doc = await db.collection('payments').doc(paymentId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function seedIntroPromoCode() {
  const db = getDb();
  const existing = await db.collection('promo_codes').where('campaign', '==', INTRO_CAMPAIGN).get();

  for (const doc of existing.docs) {
    if (isLegacyIntroCode(doc.id)) {
      await doc.ref.set(
        {
          status: 'disabled',
          updated_at: new Date().toISOString(),
          disabled_reason: 'replaced_by_single_use_complex_code',
        },
        { merge: true },
      );
    }
  }

  const active = existing.docs.filter(
    (doc) => !isLegacyIntroCode(doc.id) && doc.data()?.status !== 'disabled',
  );
  if (active.length > 0) {
    const doc = active[0];
    return {
      seeded: false,
      code: doc.id,
      existing: true,
      data: doc.data(),
    };
  }

  const nowIso = new Date().toISOString();
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 2);

  let code = generateIntroPromoCode();
  let attempts = 0;
  while (attempts < 20) {
    const snap = await codeRef(db, code).get();
    if (!snap.exists) break;
    code = generateIntroPromoCode();
    attempts += 1;
  }

  const doc = {
    code,
    campaign: INTRO_CAMPAIGN,
    billing_type: INTRO_OFFER.billing_type,
    subscription_plan: INTRO_OFFER.subscription_plan,
    follow_up_plan: INTRO_OFFER.follow_up_plan,
    intro_cycles: INTRO_OFFER.intro_cycles,
    status: 'available',
    plan: INTRO_OFFER.plan,
    plan_key: INTRO_OFFER.plan_key,
    label: INTRO_OFFER.label,
    amount_paise: INTRO_OFFER.amount_paise,
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

  await codeRef(db, code).create(doc);
  return { seeded: true, code, data: doc };
}

async function seedLaunchPromoCode() {
  const db = getDb();
  const code = LAUNCH_CODE;
  const snap = await codeRef(db, code).get();
  if (snap.exists) {
    return { seeded: false, code, existing: true, data: snap.data() };
  }

  const nowIso = new Date().toISOString();
  const expires = new Date();
  expires.setMonth(expires.getMonth() + 6);
  const doc = {
    code,
    campaign: LAUNCH_CAMPAIGN,
    billing_type: LAUNCH_OFFER.billing_type,
    status: 'available',
    plan: LAUNCH_OFFER.plan,
    plan_key: LAUNCH_OFFER.plan_key,
    label: LAUNCH_OFFER.label,
    duration_months: LAUNCH_OFFER.duration_months,
    base_amount_paise: LAUNCH_OFFER.base_amount_paise,
    gst_percent: LAUNCH_OFFER.gst_percent,
    amount_paise: LAUNCH_OFFER.amount_paise,
    max_redemptions: LAUNCH_OFFER.max_redemptions,
    redemption_count: 0,
    reserved_count: 0,
    reservations: {},
    reserved_by: null,
    reserved_at: null,
    reserved_order_id: null,
    redeemed_by: null,
    redeemed_at: null,
    redeemed_payment_id: null,
    redeemed_uids: [],
    redeemed_payment_ids: [],
    expires_at: expires.toISOString(),
    created_at: nowIso,
    updated_at: nowIso,
  };
  await codeRef(db, code).create(doc);
  return { seeded: true, code, existing: false, data: doc };
}

function assertPromoReadyForVerify(data, uid, paymentMeta) {
  if (!data) throw fail('Invalid offer code');
  if (hasRedeemedPayment(data, paymentMeta.razorpay_payment_id) && hasRedeemedUid(data, uid)) {
    return { replay: true };
  }
  if (data.status === 'disabled') throw fail('This offer code is no longer valid');
  if (isExhausted(data)) throw fail('This offer code has already been used');
  if (hasRedeemedUid(data, uid)) throw fail('This code cannot be used on this account');
  const nowMs = Date.now();
  if (maxRedemptions(data) > 1) {
    const reservations = pruneReservations(data, nowMs);
    const hasSlot = Boolean(reservations[uid]);
    const open = slotsTaken(data.redemption_count, reservations) < maxRedemptions(data);
    if (!hasSlot && !open) throw fail('This offer code is temporarily unavailable', 409);
    return { replay: false };
  }
  const reservedBySelf = data.status === 'reserved' && data.reserved_by === uid;
  if (!reservedBySelf && data.status === 'reserved' && data.reserved_by !== uid && !isReservationExpired(data, nowMs)) {
    throw fail('This offer code is temporarily unavailable', 409);
  }
  return { replay: false };
}

async function recordPayment(paymentId, data) {
  const db = getDb();
  await db.collection('payments').doc(paymentId).set(
    {
      ...data,
      store_payment_id: paymentId,
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  );
}

module.exports = {
  CAMPAIGN,
  INTRO_CAMPAIGN,
  LAUNCH_CAMPAIGN,
  LAUNCH_CODE,
  INTRO_CODE_PREFIX,
  INTRO_OFFER,
  LAUNCH_OFFER,
  OFFER,
  RESERVATION_TTL_MS,
  normalizeCode,
  generateIntroPromoCode,
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
};

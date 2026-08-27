/**
 * Promo / beta-offer helpers used by functions/index.js.
 *
 * Required in the 2026-08-13 lifetime/CA commit (27d0962) but the file was
 * never committed. Behavior here is reconstructed only from that file's call
 * sites and /api/promo/self-test assertions — not new product rules.
 */
const { getDb } = require('./firebase-admin');

const CAMPAIGN = 'beta_2026';

/** ₹100 + 18% GST = ₹118. Locked by apiPromoSelfTest (amount_paise === 11800, duration_months === 3). */
const OFFER = {
  campaign: CAMPAIGN,
  plan: 'business',
  plan_key: 'business',
  label: 'Business — 3 months (beta)',
  duration_months: 3,
  base_amount_paise: 10000,
  gst_percent: 18,
  amount_paise: 11800,
};

/** Checkout window implied by index.js ("reservation expired mid-flight"). */
const RESERVATION_TTL_MS = 15 * 60 * 1000;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function normalizeCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function codesRef() {
  return getDb().collection('promo_codes');
}

function paymentsRef() {
  // Collection name is not in git history; index.js only passes razorpay_payment_id as the doc id.
  return getDb().collection('payments');
}

function reservationExpired(data, now = Date.now()) {
  if (!data || data.status !== 'reserved') return false;
  const reservedAt = data.reserved_at ? Date.parse(data.reserved_at) : NaN;
  if (!Number.isFinite(reservedAt)) return false;
  return now - reservedAt > RESERVATION_TTL_MS;
}

function codeExpired(data, now = Date.now()) {
  if (!data || !data.expires_at) return false;
  const expires = Date.parse(data.expires_at);
  return Number.isFinite(expires) && expires < now;
}

async function validateCodeForUser(code, uid, user) {
  const normalized = normalizeCode(code);
  if (!normalized) {
    return { valid: false, error: 'Enter an offer code' };
  }

  if (user?.promo_offer_used && user?.promo_code_used !== normalized) {
    return { valid: false, error: 'You have already used a beta offer' };
  }

  const snap = await codesRef().doc(normalized).get();
  if (!snap.exists) {
    return { valid: false, error: 'Invalid offer code' };
  }

  const data = snap.data() || {};
  if (codeExpired(data)) {
    return { valid: false, error: 'This offer code has expired' };
  }
  if (data.status === 'disabled') {
    return { valid: false, error: 'This offer code is no longer valid' };
  }
  if (data.status === 'redeemed') {
    return { valid: false, error: 'This offer code has already been used' };
  }
  if (data.status === 'reserved' && data.reserved_by !== uid && !reservationExpired(data)) {
    return { valid: false, error: 'This offer code is temporarily unavailable' };
  }

  const amountPaise = data.amount_paise || OFFER.amount_paise;
  const durationMonths = data.duration_months || OFFER.duration_months;
  const label = data.label || OFFER.label;
  const baseAmount = data.base_amount_paise || OFFER.base_amount_paise;
  const gstPercent = data.gst_percent != null ? data.gst_percent : OFFER.gst_percent;

  return {
    valid: true,
    code: normalized,
    plan: data.plan || OFFER.plan,
    duration_months: durationMonths,
    amount_paise: amountPaise,
    amount_rupees: amountPaise / 100,
    base_amount_paise: baseAmount,
    gst_percent: gstPercent,
    label,
    message: `Beta offer: ${durationMonths} months of Business for ₹${amountPaise / 100}.`,
  };
}

async function reserveCode(code, uid, orderId) {
  const normalized = normalizeCode(code);
  if (!normalized) throw httpError(400, 'Invalid offer code');

  const db = getDb();
  const ref = codesRef().doc(normalized);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw httpError(400, 'Invalid offer code');
    const data = snap.data() || {};

    if (codeExpired(data)) throw httpError(400, 'This offer code has expired');
    if (data.status === 'disabled') throw httpError(400, 'This offer code is no longer valid');
    if (data.status === 'redeemed') throw httpError(400, 'This offer code has already been used');
    if (data.status === 'reserved' && data.reserved_by !== uid && !reservationExpired(data)) {
      throw httpError(409, 'This offer code is temporarily unavailable');
    }

    const nowIso = new Date().toISOString();
    tx.update(ref, {
      status: 'reserved',
      reserved_by: uid,
      reserved_at: nowIso,
      reserved_order_id: orderId || null,
      updated_at: nowIso,
    });
  });
}

async function attachOrderToReservation(code, uid, orderId) {
  const normalized = normalizeCode(code);
  if (!normalized) throw httpError(400, 'Invalid offer code');

  const db = getDb();
  const ref = codesRef().doc(normalized);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw httpError(400, 'Invalid offer code');
    const data = snap.data() || {};

    if (data.status !== 'reserved' || data.reserved_by !== uid) {
      throw httpError(409, 'Offer code reservation failed');
    }

    tx.update(ref, {
      reserved_order_id: orderId,
      updated_at: new Date().toISOString(),
    });
  });
}

async function redeemCode(code, uid, details) {
  const normalized = normalizeCode(code);
  if (!normalized) throw httpError(400, 'Invalid offer code');

  const db = getDb();
  const ref = codesRef().doc(normalized);
  const payload = details || {};

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw httpError(400, 'Invalid offer code');
    const data = snap.data() || {};

    const alreadyOwn =
      data.status === 'redeemed' &&
      data.redeemed_by === uid &&
      data.redeemed_payment_id === payload.razorpay_payment_id;
    if (alreadyOwn) return;

    if (data.status === 'redeemed') {
      throw httpError(400, 'This offer code has already been used');
    }
    if (data.status === 'disabled') {
      throw httpError(400, 'This offer code is no longer valid');
    }
    if (codeExpired(data)) throw httpError(400, 'This offer code has expired');
    if (data.status === 'reserved' && data.reserved_by !== uid && !reservationExpired(data)) {
      throw httpError(409, 'This offer code is temporarily unavailable');
    }

    const nowIso = new Date().toISOString();
    tx.update(ref, {
      status: 'redeemed',
      redeemed_by: uid,
      redeemed_at: nowIso,
      redeemed_payment_id: payload.razorpay_payment_id || null,
      redeemed_order_id: payload.razorpay_order_id || null,
      redeemed_email: payload.email || null,
      granted_expiry: payload.granted_expiry || null,
      redemption_count: (data.redemption_count || 0) + 1,
      updated_at: nowIso,
    });
  });
}

async function findRedemptionByPaymentId(paymentId) {
  if (!paymentId) return null;
  const snap = await codesRef().where('redeemed_payment_id', '==', paymentId).limit(1).get();
  if (snap.empty) return null;
  const data = snap.docs[0].data() || {};
  return { user_id: data.redeemed_by, ...data };
}

async function findPaymentRecord(paymentId) {
  if (!paymentId) return null;
  const snap = await paymentsRef().doc(paymentId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function recordPayment(paymentId, data) {
  if (!paymentId) throw httpError(400, 'Missing payment id');
  await paymentsRef().doc(paymentId).set({ ...(data || {}) }, { merge: true });
}

module.exports = {
  OFFER,
  CAMPAIGN,
  RESERVATION_TTL_MS,
  normalizeCode,
  validateCodeForUser,
  reserveCode,
  attachOrderToReservation,
  redeemCode,
  findRedemptionByPaymentId,
  findPaymentRecord,
  recordPayment,
};

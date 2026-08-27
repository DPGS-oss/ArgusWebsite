/** One-time 14-day Business trial for web (and same-login mobile unlock). */

const crypto = require('crypto');

const TRIAL_DAYS = 14;
const DEVICE_ID_RE = /^[A-Za-z0-9_-]{16,128}$/;

function addDaysIso(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function hasPaidOrActiveSub(user) {
  const sub = user && user.subscription;
  if (!sub || sub.active !== true) return false;
  const expiry = sub.expiry_date || sub.expiryDate;
  if (!expiry) return false;
  const end = new Date(expiry);
  if (Number.isNaN(end.getTime())) return false;
  return end.getTime() > Date.now();
}

/**
 * Start a free Business trial once per account.
 * @returns {{ ok: true, subscription: object } | { ok: false, status: number, error: string }}
 */
function buildTrialSubscription() {
  return {
    plan: 'business',
    plan_key: 'business_trial',
    label: 'Business (14-day free trial)',
    details: 'Free trial of the full web + Business suite',
    active: true,
    expiry_date: addDaysIso(TRIAL_DAYS),
    source: 'trial',
    auto_renew: false,
    updated_at: new Date().toISOString(),
  };
}

function canStartTrial(user) {
  if (!user) return { ok: false, status: 404, error: 'User not found' };
  if (user.trial_used === true || user.trial_started_at) {
    return { ok: false, status: 409, error: 'Free trial already used on this account' };
  }
  if (hasPaidOrActiveSub(user)) {
    return { ok: false, status: 400, error: 'You already have an active subscription' };
  }
  return { ok: true };
}

/** Normalize and validate client device id (localStable UUID-like). */
function normalizeDeviceId(raw) {
  const id = String(raw || '').trim();
  if (!DEVICE_ID_RE.test(id)) return null;
  return id;
}

/**
 * Best-effort client IP behind Firebase Hosting / Cloud Functions.
 * Returns null for missing/local/unusable addresses.
 */
function clientIpFromReq(req) {
  const forwarded = String(req.get?.('x-forwarded-for') || req.headers?.['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  const candidates = [
    forwarded,
    req.get?.('x-real-ip'),
    req.ip,
    req.socket?.remoteAddress,
  ];
  for (const raw of candidates) {
    let ip = String(raw || '').trim().replace(/^::ffff:/i, '');
    if (!ip) continue;
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') continue;
    // Basic IPv4 / IPv6 sanity — reject empty garbage
    if (ip.length < 3 || ip.length > 64) continue;
    return ip;
  }
  return null;
}

function claimDocId(kind, value) {
  return `${kind}_${sha256Hex(value).slice(0, 40)}`;
}

/**
 * Pure gate for IP/device claim docs (same uid may retry; other uid blocked).
 * @returns {{ ok: true } | { ok: false, status: number, error: string }}
 */
function evaluateClaimDoc(snapData, uid, label) {
  if (!snapData) return { ok: true };
  const owner = String(snapData.uid || '');
  if (owner && owner !== uid) {
    return {
      ok: false,
      status: 409,
      error: `Free trial already used on this ${label}`,
    };
  }
  return { ok: true };
}

/**
 * Atomically claim trial for account + device (+ IP when available).
 * One trial per account, per device id, and per IP (for now).
 *
 * @returns {Promise<
 *   | { ok: true, subscription: object, user: object, ip: string|null, device_id: string }
 *   | { ok: false, status: number, error: string }
 * >}
 */
async function startTrialWithGuards({ db, uid, deviceId, ip, email }) {
  const device = normalizeDeviceId(deviceId);
  if (!device) {
    return { ok: false, status: 400, error: 'Valid device_id required' };
  }

  const userRef = db.collection('users').doc(uid);
  const deviceRef = db.collection('trial_claims').doc(claimDocId('device', device));
  const ipRef = ip ? db.collection('trial_claims').doc(claimDocId('ip', ip)) : null;

  try {
    const result = await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        return { ok: false, status: 404, error: 'User not found' };
      }
      const user = { id: uid, ...userSnap.data() };
      const accountGate = canStartTrial(user);
      if (!accountGate.ok) return accountGate;

      const deviceSnap = await tx.get(deviceRef);
      const deviceGate = evaluateClaimDoc(deviceSnap.exists ? deviceSnap.data() : null, uid, 'device');
      if (!deviceGate.ok) return deviceGate;

      if (ipRef) {
        const ipSnap = await tx.get(ipRef);
        const ipGate = evaluateClaimDoc(ipSnap.exists ? ipSnap.data() : null, uid, 'network');
        if (!ipGate.ok) return ipGate;
      }

      const now = new Date().toISOString();
      const subscription = buildTrialSubscription();
      const userPatch = {
        subscription,
        trial_used: true,
        trial_started_at: now,
        trial_device_id_hash: sha256Hex(device).slice(0, 40),
        trial_ip_hash: ip ? sha256Hex(ip).slice(0, 40) : null,
        updated_at: now,
      };
      tx.set(userRef, userPatch, { merge: true });

      const claimBase = {
        uid,
        email: email || user.email || null,
        claimed_at: now,
        trial_days: TRIAL_DAYS,
      };
      tx.set(
        deviceRef,
        { ...claimBase, kind: 'device', device_id_hash: sha256Hex(device).slice(0, 40) },
        { merge: true },
      );
      if (ipRef) {
        tx.set(
          ipRef,
          { ...claimBase, kind: 'ip', ip_hash: sha256Hex(ip).slice(0, 40) },
          { merge: true },
        );
      }

      return {
        ok: true,
        subscription,
        user: { ...user, ...userPatch },
      };
    });

    if (!result.ok) return result;
    return { ...result, ip, device_id: device };
  } catch (err) {
    console.error('startTrialWithGuards failed:', err);
    return { ok: false, status: 500, error: 'Could not start free trial' };
  }
}

module.exports = {
  TRIAL_DAYS,
  buildTrialSubscription,
  canStartTrial,
  hasPaidOrActiveSub,
  normalizeDeviceId,
  clientIpFromReq,
  claimDocId,
  evaluateClaimDoc,
  startTrialWithGuards,
  sha256Hex,
};

const { getDb } = require('./firebase-admin');

const RATE_LIMITS = {
  auth_sync: { windowMs: 60 * 60 * 1000, maxCalls: 1 },
  user_profile_get: { windowMs: 60 * 1000, maxCalls: 10 },
  user_profile_put: { windowMs: 60 * 1000, maxCalls: 5 },
  payment_create_order: { windowMs: 60 * 1000, maxCalls: 5 },
  payment_verify: { windowMs: 60 * 1000, maxCalls: 5 },
};

async function checkRateLimit(uid, endpoint) {
  const config = RATE_LIMITS[endpoint];
  if (!config) return { allowed: true };

  const db = getDb();
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const ref = db.collection('rate_limits').doc(uid).collection(endpoint);
  const snapshot = await ref.where('timestamp', '>', windowStart).get();
  const count = snapshot.size;

  if (count >= config.maxCalls) {
    const oldestDoc = snapshot.docs[0];
    const oldestTs = oldestDoc.data().timestamp;
    const retryAfterMs = config.windowMs - (now - oldestTs);
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      limit: config.maxCalls,
      window: config.windowMs,
    };
  }

  await ref.add({ timestamp: now });
  return { allowed: true };
}

module.exports = { checkRateLimit, RATE_LIMITS };

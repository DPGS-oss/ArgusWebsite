const crypto = require('crypto');

/**
 * Constant-time compare for hex digests / UTF-8 secrets of equal encoding.
 * Returns false if either side is empty or lengths differ.
 */
function safeEqualString(a, b) {
  const aa = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (!aa.length || aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function hmacSha256Hex(secret, payload) {
  return crypto.createHmac('sha256', String(secret || '')).update(payload).digest('hex');
}

module.exports = { safeEqualString, hmacSha256Hex };

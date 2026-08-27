const crypto = require('crypto');

const KEY_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** Only this Firebase account may open /admin/ — not configurable via env. */
const HARDCODED_ADMIN_EMAIL = 'support@argusinvoicing.com';

function parseAdminEmails() {
  return new Set([HARDCODED_ADMIN_EMAIL]);
}

function adminKeyRecipient() {
  return HARDCODED_ADMIN_EMAIL;
}

function hashAdminKey(key) {
  return crypto.createHash('sha256').update(String(key), 'utf8').digest('hex');
}

function keysEqual(a, b) {
  const aa = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function generateAdminKey() {
  const body = crypto.randomBytes(24).toString('base64url');
  return `ARGUS-ADMIN-${body}`;
}

function isAdminEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return false;
  return parseAdminEmails().has(normalized);
}

function extractAdminKey(req) {
  const header = String(req.get('x-admin-key') || req.get('X-Admin-Key') || '').trim();
  if (header) return header;
  const body = req.body || {};
  return String(body.admin_key || body.adminKey || '').trim();
}

async function loadAdminAccess(db) {
  const snap = await db.collection('system').doc('admin_access').get();
  return snap.exists ? snap.data() : null;
}

async function verifyAdminKey(db, providedKey) {
  if (!providedKey) return { ok: false, reason: 'missing_key' };
  const row = await loadAdminAccess(db);
  if (!row || !row.key_hash) return { ok: false, reason: 'not_configured' };
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (!expiresAt || expiresAt <= Date.now()) return { ok: false, reason: 'expired' };
  const hash = hashAdminKey(providedKey);
  if (!keysEqual(hash, row.key_hash)) return { ok: false, reason: 'invalid_key' };
  return { ok: true, expires_at: row.expires_at, rotated_at: row.rotated_at || row.created_at };
}

async function requireAdmin(req, res, decoded) {
  const email = String(decoded.email || '').trim().toLowerCase();
  if (!email || email !== HARDCODED_ADMIN_EMAIL) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  const { getDb } = require('./firebase-admin');
  const db = getDb();
  const keyCheck = await verifyAdminKey(db, extractAdminKey(req));
  if (!keyCheck.ok) {
    res.status(401).json({
      error: 'Invalid or expired admin key',
      code: keyCheck.reason,
    });
    return null;
  }
  return { email, uid: decoded.uid, key_expires_at: keyCheck.expires_at };
}

module.exports = {
  KEY_TTL_MS,
  HARDCODED_ADMIN_EMAIL,
  parseAdminEmails,
  adminKeyRecipient,
  hashAdminKey,
  generateAdminKey,
  isAdminEmail,
  extractAdminKey,
  verifyAdminKey,
  loadAdminAccess,
  requireAdmin,
};

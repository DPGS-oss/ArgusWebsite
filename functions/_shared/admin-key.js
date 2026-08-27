const {
  KEY_TTL_MS,
  adminKeyRecipient,
  generateAdminKey,
  hashAdminKey,
  loadAdminAccess,
} = require('./admin-auth');
const { sendEmail } = require('./resend-client');

async function sendAdminKeyEmail({ key, expiresAt, rotatedAt }) {
  const to = adminKeyRecipient();
  if (!to) {
    console.warn('admin-key: no admin key recipient configured; skipping email');
    return { sent: false, reason: 'no_recipient' };
  }

  const subject = 'Argus admin access key (rotate every 14 days)';
  const text = [
    'Your Argus website admin access key has been issued or rotated.',
    '',
    `Key (reusable until expiry): ${key}`,
    `Valid until: ${expiresAt}`,
    `Rotated at: ${rotatedAt}`,
    '',
    'Use this key at https://argusinvoicing.com/admin/ after signing in with support@argusinvoicing.com.',
    'The same key can be used as many times as you need until it expires.',
    'The admin console is not linked anywhere on the public site.',
    '',
    'Do not share this key. A new key will be emailed automatically in 14 days.',
  ].join('\n');

  const html = [
    '<p>Your Argus website admin access key has been issued or rotated.</p>',
    `<p><strong>Key (reusable until expiry):</strong> <code>${key}</code></p>`,
    `<p><strong>Valid until:</strong> ${expiresAt}</p>`,
    `<p><strong>Rotated at:</strong> ${rotatedAt}</p>`,
    '<p>Sign in at <a href="https://argusinvoicing.com/admin/">argusinvoicing.com/admin/</a> with <strong>support@argusinvoicing.com</strong>, then paste this key.</p>',
    '<p>The same key can be used as many times as you need until it expires. Do not share it. A new key will be emailed automatically in 14 days.</p>',
  ].join('\n');

  return sendEmail({ to, subject, text, html });
}

async function rotateAdminAccessKey(db, { force = false } = {}) {
  const existing = await loadAdminAccess(db);
  const now = Date.now();
  if (existing && existing.expires_at && !force) {
    const expiresMs = new Date(existing.expires_at).getTime();
    if (Number.isFinite(expiresMs) && expiresMs > now + 24 * 60 * 60 * 1000) {
      return { rotated: false, expires_at: existing.expires_at };
    }
  }

  const key = generateAdminKey();
  const rotatedAt = new Date().toISOString();
  const expiresAt = new Date(now + KEY_TTL_MS).toISOString();
  await db.collection('system').doc('admin_access').set({
    key_hash: hashAdminKey(key),
    created_at: existing?.created_at || rotatedAt,
    rotated_at: rotatedAt,
    expires_at: expiresAt,
    reusable: true,
    version: (existing?.version || 0) + 1,
  });

  const mail = await sendAdminKeyEmail({ key, expiresAt, rotatedAt });
  return { rotated: true, expires_at: expiresAt, email: mail, key };
}

module.exports = { rotateAdminAccessKey, sendAdminKeyEmail };

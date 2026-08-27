/**
 * Ops: mint a 14-day admin key, store SHA-256 only in Firestore, email support@.
 * Auth: Firebase CLI login (no service-account file).
 * Usage (from ArgusWebsite/functions): node scripts/issue-admin-key.js
 */
const fs = require('fs');
const path = require('path');

function loadDotEnv() {
  for (const name of ['.env.local', '.env']) {
    const envPath = path.join(__dirname, '..', name);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadDotEnv();

const {
  KEY_TTL_MS,
  HARDCODED_ADMIN_EMAIL,
  generateAdminKey,
  hashAdminKey,
} = require('../_shared/admin-auth');
const { sendAdminKeyEmail } = require('../_shared/admin-key');

function firebaseToolsRoot() {
  return path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'firebase-tools');
}

async function getCliAccessToken() {
  const toolsRoot = firebaseToolsRoot();
  const auth = require(path.join(toolsRoot, 'lib', 'auth.js'));
  const apiv2 = require(path.join(toolsRoot, 'lib', 'apiv2.js'));
  const account = auth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) {
    throw new Error('Not logged into Firebase CLI. Run: firebase login');
  }
  apiv2.setRefreshToken(account.tokens.refresh_token);
  return apiv2.getAccessToken();
}

function firestoreString(value) {
  return { stringValue: String(value) };
}

function firestoreInt(value) {
  return { integerValue: String(value) };
}

function firestoreBool(value) {
  return { booleanValue: Boolean(value) };
}

async function upsertAdminAccess(token, fields) {
  const url =
    'https://firestore.googleapis.com/v1/projects/argus-invocing/databases/(default)/documents/system/admin_access';
  const body = {
    fields: {
      key_hash: firestoreString(fields.key_hash),
      created_at: firestoreString(fields.created_at),
      rotated_at: firestoreString(fields.rotated_at),
      expires_at: firestoreString(fields.expires_at),
      reusable: firestoreBool(true),
      version: firestoreInt(fields.version),
    },
  };
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore write failed (${res.status}): ${err}`);
  }
}

async function readExisting(token) {
  const url =
    'https://firestore.googleapis.com/v1/projects/argus-invocing/databases/(default)/documents/system/admin_access';
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore read failed (${res.status}): ${err}`);
  }
  const doc = await res.json();
  const version = Number(doc.fields?.version?.integerValue || 0);
  const created_at = doc.fields?.created_at?.stringValue || null;
  return { version, created_at };
}

async function main() {
  const token = await getCliAccessToken();
  const existing = await readExisting(token);
  const key = generateAdminKey();
  const rotatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + KEY_TTL_MS).toISOString();
  await upsertAdminAccess(token, {
    key_hash: hashAdminKey(key),
    created_at: existing?.created_at || rotatedAt,
    rotated_at: rotatedAt,
    expires_at: expiresAt,
    version: (existing?.version || 0) + 1,
  });
  const mail = await sendAdminKeyEmail({ key, expiresAt, rotatedAt });
  console.log('Admin email:', HARDCODED_ADMIN_EMAIL);
  console.log('Console URL: https://argusinvoicing.com/admin/');
  console.log('Key expires:', expiresAt);
  console.log('Email sent:', JSON.stringify(mail));
  console.log('Admin key (reusable until expiry):', key);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

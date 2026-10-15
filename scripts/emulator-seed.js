/**
 * Test accounts for the LOCAL Firebase emulators only (never production):
 *
 *   firebase emulators:start --only auth,functions,firestore
 *   node scripts/emulator-seed.js
 *
 * Creates an owner on the Business plan and a staff member, both with
 * verified emails, and prints their uids. Refuses to run against anything
 * but 127.0.0.1.
 */
const AUTH = `http://127.0.0.1:${Number(process.env.EMU_AUTH_PORT) || 9099}`;
const STORE = `http://127.0.0.1:${Number(process.env.EMU_FIRESTORE_PORT) || 8080}`;
const PROJECT = process.env.EMU_PROJECT || 'argus-invocing';

// Test-only password for emulator accounts.
const PASSWORD = 'argus-emulator-test-1';
const USERS = [
  { email: 'owner@argus.test', name: 'Ravi Mehta', business: 'Mehta Medical Stores', plan: true },
  { email: 'staff@argus.test', name: 'Sunita (counter)', business: '', plan: false },
  { email: 'free@argus.test', name: 'Free User', business: '', plan: false },
];

async function json(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${url}: ${JSON.stringify(body)}`);
  return body;
}

const fsValue = (v) => {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return { doubleValue: v };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fsValue(x)])) } };
  return { stringValue: String(v) };
};

async function main() {
  const out = {};
  for (const u of USERS) {
    let uid;
    try {
      uid = (await json(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
        method: 'POST', body: JSON.stringify({ email: u.email, password: PASSWORD, displayName: u.name, returnSecureToken: true }),
      })).localId;
    } catch (_) {
      uid = (await json(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, {
        method: 'POST', body: JSON.stringify({ email: u.email, password: PASSWORD, returnSecureToken: true }),
      })).localId;
    }
    await json(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`, {
      method: 'POST', headers: { Authorization: 'Bearer owner' }, body: JSON.stringify({ localId: uid, emailVerified: true }),
    });
    const now = new Date().toISOString();
    const doc = {
      name: u.name, email: u.email, business_name: u.business, gstin: '', phone: '', created_at: now, updated_at: now,
      subscription: u.plan ? { plan: 'business_yearly', plan_key: 'business_yearly', active: true, expiry_date: '2027-03-31T18:29:59.000Z', source: 'emulator' } : null,
    };
    await json(`${STORE}/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}`, {
      method: 'PATCH', headers: { Authorization: 'Bearer owner' },
      body: JSON.stringify({ fields: Object.fromEntries(Object.entries(doc).map(([k, v]) => [k, fsValue(v)])) }),
    });
    out[u.email] = uid;
  }
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

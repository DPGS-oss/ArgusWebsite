/**
 * CA portal: hashed invite tokens + read-only client books from owner app_data.
 * CAs do not pay. Owner generates a token; CA signs in and redeems.
 */
const crypto = require('crypto');
const { verifyToken, getUser, getDb } = require('./_shared/firebase-admin');
const { checkRateLimit } = require('./_shared/rate-limit');

const SCOPES = [
  'read:invoices',
  'read:purchases',
  'read:expenses',
  'read:khata',
  'read:gstr',
  'read:inventory',
];

const CA_CORS_ORIGINS = new Set([
  'https://argusinvoicing.com',
  'https://www.argusinvoicing.com',
  'https://argus-invocing.web.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function hashesEqual(a, b) {
  const aa = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function setCaCors(req, res) {
  const origin = String(req.get('origin') || '');
  if (CA_CORS_ORIGINS.has(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
  }
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.set('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
}

function extractToken(req) {
  const header = req.get('authorization') || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return '';
}

async function requireUser(req, res) {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  try {
    const decoded = await verifyToken(token);
    return decoded;
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }
}

function isAccountant(user) {
  const type = String(user?.account_type || '').toLowerCase();
  const role = String(user?.role || '').toLowerCase();
  return type === 'accountant' || role === 'accountant';
}

async function findLink(db, accountantId, ownerId) {
  const id = `${accountantId}_${ownerId}`;
  const doc = await db.collection('links').doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (data.status === 'revoked') return null;
  return data;
}

async function listOwnerInvites(db, ownerId) {
  const q = await db.collection('ca_invites').where('owner_id', '==', ownerId).limit(50).get();
  return q.docs.map((d) => d.data());
}

function isInviteActive(invite) {
  if (!invite || invite.revoked || invite.redeemed) return false;
  return new Date(invite.expires_at).getTime() >= Date.now();
}

async function handleCreateInvite(req, res, decoded) {
  const uid = decoded.uid;
  const user = (await getUser(uid)) || {};
  if (isAccountant(user)) {
    return res.status(403).json({ error: 'Only the business owner can invite a CA' });
  }
  const replace = Boolean(req.body && req.body.replace);
  const db = getDb();
  const existing = await listOwnerInvites(db, uid);
  const active = existing.filter(isInviteActive).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];
  if (active && !replace) {
    return res.status(200).json({
      existing: true,
      expires_at: active.expires_at,
      scopes: active.scopes || SCOPES,
      shown_once: true,
      message: 'An unused invite is already valid for 7 days. Use that link, or send replace=true for a new one.',
    });
  }
  if (replace) {
    const now = new Date().toISOString();
    for (const row of existing) {
      if (row && !row.redeemed && !row.revoked && row.token_hash) {
        await db.collection('ca_invites').doc(row.token_hash).set({
          revoked: true,
          revoked_at: now,
        }, { merge: true });
      }
    }
  }
  const raw = crypto.randomBytes(32).toString('base64url');
  const backup = crypto.randomBytes(6).toString('hex').toUpperCase();
  const tokenHash = sha256(raw);
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  await db.collection('ca_invites').doc(tokenHash).set({
    invite_id: tokenHash.slice(0, 24),
    owner_id: uid,
    token_hash: tokenHash,
    backup_hash: sha256(backup),
    scopes: SCOPES,
    expires_at: expires,
    redeemed: false,
    redeemed_at: null,
    redeemed_by: null,
    revoked: false,
    created_at: now,
    e2ee: true,
  });
  return res.status(200).json({
    token: raw,
    backup_code: backup,
    // Token + AES key stay in the URL fragment only (never query string / server logs).
    redeem_url: 'https://argusinvoicing.com/ca/redeem/',
    expires_at: expires,
    scopes: SCOPES,
    shown_once: true,
    existing: false,
    e2ee: true,
  });
}

/** Owner uploads AES-GCM ciphertext of books; decryption key never stored here. */
async function handleUploadShare(req, res, decoded) {
  const uid = decoded.uid;
  const user = (await getUser(uid)) || {};
  if (isAccountant(user)) {
    return res.status(403).json({ error: 'Only the business owner can upload a CA share' });
  }
  const body = req.body || {};
  const ciphertext = String(body.ciphertext || '');
  const iv = String(body.iv || '');
  if (!ciphertext || !iv) {
    return res.status(400).json({ error: 'ciphertext and iv required' });
  }
  if (ciphertext.length > 8_000_000) {
    return res.status(413).json({ error: 'Share payload too large' });
  }
  const now = new Date().toISOString();
  const db = getDb();
  await db.collection('ca_shares').doc(uid).set({
    owner_id: uid,
    ciphertext,
    iv,
    algo: 'AES-GCM',
    updated_at: now,
  });
  return res.status(200).json({ ok: true, updated_at: now, e2ee: true });
}

async function handleRedeem(req, res, decoded) {
  const uid = decoded.uid;
  const body = req.body || {};
  const token = String(body.token || '').trim();
  const backup = String(body.backup_code || body.code || '').trim().toUpperCase();
  if (!token && !backup) {
    return res.status(400).json({ error: 'token or backup_code required' });
  }
  const db = getDb();

  // Resolve invite doc id outside the transaction (token hash is deterministic;
  // backup lookup needs a query first).
  let inviteRef = null;
  if (token) {
    const tokenHash = sha256(token);
    inviteRef = db.collection('ca_invites').doc(tokenHash);
  } else if (backup) {
    const backupHash = sha256(backup);
    const q = await db.collection('ca_invites').where('backup_hash', '==', backupHash).limit(1).get();
    if (q.empty) {
      return res.status(404).json({ error: 'Invite not found' });
    }
    inviteRef = q.docs[0].ref;
  }

  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(inviteRef);
      if (!snap.exists) {
        return { ok: false, status: 404, error: 'Invite not found' };
      }
      const invite = snap.data() || {};
      if (token) {
        const tokenHash = sha256(token);
        if (!hashesEqual(invite.token_hash || tokenHash, tokenHash)) {
          return { ok: false, status: 404, error: 'Invite not found' };
        }
      }
      if (backup) {
        const backupHash = sha256(backup);
        if (!hashesEqual(invite.backup_hash || '', backupHash)) {
          return { ok: false, status: 404, error: 'Invite not found' };
        }
      }
      if (invite.revoked) {
        return { ok: false, status: 410, error: 'Invite has been revoked' };
      }
      if (invite.redeemed) {
        return { ok: false, status: 409, error: 'Invite already redeemed' };
      }
      if (new Date(invite.expires_at).getTime() < Date.now()) {
        return { ok: false, status: 410, error: 'Invite has expired' };
      }
      const ownerId = invite.owner_id;
      if (ownerId === uid) {
        return {
          ok: false,
          status: 400,
          error: 'You cannot redeem your own invite. Send the link to your CA.',
        };
      }

      const now = new Date().toISOString();
      tx.set(
        inviteRef,
        {
          redeemed: true,
          redeemed_at: now,
          redeemed_by: uid,
        },
        { merge: true },
      );
      const linkRef = db.collection('links').doc(`${uid}_${ownerId}`);
      tx.set(
        linkRef,
        {
          accountant_id: uid,
          owner_id: ownerId,
          created_at: now,
          status: 'active',
          source: 'ca_invite',
          scopes: invite.scopes || SCOPES,
        },
        { merge: true },
      );
      const userRef = db.collection('users').doc(uid);
      tx.set(
        userRef,
        { account_type: 'accountant', role: 'accountant', updated_at: now },
        { merge: true },
      );
      return { ok: true, owner_id: ownerId };
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(200).json({ linked: true, owner_id: result.owner_id });
  } catch (err) {
    console.error('CA redeem transaction failed:', err);
    return res.status(500).json({ error: 'Could not redeem invite' });
  }
}

async function handleClients(req, res, decoded) {
  const uid = decoded.uid;
  const user = (await getUser(uid)) || {};
  if (!isAccountant(user) && user.account_type !== 'accountant') {
    // Allow newly redeemed CAs even if profile lag.
  }
  const db = getDb();
  const q = await db.collection('links').where('accountant_id', '==', uid).get();
  const clients = [];
  for (const doc of q.docs) {
    const link = doc.data();
    if (link.status === 'revoked') continue;
    const ownerId = link.owner_id;
    const owner = (await getUser(ownerId)) || {};
    clients.push({
      owner_id: ownerId,
      business_name: owner.business_name || owner.name || ownerId,
      gstin: owner.gstin || '',
      linked_at: link.created_at,
    });
  }
  return res.status(200).json({ clients, count: clients.length });
}

async function handleBooks(req, res, decoded, ownerId) {
  const uid = decoded.uid;
  const db = getDb();
  const link = await findLink(db, uid, ownerId);
  if (!link) return res.status(403).json({ error: 'Not linked to this business' });

  const shareSnap = await db.collection('ca_shares').doc(ownerId).get();
  if (shareSnap.exists && shareSnap.data().ciphertext && shareSnap.data().iv) {
    const share = shareSnap.data();
    return res.status(200).json({
      owner_id: ownerId,
      e2ee: true,
      ciphertext: share.ciphertext,
      iv: share.iv,
      algo: share.algo || 'AES-GCM',
      updated_at: share.updated_at || null,
      scopes: link.scopes && link.scopes.length ? link.scopes : SCOPES,
    });
  }

  // No ciphertext on file — do not fall back to plaintext app_data.
  return res.status(409).json({
    error:
      'This business has not shared encrypted books yet. Ask the owner to create a new CA invite from Settings.',
    e2ee_required: true,
  });
}

async function handleRevoke(req, res, decoded) {
  const uid = decoded.uid;
  const body = req.body || {};
  const token = String(body.token || '').trim();
  const accountantId = String(body.accountant_id || '').trim();
  const db = getDb();
  if (token) {
    const ref = db.collection('ca_invites').doc(sha256(token));
    const snap = await ref.get();
    if (!snap.exists || snap.data().owner_id !== uid) {
      return res.status(404).json({ error: 'Invite not found' });
    }
    const invite = snap.data();
    await ref.set({ revoked: true, revoked_at: new Date().toISOString() }, { merge: true });
    if (invite.redeemed_by) {
      await db.collection('links').doc(`${invite.redeemed_by}_${uid}`).set({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
      }, { merge: true });
    }
    return res.status(200).json({ revoked: true, kind: 'invite' });
  }
  if (body.unused) {
    const user = (await getUser(uid)) || {};
    if (isAccountant(user)) {
      return res.status(403).json({ error: 'Only the business owner can invite a CA' });
    }
    const rows = await listOwnerInvites(db, uid);
    const now = new Date().toISOString();
    let count = 0;
    for (const row of rows) {
      if (row && !row.redeemed && !row.revoked && row.token_hash) {
        await db.collection('ca_invites').doc(row.token_hash).set({
          revoked: true,
          revoked_at: now,
        }, { merge: true });
        count += 1;
      }
    }
    return res.status(200).json({ revoked: true, kind: 'unused', count });
  }
  if (accountantId) {
    await db.collection('links').doc(`${accountantId}_${uid}`).set({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
    }, { merge: true });
    return res.status(200).json({ revoked: true, kind: 'link', accountant_id: accountantId });
  }
  return res.status(400).json({ error: 'token or accountant_id required' });
}

exports.apiCa = require('firebase-functions/v2/https').onRequest(
  { region: 'us-central1', maxInstances: 10 },
  async (req, res) => {
    setCaCors(req, res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    const decoded = await requireUser(req, res);
    if (!decoded) return;

    const rl = await checkRateLimit(decoded.uid, 'ca_portal');
    if (!rl.allowed) {
      return res.status(429).json({ error: 'Rate limit exceeded', retry_after_seconds: rl.retryAfterSeconds });
    }

    const path = String(req.path || '').replace(/\/+$/, '');
    if (req.method === 'POST' && path.endsWith('/ca/invites')) {
      return handleCreateInvite(req, res, decoded);
    }
    if (req.method === 'POST' && path.endsWith('/ca/share')) {
      return handleUploadShare(req, res, decoded);
    }
    if (req.method === 'POST' && path.endsWith('/ca/invites/redeem')) {
      return handleRedeem(req, res, decoded);
    }
    if (req.method === 'DELETE' && path.endsWith('/ca/invites')) {
      return handleRevoke(req, res, decoded);
    }
    if (req.method === 'GET' && path.endsWith('/ca/clients')) {
      return handleClients(req, res, decoded);
    }
    const booksMatch = path.match(/\/ca\/clients\/([^/]+)\/books$/);
    if (req.method === 'GET' && booksMatch) {
      return handleBooks(req, res, decoded, decodeURIComponent(booksMatch[1]));
    }
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && /\/ca\/clients\//.test(path)) {
      return res.status(403).json({ error: 'CA portal is read-only' });
    }
    return res.status(404).json({ error: 'Unknown CA route' });
  }
);

/**
 * CA portal: hashed invite tokens + read-only client books from owner app_data.
 * CAs do not pay. Owner generates a token; CA signs in and redeems.
 * GSTR-1 JSON and Tally XML are generated here from Firestore invoices (shop
 * phone may be offline). Argus is not a GSP — files are for GSTN offline tool
 * / TallyPrime import / NIC e-invoice JSON only. Does not mint IRNs.
 */
const crypto = require('crypto');
const { verifyToken, getUser, updateUser, getDb } = require('./_shared/firebase-admin');
const { checkRateLimit } = require('./_shared/rate-limit');
const {
  buildGstr1Json,
  buildTallyXml,
  sellerGstinFromAppData,
  companyNameFromAppData,
  parseMonthParam,
  monthBounds,
} = require('./_shared/ca-exports');
const { buildEinvoiceJson, buildEinvoiceBatch } = require('./_shared/einvoice');

const SCOPES = [
  'read:invoices',
  'read:purchases',
  'read:expenses',
  'read:khata',
  'read:gstr',
  'read:inventory',
];

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
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

function booksFromAppData(appData) {
  const data = appData || {};
  return {
    read_only: true,
    invoices: data.invoices || [],
    purchases: data.purchases || [],
    expenses: data.expenses || [],
    khata: data.khataEntries || [],
    inventory: data.stock || [],
    parties: data.parties || [],
    payments: data.payments || [],
    creditNotes: data.creditNotes || [],
  };
}

async function handleCreateInvite(req, res, decoded) {
  const uid = decoded.uid;
  const user = (await getUser(uid)) || {};
  if (isAccountant(user)) {
    return res.status(403).json({ error: 'Only the business owner can invite a CA' });
  }
  const raw = crypto.randomBytes(32).toString('base64url');
  const backup = crypto.randomBytes(4).toString('hex').toUpperCase();
  const tokenHash = sha256(raw);
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  await getDb().collection('ca_invites').doc(tokenHash).set({
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
  });
  return res.status(200).json({
    token: raw,
    backup_code: backup,
    redeem_url: `https://argusinvoicing.com/ca/redeem?token=${raw}`,
    expires_at: expires,
    scopes: SCOPES,
    shown_once: true,
  });
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
  let snap = null;
  if (token) {
    snap = await db.collection('ca_invites').doc(sha256(token)).get();
  }
  if ((!snap || !snap.exists) && backup) {
    const q = await db.collection('ca_invites').where('backup_hash', '==', sha256(backup)).limit(1).get();
    snap = q.empty ? null : q.docs[0];
  }
  if (!snap || !snap.exists) {
    return res.status(404).json({ error: 'Invite not found' });
  }
  const invite = snap.data();
  if (invite.revoked) return res.status(410).json({ error: 'Invite has been revoked' });
  if (invite.redeemed) return res.status(409).json({ error: 'Invite already redeemed' });
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return res.status(410).json({ error: 'Invite has expired' });
  }
  const now = new Date().toISOString();
  await snap.ref.set({
    redeemed: true,
    redeemed_at: now,
    redeemed_by: uid,
  }, { merge: true });
  const ownerId = invite.owner_id;
  await db.collection('links').doc(`${uid}_${ownerId}`).set({
    accountant_id: uid,
    owner_id: ownerId,
    created_at: now,
    status: 'active',
    source: 'ca_invite',
    scopes: invite.scopes || SCOPES,
  }, { merge: true });
  await updateUser(uid, { account_type: 'accountant', role: 'accountant', updated_at: now });
  return res.status(200).json({ linked: true, owner_id: ownerId });
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

async function loadOwnerAppData(ownerId) {
  const doc = await getDb().collection('users').doc(ownerId).collection('app_data').doc('main').get();
  return {
    appData: doc.exists ? (doc.data().appData || {}) : {},
    updated_at: doc.exists ? doc.data().updated_at : null,
  };
}

function sendAttachment(res, { body, contentType, filename }) {
  res.set('Content-Type', contentType);
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.set('Cache-Control', 'no-store');
  res.set('Access-Control-Expose-Headers', 'Content-Disposition');
  return res.status(200).send(body);
}

async function handleBooks(req, res, decoded, ownerId) {
  const uid = decoded.uid;
  const db = getDb();
  const link = await findLink(db, uid, ownerId);
  if (!link) return res.status(403).json({ error: 'Not linked to this business' });
  const { appData, updated_at } = await loadOwnerAppData(ownerId);
  return res.status(200).json({
    owner_id: ownerId,
    ...booksFromAppData(appData),
    updated_at,
    scopes: link.scopes || SCOPES,
  });
}

async function handleGstr1Download(req, res, decoded, ownerId) {
  const uid = decoded.uid;
  const link = await findLink(getDb(), uid, ownerId);
  if (!link) return res.status(403).json({ error: 'Not linked to this business' });
  const { appData } = await loadOwnerAppData(ownerId);
  const month = parseMonthParam(req.query && req.query.month);
  const json = buildGstr1Json({
    gstin: sellerGstinFromAppData(appData),
    month,
    invoices: appData.invoices || [],
  });
  const { fp } = monthBounds(month);
  return sendAttachment(res, {
    body: JSON.stringify(json, null, 2),
    contentType: 'application/json; charset=utf-8',
    filename: `GSTR1_${fp}.json`,
  });
}

function businessForInvoice(appData, inv) {
  const list = (appData && appData.businesses) || [];
  return (
    list.find((b) => b && b.id === (inv && inv.businessId)) ||
    list.find((b) => b && b.id === (appData && appData.activeBusinessId)) ||
    list[0] ||
    {}
  );
}

async function requireLinkedOrOwner(uid, ownerId) {
  if (uid && ownerId && uid === ownerId) return { owner: true };
  return findLink(getDb(), uid, ownerId);
}

async function handleEinvoiceDownload(req, res, decoded, ownerId) {
  const uid = decoded.uid;
  const access = await requireLinkedOrOwner(uid, ownerId);
  if (!access) return res.status(403).json({ error: 'Not linked to this business' });
  const { appData } = await loadOwnerAppData(ownerId);
  const invoiceNo = String((req.query && (req.query.invoice || req.query.inum)) || '').trim();
  if (invoiceNo) {
    const inv = (appData.invoices || []).find(
      (i) => i.invoiceNumber === invoiceNo || i.id === invoiceNo
    );
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    const json = buildEinvoiceJson({
      invoice: inv,
      business: businessForInvoice(appData, inv),
    });
    const safe = invoiceNo.replace(/[^A-Za-z0-9._-]+/g, '_');
    return sendAttachment(res, {
      body: JSON.stringify(json, null, 2),
      contentType: 'application/json; charset=utf-8',
      filename: `EInvoice_${safe}.json`,
    });
  }
  const month = parseMonthParam(req.query && req.query.month);
  const batch = buildEinvoiceBatch({
    month,
    invoices: appData.invoices || [],
    businesses: appData.businesses || [],
  });
  const { fp } = monthBounds(month);
  return sendAttachment(res, {
    body: JSON.stringify(batch, null, 2),
    contentType: 'application/json; charset=utf-8',
    filename: `EInvoice_${fp}.json`,
  });
}

async function handleTallyDownload(req, res, decoded, ownerId) {
  const uid = decoded.uid;
  const link = await findLink(getDb(), uid, ownerId);
  if (!link) return res.status(403).json({ error: 'Not linked to this business' });
  const { appData } = await loadOwnerAppData(ownerId);
  const month = parseMonthParam(req.query && req.query.month);
  const xml = buildTallyXml({
    companyName: companyNameFromAppData(appData),
    month,
    invoices: appData.invoices || [],
  });
  const { fp } = monthBounds(month);
  return sendAttachment(res, {
    body: xml,
    contentType: 'application/xml; charset=utf-8',
    filename: `Tally_${fp}.xml`,
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
    await ref.set({ revoked: true, revoked_at: new Date().toISOString() }, { merge: true });
    return res.status(200).json({ revoked: true, kind: 'invite' });
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
    res.set('Access-Control-Allow-Origin', req.get('origin') || '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.set('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.set('Access-Control-Expose-Headers', 'Content-Disposition');
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
    const gstr1Match = path.match(/\/ca\/clients\/([^/]+)\/gstr1$/);
    if (req.method === 'GET' && gstr1Match) {
      return handleGstr1Download(req, res, decoded, decodeURIComponent(gstr1Match[1]));
    }
    const tallyMatch = path.match(/\/ca\/clients\/([^/]+)\/tally$/);
    if (req.method === 'GET' && tallyMatch) {
      return handleTallyDownload(req, res, decoded, decodeURIComponent(tallyMatch[1]));
    }
    const einvoiceMatch = path.match(/\/ca\/clients\/([^/]+)\/einvoice$/);
    if (req.method === 'GET' && einvoiceMatch) {
      return handleEinvoiceDownload(req, res, decoded, decodeURIComponent(einvoiceMatch[1]));
    }
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && /\/ca\/clients\//.test(path)) {
      return res.status(403).json({ error: 'CA portal is read-only' });
    }
    return res.status(404).json({ error: 'Unknown CA route' });
  }
);

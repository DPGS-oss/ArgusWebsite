/**
 * Team: more than one person on one set of books (see _shared/team.js).
 *
 *   GET  /api/team                      who I am in these books; my team or my invite
 *   POST /api/team/invite   { email, access }
 *   POST /api/team/access   { email, access }
 *   POST /api/team/remove   { email }
 *   POST /api/team/accept                (the invited person, signed in with that email)
 *   POST /api/team/leave                 (a member)
 *   POST /api/team/seats/order  { add }  Razorpay order for extra users
 *   POST /api/team/seats/verify { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
const { onRequest } = require('firebase-functions/v2/https');
const { verifyToken, getUser, getDb } = require('./_shared/firebase-admin');
const { checkRateLimit } = require('./_shared/rate-limit');
const { hasActiveBusinessSubscription } = require('./_shared/subscription-utils');
const { razorpayFetch, getRazorpayCredentials } = require('./_shared/razorpay-client');
const { safeEqualString, hmacSha256Hex } = require('./_shared/crypto-safe');
const team = require('./_shared/team');

const SECRETS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
];

function extractToken(req) {
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const planExpiry = (user) => {
  const s = user && user.subscription;
  return (s && (s.expiry_date || s.expiryDate)) || null;
};

async function me(db, uid, email) {
  const ctx = await team.resolveBooks(db, uid);
  const out = { ...ctx };
  if (ctx.role === 'owner') {
    out.team = team.teamSummary(await team.loadTeam(db, uid));
    const idx = email ? await db.collection('memberIndex').doc(email).get() : null;
    if (idx && idx.exists && idx.data().ownerUid !== uid) {
      const ownerUid = idx.data().ownerUid;
      const t = await team.loadTeam(db, ownerUid);
      const m = team.liveMembers(t).find((x) => x.email === email);
      if (m && m.status === 'invited') out.invite = { ownerName: (t && t.ownerName) || '', access: m.access };
    }
  }
  return out;
}

/** Runs `fn(team)` on the owner's team in a transaction; `fn` returns the new team. */
async function updateTeam(db, ownerUid, fn) {
  const ref = db.collection('teams').doc(ownerUid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data() : { members: [], extraSeats: 0, seatsPaidUntil: null };
    const next = await fn({ ...current, members: [...(current.members || [])] }, tx);
    tx.set(ref, next);
    return next;
  });
}

async function requireOwnerWithPlan(db, uid) {
  const ctx = await team.resolveBooks(db, uid);
  if (ctx.role !== 'owner') throw new HttpError(403, 'Only the owner of the books can manage users');
  const user = await getUser(uid);
  if (!hasActiveBusinessSubscription(user)) throw new HttpError(402, 'Adding users needs the Business plan', { requires_subscription: true });
  return user;
}

async function handle(req, uid, decoded) {
  const db = getDb();
  const path = (req.path || '').replace(/^\/api\/team/, '').replace(/\/+$/, '') || '/';
  const body = req.body || {};
  const myEmail = decoded.email_verified ? team.normEmail(decoded.email) : '';

  if (req.method === 'GET' && path === '/') return me(db, uid, myEmail);
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');

  if (path === '/invite') {
    const owner = await requireOwnerWithPlan(db, uid);
    const email = team.normEmail(body.email);
    const access = team.ACCESS.has(body.access) ? body.access : 'billing';
    if (!team.validEmail(email)) throw new HttpError(400, 'Enter a valid email');
    if (email === team.normEmail(decoded.email)) throw new HttpError(400, 'That is your own email');
    const idxRef = db.collection('memberIndex').doc(email);
    const next = await updateTeam(db, uid, async (t, tx) => {
      const idx = await tx.get(idxRef);
      if (idx.exists && idx.data().ownerUid !== uid) throw new HttpError(409, 'This person already uses someone else\'s books');
      if (team.liveMembers(t).some((m) => m.email === email)) throw new HttpError(409, 'Already invited');
      if (team.liveMembers(t).length + 1 >= team.allowedUsers(t)) {
        throw new HttpError(402, `Your plan has room for ${team.allowedUsers(t)} users. Add a user for ₹50 a month.`, { needs_seats: true });
      }
      const series = team.nextSeries(t);
      if (!series) throw new HttpError(409, 'No more bill series letters are free');
      t.ownerName = owner.business_name || owner.name || t.ownerName || '';
      t.members.push({ email, access, series, status: 'invited', uid: null, name: '', invitedAt: new Date().toISOString() });
      tx.set(idxRef, { ownerUid: uid });
      return t;
    });
    return { team: team.teamSummary(next) };
  }

  if (path === '/access') {
    await requireOwnerWithPlan(db, uid);
    const email = team.normEmail(body.email);
    if (!team.ACCESS.has(body.access)) throw new HttpError(400, 'Pick billing or full access');
    const next = await updateTeam(db, uid, async (t) => {
      const m = team.liveMembers(t).find((x) => x.email === email);
      if (!m) throw new HttpError(404, 'Not in your team');
      m.access = body.access;
      return t;
    });
    return { team: team.teamSummary(next) };
  }

  if (path === '/remove') {
    const email = team.normEmail(body.email);
    const ctx = await team.resolveBooks(db, uid);
    if (ctx.role !== 'owner') throw new HttpError(403, 'Only the owner of the books can manage users');
    const next = await updateTeam(db, uid, async (t, tx) => {
      const m = team.liveMembers(t).find((x) => x.email === email);
      if (!m) throw new HttpError(404, 'Not in your team');
      m.status = 'removed';
      m.removedAt = new Date().toISOString();
      tx.delete(db.collection('memberIndex').doc(email));
      if (m.uid) tx.delete(db.collection('memberships').doc(m.uid));
      return t;
    });
    return { team: team.teamSummary(next) };
  }

  if (path === '/accept') {
    if (!myEmail) throw new HttpError(403, 'Sign in with the invited email (verified) to join');
    const own = await team.loadTeam(db, uid);
    if (team.liveMembers(own).length) throw new HttpError(409, 'Remove the users in your own books first');
    const idx = await db.collection('memberIndex').doc(myEmail).get();
    if (!idx.exists) throw new HttpError(404, 'No invite for this email');
    const ownerUid = idx.data().ownerUid;
    const self = await getUser(uid);
    await updateTeam(db, ownerUid, async (t, tx) => {
      const m = team.liveMembers(t).find((x) => x.email === myEmail);
      if (!m || m.status !== 'invited') throw new HttpError(404, 'No invite for this email');
      m.status = 'active';
      m.uid = uid;
      m.name = (self && self.name) || decoded.name || myEmail.split('@')[0];
      m.joinedAt = new Date().toISOString();
      tx.set(db.collection('memberships').doc(uid), { ownerUid });
      return t;
    });
    return me(db, uid, myEmail);
  }

  if (path === '/leave') {
    const mem = await db.collection('memberships').doc(uid).get();
    if (!mem.exists) throw new HttpError(404, 'You are not in anyone else\'s books');
    const ownerUid = mem.data().ownerUid;
    await updateTeam(db, ownerUid, async (t, tx) => {
      const m = team.liveMembers(t).find((x) => x.uid === uid);
      if (m) {
        m.status = 'removed';
        m.removedAt = new Date().toISOString();
        tx.delete(db.collection('memberIndex').doc(m.email));
      }
      tx.delete(db.collection('memberships').doc(uid));
      return t;
    });
    return me(db, uid, myEmail);
  }

  if (path === '/seats/order') {
    const owner = await requireOwnerWithPlan(db, uid);
    const add = Math.floor(Number(body.add) || 0);
    const t = await team.loadTeam(db, uid);
    if (add < 1 || team.paidExtraSeats(t) + add > team.MAX_EXTRA_SEATS) throw new HttpError(400, 'Pick how many users to add');
    // Extra users run to the end of the current extra-user period, or of the plan.
    const until = team.paidExtraSeats(t) ? t.seatsPaidUntil : planExpiry(owner);
    const { months, amount } = team.seatQuote(add, until);
    const { keyId } = getRazorpayCredentials();
    const order = await razorpayFetch('/v1/orders', {
      method: 'POST',
      body: JSON.stringify({
        amount, currency: 'INR', receipt: `seats_${Date.now()}`.slice(0, 40), payment_capture: 1,
        notes: { uid, kind: 'team_seats', add: String(add), until: String(until), months: String(months) },
      }),
    });
    return { order_id: order.id, amount, months, until, key_id: keyId };
  }

  if (path === '/seats/verify') {
    await requireOwnerWithPlan(db, uid);
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sig } = body;
    const { keySecret } = getRazorpayCredentials();
    if (!orderId || !paymentId || !sig) throw new HttpError(400, 'Missing payment details');
    if (!safeEqualString(hmacSha256Hex(keySecret, `${orderId}|${paymentId}`), String(sig))) throw new HttpError(400, 'Invalid payment signature');
    const order = await razorpayFetch(`/v1/orders/${encodeURIComponent(orderId)}`);
    const payment = await razorpayFetch(`/v1/payments/${encodeURIComponent(paymentId)}`);
    const notes = order.notes || {};
    if (notes.kind !== 'team_seats' || notes.uid !== uid) throw new HttpError(400, 'This payment is not for adding users');
    if (payment.order_id !== orderId || !['captured', 'authorized'].includes(payment.status) || Number(payment.amount) !== Number(order.amount)) {
      throw new HttpError(400, 'Payment not complete');
    }
    const payRef = db.collection('payments').doc(`seats_${paymentId}`);
    const next = await updateTeam(db, uid, async (t, tx) => {
      const seen = await tx.get(payRef);
      if (seen.exists) return t;
      t.extraSeats = team.paidExtraSeats(t) + Math.max(0, Math.floor(Number(notes.add) || 0));
      t.seatsPaidUntil = notes.until;
      tx.set(payRef, { user_id: uid, kind: 'team_seats', order_id: orderId, amount: order.amount, add: notes.add, until: notes.until, status: 'verified', at: new Date().toISOString() });
      return t;
    });
    return { team: team.teamSummary(next) };
  }

  throw new HttpError(404, 'Not found');
}

exports.apiTeam = onRequest({ region: 'us-central1', maxInstances: 10, secrets: SECRETS }, async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch (_) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  const rl = await checkRateLimit(decoded.uid, 'team');
  if (!rl.allowed) return res.status(429).json({ error: 'Rate limit exceeded', retry_after_seconds: rl.retryAfterSeconds });
  try {
    return res.status(200).json(await handle(req, decoded.uid, decoded));
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra });
    console.error('Team error:', err);
    return res.status(err.status || 500).json({ error: 'Something went wrong' });
  }
});

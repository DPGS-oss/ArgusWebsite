/**
 * More than one person on one set of books (one GSTIN).
 *
 * The owner invites people by email and picks what each can do:
 *   "billing" — make bills, customers, stock, payments; no purchases,
 *               expenses, payroll, GST returns or business settings.
 *   "full"    — everything the owner can do except managing the team.
 *
 * The Business plan includes 2 users (the owner and one more). Each extra
 * user is ₹50 a month, paid up to the end of the owner's plan.
 *
 * Firestore (Cloud Functions only; no client access):
 *   teams/{ownerUid}        { ownerName, members: [Member], extraSeats, seatsPaidUntil }
 *   memberIndex/{email}     { ownerUid }   — pending or active invite for an email
 *   memberships/{memberUid} { ownerUid }   — whose books this person opens
 *
 * The team document is the source of truth: a membership only counts while
 * the owner's team lists that person as active and within the paid seats.
 */

const ACCESS = new Set(['billing', 'full']);
const INCLUDED_USERS = 2;
const SEAT_PRICE_PAISE = 5000;
// Bill-number series letters for members (the owner has none; "W" is the website's).
const SERIES = 'BCDEFGHJKLMNPQRSTUVXYZ'.split('');
const MAX_EXTRA_SEATS = 20;

const normEmail = (e) => String(e || '').trim().toLowerCase();
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;

/** Keys a billing-only member cannot change; the first four they cannot see either. */
const HIDDEN_FROM_BILLING = ['purchases', 'expenses', 'payroll', 'gstr2b'];
const LOCKED_FOR_BILLING = [...HIDDEN_FROM_BILLING, 'businesses', 'settings'];

function paidExtraSeats(team, now = Date.now()) {
  if (!team || !team.seatsPaidUntil) return 0;
  const until = Date.parse(team.seatsPaidUntil);
  return Number.isFinite(until) && until > now ? Math.max(0, Math.min(MAX_EXTRA_SEATS, Number(team.extraSeats) || 0)) : 0;
}

/** Everyone who may use the books, owner included. */
function allowedUsers(team, now = Date.now()) {
  return INCLUDED_USERS + paidExtraSeats(team, now);
}

function liveMembers(team) {
  return (team && Array.isArray(team.members) ? team.members : []).filter((m) => m && m.status !== 'removed');
}

/** Members who have access now: earliest invited first, up to the seats. */
function membersWithAccess(team, now = Date.now()) {
  return liveMembers(team).slice(0, Math.max(0, allowedUsers(team, now) - 1));
}

/**
 * Bill series letter for a new member: their old letter if they were here
 * before, else one never used, else one freed by someone removed. Reusing is
 * safe: numbering continues after the highest number already in the books.
 */
function nextSeries(team, email = '') {
  const all = team && Array.isArray(team.members) ? team.members : [];
  const live = new Set(liveMembers(team).map((m) => m.series));
  const before = all.find((m) => m && m.email === email && m.series && !live.has(m.series));
  if (before) return before.series;
  const ever = new Set(all.map((m) => m && m.series));
  return SERIES.find((s) => !ever.has(s)) || SERIES.find((s) => !live.has(s)) || null;
}

/** What one person may do in a set of books. */
function contextFor(uid, ownerUid, team, now = Date.now()) {
  if (!ownerUid) return { booksUid: uid, role: 'owner', access: 'full', series: '' };
  const m = membersWithAccess(team, now).find((x) => x.uid === uid && x.status === 'active');
  if (!m) {
    const listed = liveMembers(team).some((x) => x.uid === uid);
    return { booksUid: uid, role: 'owner', access: 'full', series: '', lapsed: listed };
  }
  return {
    booksUid: ownerUid,
    role: 'member',
    access: ACCESS.has(m.access) ? m.access : 'billing',
    series: m.series || '',
    ownerUid,
    ownerName: (team && team.ownerName) || '',
  };
}

// Edit-log lines about what billing-only users cannot see.
const HIDDEN_LOG_ENTITIES = new Set(['purchase', 'expense', 'payroll', 'business', 'settings', 'user']);
const auditForBilling = (log) => (Array.isArray(log) ? log.filter((e) => !(e && HIDDEN_LOG_ENTITIES.has(e.entity))) : log);

/** Books as a billing-only member sees them. */
function viewFor(data, access) {
  if (!data || access !== 'billing') return data;
  const out = { ...data };
  for (const k of HIDDEN_FROM_BILLING) out[k] = Array.isArray(data[k]) ? [] : k === 'gstr2b' ? {} : data[k];
  out.auditLog = auditForBilling(data.auditLog);
  return out;
}

const ISSUED = ['invoices', 'creditNotes', 'debitNotes'];
const isDraftDoc = (d) => String((d && d.status) || '').toLowerCase() === 'draft';

/**
 * Issued bills and notes stay: a member cannot remove them by leaving them
 * out or marking them deleted (only drafts can go).
 */
function keepIssued(base, out) {
  const deleted = { ...(out.deleted || {}) };
  for (const k of ISSUED) {
    const was = Array.isArray(base[k]) ? base[k] : [];
    const issued = new Map(was.filter((d) => d && d.id && !isDraftDoc(d)).map((d) => [String(d.id), d]));
    if (deleted[k]) {
      const ids = { ...deleted[k] };
      for (const id of Object.keys(ids)) if (issued.has(id)) delete ids[id];
      deleted[k] = ids;
    }
    const list = Array.isArray(out[k]) ? [...out[k]] : [];
    const present = new Set(list.map((d) => String(d && d.id)));
    for (const [id, d] of issued) if (!present.has(id)) list.push(d);
    out[k] = list;
  }
  out.deleted = deleted;
  return out;
}

/** A member's save: billing-only cannot change or delete what is locked; nobody removes issued bills. */
function mergeMemberSave(stored, incoming, access) {
  const base = stored || {};
  if (access !== 'billing') return keepIssued(base, { ...incoming });
  const out = { ...incoming };
  for (const k of LOCKED_FOR_BILLING) {
    if (base[k] !== undefined) out[k] = base[k];
    else delete out[k];
  }
  const deleted = { ...(base.deleted || {}) };
  for (const [k, ids] of Object.entries((incoming && incoming.deleted) || {})) {
    if (LOCKED_FOR_BILLING.includes(k)) continue;
    deleted[k] = { ...(deleted[k] || {}), ...(ids || {}) };
  }
  out.deleted = deleted;
  return keepIssued(base, out);
}

/** Cost of adding `add` users from now until `until` (whole months, at least one). */
function seatQuote(add, until, now = Date.now()) {
  const end = Date.parse(until);
  const days = Number.isFinite(end) ? (end - now) / 86400000 : 0;
  const months = Math.min(12, Math.max(1, Math.ceil(days / 30)));
  return { months, amount: add * SEAT_PRICE_PAISE * months };
}

/** Public view of the team for the owner. */
function teamSummary(team, now = Date.now()) {
  const withAccess = new Set(membersWithAccess(team, now).map((m) => m.email));
  return {
    included: INCLUDED_USERS,
    allowed: allowedUsers(team, now),
    extraSeats: paidExtraSeats(team, now),
    seatsPaidUntil: paidExtraSeats(team, now) ? team.seatsPaidUntil : null,
    seatPricePaise: SEAT_PRICE_PAISE,
    members: liveMembers(team).map((m) => ({
      email: m.email,
      name: m.name || '',
      access: m.access,
      status: m.status,
      series: m.series,
      hasAccess: withAccess.has(m.email),
    })),
  };
}

// ------------------------------------------------------------- Firestore

async function loadTeam(db, ownerUid) {
  const snap = await db.collection('teams').doc(ownerUid).get();
  return snap.exists ? snap.data() : null;
}

/** Whose books this signed-in person opens, and what they may do there. */
async function resolveBooks(db, uid) {
  const mem = await db.collection('memberships').doc(uid).get();
  const ownerUid = mem.exists ? String(mem.data().ownerUid || '') : '';
  if (!ownerUid) return contextFor(uid, '', null);
  return contextFor(uid, ownerUid, await loadTeam(db, ownerUid));
}

/**
 * The context plus the user record whose plan applies (the owner's, for a
 * member). `getUser` is passed in so this module needs no admin import.
 */
async function booksAccess(db, getUser, uid) {
  const ctx = await resolveBooks(db, uid);
  const self = await getUser(uid);
  if (ctx.role !== 'member') return { ctx, user: self, planUser: self };
  const owner = await getUser(ctx.booksUid);
  return { ctx, user: self, planUser: owner };
}

/** On account deletion: leave any team, and close one's own team. */
async function removeFromTeams(db, uid) {
  const mem = await db.collection('memberships').doc(uid).get();
  if (mem.exists) {
    const ref = db.collection('teams').doc(mem.data().ownerUid);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const t = snap.exists ? snap.data() : null;
      if (t) {
        const members = (t.members || []).map((m) => (m.uid === uid && m.status !== 'removed' ? { ...m, status: 'removed', removedAt: new Date().toISOString() } : m));
        for (const m of (t.members || []).filter((x) => x.uid === uid)) tx.delete(db.collection('memberIndex').doc(m.email));
        tx.set(ref, { ...t, members });
      }
      tx.delete(db.collection('memberships').doc(uid));
    });
  }
  const own = await loadTeam(db, uid);
  if (own) {
    const batch = db.batch();
    for (const m of liveMembers(own)) {
      batch.delete(db.collection('memberIndex').doc(m.email));
      if (m.uid) batch.delete(db.collection('memberships').doc(m.uid));
    }
    batch.delete(db.collection('teams').doc(uid));
    await batch.commit();
  }
}

module.exports = {
  removeFromTeams,
  ACCESS,
  INCLUDED_USERS,
  SEAT_PRICE_PAISE,
  MAX_EXTRA_SEATS,
  HIDDEN_FROM_BILLING,
  LOCKED_FOR_BILLING,
  normEmail,
  validEmail,
  paidExtraSeats,
  allowedUsers,
  liveMembers,
  membersWithAccess,
  nextSeries,
  contextFor,
  viewFor,
  auditForBilling,
  mergeMemberSave,
  seatQuote,
  teamSummary,
  loadTeam,
  resolveBooks,
  booksAccess,
};

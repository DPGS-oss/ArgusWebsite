/**
 * Where a user's books live in Firestore.
 *
 * Everything sits under users/{uid}/app_data/main. A Firestore document holds
 * at most 1 MiB, and big shops pass that with bills, stock movements and the
 * edit log, so the books are split:
 *
 *   app_data/main                 { appData: <small parts>, storage: <manifest>,
 *                                   updated_at, version, device }
 *   app_data/main/chunks/{key~n}  { key, part, parts, hash, data: <gzip bytes> }
 *
 * Any top-level part of appData bigger than INLINE_KEY_BYTES as JSON (bills,
 * edit log, stock movements, khata...) is stored as gzipped JSON cut into
 * pieces of at most CHUNK_BYTES. The manifest says which parts moved out, how
 * many pieces each has and a hash of its contents, so an unchanged part is
 * not rewritten.
 *
 * The main document stays the single point of truth: every save and phone
 * sync reads it (and its pieces) and writes it in one transaction, so the
 * updated_at check and the phone-sync merge work as before. Documents in the
 * old one-document format are rewritten in the new format the first time
 * they are read, keeping their updated_at so open browsers are not disturbed.
 */
const crypto = require('crypto');
const zlib = require('zlib');
const { resolveAppData } = require('./app_data');

const FORMAT = 2;
// A part of appData bigger than this (as JSON) is moved into chunk documents.
const INLINE_KEY_BYTES = 16 * 1024;
// The small parts left in the main document together stay under this.
const INLINE_TOTAL_BYTES = 256 * 1024;
// Gzipped bytes per chunk document (Firestore allows 1 MiB per document).
const CHUNK_BYTES = 700 * 1024;
// One transaction can send about 10 MiB; leave room for the main document.
const MAX_WRITE_BYTES = 8 * 1024 * 1024;
// Keys that can become document ids as they are.
const SAFE_KEY = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

class BooksTooLargeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BooksTooLargeError';
  }
}

const booksRef = (db, uid) => db.collection('users').doc(uid).collection('app_data').doc('main');
const chunkId = (key, part) => `${key}~${part}`;
const chunkRef = (ref, key, part) => ref.collection('chunks').doc(chunkId(key, part));
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const hashOf = (json) => crypto.createHash('sha256').update(json).digest('hex').slice(0, 32);

/**
 * What `set(..., { merge: true })` used to do to the stored appData map:
 * nested maps merge key by key, anything else (arrays included) is replaced,
 * and parts the new data does not mention are kept.
 */
function mergeLikeFirestore(stored, incoming) {
  if (!isPlainObject(stored) || !isPlainObject(incoming) || !Object.keys(incoming).length) return incoming;
  const out = { ...stored };
  for (const [k, v] of Object.entries(incoming)) {
    if (v === undefined) continue;
    out[k] = isPlainObject(v) && isPlainObject(stored[k]) ? mergeLikeFirestore(stored[k], v) : v;
  }
  return out;
}

/**
 * Split appData into the part kept in the main document and gzipped pieces.
 * Pure: returns { inline, manifest, pieces: { key: [Buffer] } }.
 */
function splitAppData(appData) {
  const data = isPlainObject(appData) ? appData : {};
  const sizes = [];
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    const json = JSON.stringify(v);
    if (json === undefined) continue;
    sizes.push({ k, v, json, bytes: Buffer.byteLength(json, 'utf8') });
  }
  // Largest first, so the main document keeps the many small parts.
  sizes.sort((a, b) => b.bytes - a.bytes);
  let inlineBytes = sizes.reduce((t, s) => t + s.bytes, 0);
  const inline = {};
  const manifest = { format: FORMAT, keys: {} };
  const pieces = {};
  for (const s of sizes) {
    const moveOut = SAFE_KEY.test(s.k) && (s.bytes > INLINE_KEY_BYTES || inlineBytes > INLINE_TOTAL_BYTES);
    if (!moveOut) {
      inline[s.k] = s.v;
      continue;
    }
    inlineBytes -= s.bytes;
    const gz = zlib.gzipSync(Buffer.from(s.json, 'utf8'));
    const parts = [];
    for (let i = 0; i < gz.length; i += CHUNK_BYTES) parts.push(gz.subarray(i, i + CHUNK_BYTES));
    pieces[s.k] = parts;
    manifest.keys[s.k] = {
      parts: parts.length,
      hash: hashOf(s.json),
      bytes: gz.length,
      count: Array.isArray(s.v) ? s.v.length : null,
    };
  }
  if (inlineBytes > INLINE_TOTAL_BYTES * 2) {
    throw new BooksTooLargeError('The books have too much data in parts that cannot be split.');
  }
  return { inline, manifest, pieces };
}

/** Put appData back together from the main document's data and its chunk documents. */
function joinAppData(docData, chunkDocs) {
  const manifest = docData && docData.storage;
  const out = { ...((docData && docData.appData) || {}) };
  if (!manifest || !manifest.keys) return out;
  const byId = new Map();
  for (const c of chunkDocs || []) if (c) byId.set(chunkId(c.key, c.part), c);
  for (const [key, m] of Object.entries(manifest.keys)) {
    const bufs = [];
    for (let i = 0; i < m.parts; i++) {
      const c = byId.get(chunkId(key, i));
      if (!c || c.hash !== m.hash) throw new Error(`Books storage: piece ${i} of "${key}" is missing or out of date`);
      bufs.push(Buffer.from(c.data));
    }
    const json = zlib.gunzipSync(Buffer.concat(bufs)).toString('utf8');
    if (hashOf(json) !== m.hash) throw new Error(`Books storage: "${key}" does not match its hash`);
    out[key] = JSON.parse(json);
  }
  return out;
}

const isSplit = (docData) => Boolean(docData && docData.storage && docData.storage.format === FORMAT);

/**
 * Read the books inside a transaction (reads must come before any write).
 * Returns { exists, legacy, doc, manifest } where `doc` looks like the old
 * one-document format: the main document's fields with the whole appData,
 * so resolveAppData(doc) and doc.updated_at work as they always did.
 */
async function readBooksTx(tx, ref) {
  const snap = await tx.get(ref);
  if (!snap.exists) return { exists: false, legacy: false, doc: null, manifest: null };
  const data = snap.data() || {};
  if (!isSplit(data)) return { exists: true, legacy: true, doc: data, manifest: null };
  const refs = [];
  for (const [key, m] of Object.entries(data.storage.keys || {})) {
    for (let i = 0; i < m.parts; i++) refs.push(chunkRef(ref, key, i));
  }
  const chunks = refs.length ? (await tx.getAll(...refs)).map((s) => (s.exists ? s.data() : null)) : [];
  return { exists: true, legacy: false, doc: { ...data, appData: joinAppData(data, chunks) }, manifest: data.storage };
}

/** appData as stored before this write (for merging), whatever the format. */
function storedAppData(prev) {
  if (!prev || !prev.exists) return null;
  if (prev.doc.appData && typeof prev.doc.appData === 'object') return prev.doc.appData;
  return resolveAppData(prev.doc);
}

/**
 * Write the books inside the same transaction as `readBooksTx` (pass what it
 * returned as `prev`). `meta` sets updated_at, version and device; missing
 * ones keep their stored values. With `merge` (the default, like the old
 * set(..., { merge: true })) parts of the stored appData that `appData` does
 * not mention are kept. Returns the appData that was stored.
 */
function writeBooksTx(tx, ref, prev, appData, meta = {}, { merge = true } = {}) {
  const before = storedAppData(prev);
  const full = merge && before ? mergeLikeFirestore(before, appData) : appData;
  const { inline, manifest, pieces } = splitAppData(full);
  const old = (prev && prev.manifest && prev.manifest.keys) || {};

  // Every byte counts toward the request limit, so check before queueing writes.
  let writeBytes = 0;
  const changed = Object.keys(manifest.keys).filter((key) => {
    const was = old[key];
    return !(was && was.hash === manifest.keys[key].hash && was.parts === manifest.keys[key].parts);
  });
  for (const key of changed) writeBytes += manifest.keys[key].bytes;
  if (writeBytes > MAX_WRITE_BYTES) throw new BooksTooLargeError('The books are too large to save in one go.');

  for (const key of changed) {
    const m = manifest.keys[key];
    pieces[key].forEach((buf, part) => {
      tx.set(chunkRef(ref, key, part), { key, part, parts: m.parts, hash: m.hash, data: buf });
    });
  }
  for (const [key, was] of Object.entries(old)) {
    const keep = manifest.keys[key] ? manifest.keys[key].parts : 0;
    for (let i = keep; i < was.parts; i++) tx.delete(chunkRef(ref, key, i));
  }

  // Rewritten whole, so old-format fields (data, data_compressed) go away
  // and parts that moved out of the main document are not left behind.
  const { appData: _a, data: _d, data_compressed: _c, storage: _s, ...rest } = (prev && prev.doc) || {};
  const doc = { ...rest, appData: inline, storage: manifest };
  for (const k of ['updated_at', 'version', 'device']) {
    if (meta[k] !== undefined) doc[k] = meta[k];
  }
  tx.set(ref, doc);
  return full;
}

/**
 * Read a user's books outside any other transaction. Old-format documents
 * are moved to the new format on the way (unless `migrate` is false), with
 * updated_at, version and device kept as they were.
 */
async function readBooks(db, uid, { migrate = true } = {}) {
  const ref = booksRef(db, uid);
  return db.runTransaction(async (tx) => {
    const cur = await readBooksTx(tx, ref);
    if (migrate && cur.exists && cur.legacy) {
      const appData = storedAppData(cur);
      if (appData) writeBooksTx(tx, ref, cur, appData, {}, { merge: false });
    }
    return cur;
  });
}

/** Delete the books with all their chunk documents. */
async function deleteBooks(db, uid) {
  await db.recursiveDelete(booksRef(db, uid));
}

/**
 * appData from the main document alone, for counting: parts stored in chunks
 * appear as { length } from the manifest, so `(data.invoices || []).length`
 * works without reading the chunks.
 */
function countableAppData(docData) {
  if (!isSplit(docData)) return resolveAppData(docData || {});
  const out = { ...(docData.appData || {}) };
  for (const [key, m] of Object.entries(docData.storage.keys || {})) {
    if (m && Number.isFinite(m.count)) out[key] = { length: m.count };
  }
  return out;
}

module.exports = {
  FORMAT,
  INLINE_KEY_BYTES,
  INLINE_TOTAL_BYTES,
  CHUNK_BYTES,
  BooksTooLargeError,
  booksRef,
  mergeLikeFirestore,
  splitAppData,
  joinAppData,
  readBooksTx,
  writeBooksTx,
  readBooks,
  deleteBooks,
  countableAppData,
};

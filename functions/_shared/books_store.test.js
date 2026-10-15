const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const zlib = require('zlib');
const store = require('./books_store');
const { resolveAppData } = require('./app_data');
const { mergePhoneSync } = require('./phone_sync');
const teamAccess = require('./team');
const { usageFromAppDataDoc } = require('./admin-stats');

const MiB = 1024 * 1024;

// ------------------------------------------------ a small in-memory Firestore

/** Stored size of a document by Firestore's published rules. */
function docSize(path, data) {
  const name = path.split('/').reduce((t, seg) => t + Buffer.byteLength(seg) + 1, 0) + 16;
  const value = (v) => {
    if (v === null || v === undefined || typeof v === 'boolean') return 1;
    if (typeof v === 'number') return 8;
    if (typeof v === 'string') return Buffer.byteLength(v) + 1;
    if (v instanceof Uint8Array) return v.length;
    if (Array.isArray(v)) return v.reduce((t, x) => t + value(x), 0);
    return Object.entries(v).reduce((t, [k, x]) => t + Buffer.byteLength(k) + 1 + value(x), 0);
  };
  return name + value(data) + 32;
}

function fakeDb() {
  const docs = new Map();
  const stats = { sets: [], deletes: [] };
  const snap = (path) => ({
    exists: docs.has(path),
    data: () => (docs.has(path) ? structuredClone(docs.get(path)) : undefined),
  });
  const docRef = (path) => ({
    path,
    collection: (name) => ({ doc: (id) => docRef(`${path}/${name}/${id}`) }),
    get: async () => snap(path),
  });
  const db = {
    docs,
    stats,
    collection: (name) => ({ doc: (id) => docRef(`${name}/${id}`) }),
    async runTransaction(fn) {
      const writes = [];
      const tx = {
        get: async (ref) => {
          if (writes.length) throw new Error('Firestore transactions require all reads before writes');
          return snap(ref.path);
        },
        getAll: async (...refs) => {
          if (writes.length) throw new Error('Firestore transactions require all reads before writes');
          return refs.map((r) => snap(r.path));
        },
        set: (ref, data) => writes.push(['set', ref.path, structuredClone(data)]),
        delete: (ref) => writes.push(['delete', ref.path]),
      };
      const out = await fn(tx);
      for (const [op, path, data] of writes) {
        if (op === 'set') {
          const size = docSize(path, data);
          if (size > MiB) throw new Error(`Document ${path} is ${size} bytes, over 1 MiB`);
          docs.set(path, data);
          stats.sets.push(path);
        } else {
          docs.delete(path);
          stats.deletes.push(path);
        }
      }
      return out;
    },
    async recursiveDelete(ref) {
      for (const p of [...docs.keys()]) if (p === ref.path || p.startsWith(`${ref.path}/`)) docs.delete(p);
    },
  };
  return db;
}

const UID = 'u1';
const MAIN = `users/${UID}/app_data/main`;

async function save(db, appData, meta = {}, opts) {
  const ref = store.booksRef(db, UID);
  return db.runTransaction(async (tx) => {
    const prev = await store.readBooksTx(tx, ref);
    store.writeBooksTx(tx, ref, prev, appData, meta, opts);
  });
}
const load = (db) => store.readBooks(db, UID, { migrate: false });

// ------------------------------------------------------------- test books

const rand = (n) => crypto.randomBytes(n).toString('hex');

/** A shop with a few thousand bills, a sale movement per line and an edit-log line per change. */
function bigShop(bills = 4000) {
  const invoices = [];
  const stockMoves = [];
  const auditLog = [];
  for (let i = 0; i < bills; i++) {
    const id = `inv-${i}`;
    const items = [0, 1, 2].map((j) => ({
      id: `${id}-l${j}`, stockId: `it-${(i + j) % 300}`, name: `Item number ${(i + j) % 300}`, hsn: '3004',
      qty: 1 + j, rate: 31.5, gstRate: 5, taxable: 94.5, cgst: 2.36, sgst: 2.36, total: 99.22,
    }));
    invoices.push({
      id, invoiceNumber: `INV/26-27/${String(i).padStart(5, '0')}`, businessId: 'b1', partyId: `c-${i % 500}`,
      partyName: `Customer ${i % 500}`, date: '2026-10-10', items, grandTotal: 297.66, totalTax: 14.16,
      status: 'paid', placeOfSupply: '27', createdAt: '2026-10-10T10:00:00.000Z',
    });
    for (const it of items) {
      stockMoves.push({ id: `mv-${it.id}`, itemId: it.stockId, date: '2026-10-10', kind: 'sale', qty: -it.qty, godown: 'Main', ref: invoices[i].invoiceNumber, refId: id, createdAt: '2026-10-10T10:00:00Z' });
    }
    auditLog.push({ id: `a-${i}`, at: `2026-10-10T10:${String(i % 60).padStart(2, '0')}:00Z`, byUid: UID, byName: 'Ravi Mehta', device: 'web', action: 'created', entity: 'bill', entityId: id, ref: invoices[i].invoiceNumber, detail: 'Bill ₹297.66' });
  }
  return {
    businesses: [{ id: 'b1', name: 'Mehta Medical Stores', gstin: '27AAAPM1234C1Z5', state: 'Maharashtra' }],
    activeBusinessId: 'b1',
    settings: { invoicePrefix: 'INV', theme: 'light' },
    parties: Array.from({ length: 500 }, (_, i) => ({ id: `c-${i}`, name: `Customer ${i}`, type: 'customer', phone: '9800000000' })),
    stock: Array.from({ length: 300 }, (_, i) => ({ id: `it-${i}`, name: `Item number ${i}`, hsn: '3004', gstRate: 5, rate: 30, currentStock: 50 })),
    invoices,
    stockMoves,
    auditLog,
    khataEntries: Array.from({ length: 2000 }, (_, i) => ({ id: `k-${i}`, partyId: `c-${i % 500}`, amount: 100 + i, type: i % 2 ? 'got' : 'gave', date: '2026-10-01' })),
    gstr2b: { '2026-09': { itc: { igst: 0, cgst: 1200, sgst: 1200, cess: 0 }, uploadedAt: '2026-10-12T00:00:00Z' } },
    expenses: [],
    deleted: { invoices: { 'inv-old': '2026-10-01T00:00:00Z' } },
    invoiceCounter: bills,
  };
}

// ------------------------------------------------------------------ tests

test('a shop with thousands of bills does not fit in one document but saves split', async () => {
  const books = bigShop();
  assert.ok(docSize(MAIN, { appData: books }) > MiB, 'the old single document would be over 1 MiB');

  const db = fakeDb();
  await save(db, books, { updated_at: 't1', version: 1, device: 'web' });
  for (const [path, data] of db.docs) assert.ok(docSize(path, data) < MiB, `${path} under 1 MiB`);

  const main = db.docs.get(MAIN);
  assert.equal(main.storage.format, store.FORMAT);
  for (const k of ['invoices', 'stockMoves', 'auditLog', 'khataEntries', 'parties', 'stock']) {
    assert.ok(main.storage.keys[k], `${k} moved to chunks`);
    assert.equal(main.appData[k], undefined, `${k} not left in the main document`);
  }
  assert.deepEqual(main.appData.settings, books.settings, 'small parts stay in the main document');
  assert.equal(main.updated_at, 't1');

  const { doc } = await load(db);
  assert.deepEqual(doc.appData, books);
  assert.equal(doc.updated_at, 't1');
  assert.deepEqual(resolveAppData(doc).invoices.length, 4000);
});

test('data that does not compress is cut into several chunk documents', async () => {
  const db = fakeDb();
  const books = { settings: {}, auditLog: Array.from({ length: 3000 }, (_, i) => ({ id: `a${i}`, detail: rand(300) })) };
  await save(db, books, { updated_at: 't1' });
  const m = db.docs.get(MAIN).storage.keys.auditLog;
  assert.ok(m.parts >= 2, `parts ${m.parts}`);
  assert.equal(m.count, 3000);
  assert.deepEqual((await load(db)).doc.appData, books);

  // Shrinks to one piece: the extra pieces are deleted.
  const smaller = { settings: {}, auditLog: books.auditLog.slice(0, 200) };
  await save(db, smaller, {}, { merge: false });
  assert.equal(db.docs.get(MAIN).storage.keys.auditLog.parts, 1);
  assert.ok(!db.docs.has(`${MAIN}/chunks/auditLog~1`));
  assert.deepEqual((await load(db)).doc.appData, smaller);

  // Small enough to live in the main document again: no chunks left.
  const tiny = { settings: {}, auditLog: books.auditLog.slice(0, 2) };
  await save(db, tiny, {}, { merge: false });
  assert.equal(db.docs.get(MAIN).storage.keys.auditLog, undefined);
  assert.deepEqual(db.docs.get(MAIN).appData.auditLog, tiny.auditLog);
  assert.ok(![...db.docs.keys()].some((p) => p.includes('/chunks/')));
});

test('unchanged parts are not rewritten', async () => {
  const db = fakeDb();
  const books = bigShop(1000);
  await save(db, books, { updated_at: 't1' });
  db.stats.sets.length = 0;
  await save(db, { ...books, settings: { ...books.settings, theme: 'dark' } }, { updated_at: 't2' });
  assert.deepEqual(db.stats.sets, [MAIN], 'only the main document is written');

  db.stats.sets.length = 0;
  await save(db, { ...books, invoices: [...books.invoices, { id: 'new', invoiceNumber: 'INV/1' }] }, { updated_at: 't3' });
  assert.deepEqual(db.stats.sets.sort(), [MAIN, `${MAIN}/chunks/invoices~0`].sort());
});

test('saves merge into what is stored, as set(..., { merge: true }) did', async () => {
  const db = fakeDb();
  await save(db, { ...bigShop(500), settings: { invoicePrefix: 'INV', theme: 'light' } }, { updated_at: 't1', version: 3, device: 'web' });
  // An older browser that does not know about stockMoves or khata.
  await save(db, { invoices: [{ id: 'only' }], settings: { theme: 'dark' } }, { updated_at: 't2' });
  const { doc } = await load(db);
  assert.deepEqual(doc.appData.invoices, [{ id: 'only' }], 'arrays are replaced');
  assert.equal(doc.appData.stockMoves.length, 1500, 'parts not sent are kept');
  assert.equal(doc.appData.khataEntries.length, 2000);
  assert.deepEqual(doc.appData.settings, { invoicePrefix: 'INV', theme: 'dark' }, 'maps merge key by key');
  assert.equal(doc.version, 3, 'version kept when not given');
  assert.equal(doc.device, 'web');
  assert.equal(doc.updated_at, 't2');

  assert.deepEqual(store.mergeLikeFirestore({ a: { x: 1, y: 2 }, b: [1] }, { a: { y: 3 }, b: [2], c: undefined }), { a: { x: 1, y: 3 }, b: [2] });
});

test('old single-document books move to the new format on first read, keeping updated_at', async () => {
  const db = fakeDb();
  const books = bigShop(300);
  db.docs.set(MAIN, { appData: structuredClone(books), updated_at: 'old-time', version: 1, device: 'flutter-android', data_compressed: 'stale' });

  const first = await store.readBooks(db, UID);
  assert.equal(first.legacy, true);
  assert.deepEqual(resolveAppData(first.doc), resolveAppData({ appData: books }));

  const main = db.docs.get(MAIN);
  assert.equal(main.storage.format, store.FORMAT);
  assert.equal(main.updated_at, 'old-time', 'open browsers keep their base_updated_at');
  assert.equal(main.device, 'flutter-android');
  assert.equal(main.data_compressed, undefined, 'old-format fields removed');
  const again = await store.readBooks(db, UID);
  assert.equal(again.legacy, false);
  assert.deepEqual(again.doc.appData, books);
});

test('old gzip-only books are converted on first read', async () => {
  const db = fakeDb();
  const phoneBooks = { invoices: [{ id: 'p1', invoice_number: 'A-1', total_amount: 50, created_at: '2026-10-01T00:00:00' }], customers: [{ id: 'c1', name: 'Asha' }] };
  db.docs.set(MAIN, { data_compressed: zlib.gzipSync(JSON.stringify(phoneBooks)).toString('base64'), updated_at: 'gz-time' });
  const { doc } = await store.readBooks(db, UID);
  assert.equal(resolveAppData(doc).invoices[0].invoiceNumber, 'A-1');
  const main = db.docs.get(MAIN);
  assert.equal(main.data_compressed, undefined);
  assert.equal(main.appData.invoices[0].invoiceNumber, 'A-1');
  assert.equal(main.updated_at, 'gz-time');
});

test('reading with migrate: false leaves old documents alone; missing books read as empty', async () => {
  const db = fakeDb();
  assert.deepEqual(await store.readBooks(db, UID), { exists: false, legacy: false, doc: null, manifest: null });
  db.docs.set(MAIN, { appData: { invoices: [] }, updated_at: 'x' });
  await store.readBooks(db, UID, { migrate: false });
  assert.equal(db.docs.get(MAIN).storage, undefined);
});

test('a missing or stale chunk is an error, never silently empty books', async () => {
  const db = fakeDb();
  await save(db, bigShop(500), { updated_at: 't1' });
  const chunk = `${MAIN}/chunks/invoices~0`;
  const kept = db.docs.get(chunk);
  db.docs.delete(chunk);
  await assert.rejects(load(db), /missing or out of date/);
  db.docs.set(chunk, { ...kept, hash: 'other' });
  await assert.rejects(load(db), /missing or out of date/);
});

test('phone sync round trip on split books (the endpoint\'s transaction)', async () => {
  const db = fakeDb();
  await save(db, bigShop(2000), { updated_at: 't1' });
  const ref = store.booksRef(db, UID);
  const phone = {
    invoices: [{ id: 'ph-1', invoice_number: 'INV/26-27/B0001', customer_name: 'Walk-in', created_at: '2026-10-11T11:00:00.000', total_amount: 63, total_gst_amount: 3, items: [] }],
    customers: [], inventory: [], auditLog: [{ id: 'a-ph', at: '2026-10-11T11:00:00Z', entity: 'bill', action: 'created' }], auditSince: '', deleted: {},
  };
  const toPhone = await db.runTransaction(async (tx) => {
    const prev = await store.readBooksTx(tx, ref);
    const { appData, toPhone: out } = mergePhoneSync(resolveAppData(prev.doc), phone, 't2');
    store.writeBooksTx(tx, ref, prev, appData, { updated_at: 't2', version: 1, device: 'flutter-android' });
    return out;
  });
  assert.ok(toPhone.invoices.length >= 2000, 'phone gets the web bills');
  const { doc } = await load(db);
  assert.ok(doc.appData.invoices.some((i) => i.id === 'ph-1'));
  assert.ok(doc.appData.auditLog.some((e) => e.id === 'a-ph'));
  assert.equal(doc.updated_at, 't2');
  assert.equal(doc.device, 'flutter-android');
});

test('billing-only member view and save work on joined books', async () => {
  const db = fakeDb();
  const books = { ...bigShop(800), purchases: Array.from({ length: 400 }, (_, i) => ({ id: `pu-${i}`, supplier: rand(20) })) };
  await save(db, books, { updated_at: 't1' });
  const { doc } = await load(db);
  const view = teamAccess.viewFor(resolveAppData(doc), 'billing');
  assert.deepEqual(view.purchases, []);
  const merged = teamAccess.mergeMemberSave(doc.appData, { ...view, purchases: [] }, 'billing');
  await save(db, merged, { updated_at: 't2' });
  assert.equal((await load(db)).doc.appData.purchases.length, 400, 'member could not wipe purchases');
});

test('admin usage counts come from the manifest without reading chunks', async () => {
  const db = fakeDb();
  await save(db, bigShop(1200), { updated_at: 't1', device: 'web' });
  const usage = usageFromAppDataDoc(db.docs.get(MAIN));
  assert.equal(usage.invoices, 1200);
  assert.equal(usage.parties, 500);
  assert.equal(usage.stock_items, 300);
  assert.equal(usage.khata_entries, 2000);
  assert.equal(usage.businesses, 1);
  assert.equal(usage.has_cloud_data, true);
  assert.equal(usage.last_sync_at, 't1');
});

test('deleting books removes the chunks too', async () => {
  const db = fakeDb();
  await save(db, bigShop(500), { updated_at: 't1' });
  assert.ok(db.docs.size > 1);
  await store.deleteBooks(db, UID);
  assert.equal(db.docs.size, 0);
});

test('keys that cannot be document ids stay in the main document', () => {
  const big = Array.from({ length: 2000 }, (_, i) => ({ id: i, s: 'x'.repeat(20) }));
  const { inline, manifest } = store.splitAppData({ 'odd/key': big, invoices: big });
  assert.ok(inline['odd/key']);
  assert.ok(manifest.keys.invoices);
});

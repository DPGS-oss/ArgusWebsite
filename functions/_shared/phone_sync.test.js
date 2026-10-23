const test = require('node:test');
const assert = require('node:assert/strict');
const { mergePhoneSync, phoneToWebInvoice, webToPhoneInvoice } = require('./phone_sync');

// A phone bill: 2 almirah at ₹9,000 incl. 18% GST + ₹500 delivery, intra-state.
const phoneBill = () => ({
  id: 'inv-phone-1',
  invoice_number: 'INV-0007',
  customer_name: 'Sharma Traders',
  customer_id: 'c1',
  created_at: '2026-09-29T10:00:00.000',
  invoice_date: '2026-09-29T10:00:00.000',
  notes: '',
  place_of_supply: '07',
  shipping_charges: 500,
  shipping_is_reimbursement: false,
  round_off: 0,
  status: 'pending',
  total_amount: 18500,
  total_gst_amount: 2822.04,
  total_cgst: 1411.02,
  total_sgst: 1411.02,
  total_igst: 0,
  items: [{ name: 'Steel Almirah', hsn_code: '9403', quantity: 2, unit_price: 9000, gst_rate: 18, taxable_value: 15254.24, cgst: 1372.88, sgst: 1372.88, igst: 0, total: 18000 }],
});
const customer = { id: 'c1', name: 'Sharma Traders', gstin: '', phone: '98', email: '', billing_address: 'Delhi', city: '', state: '', pincode: '' };

test('phone bill becomes a web invoice with a taxed delivery line', () => {
  const w = phoneToWebInvoice(phoneBill(), {}, '2026-09-29T10:00:01.000Z');
  assert.equal(w.partyName, 'Sharma Traders');
  assert.equal(w.grandTotal, 18500);
  assert.equal(w.status, 'unpaid');
  assert.equal(w.date, '2026-09-29');
  const [goods, delivery] = w.items;
  assert.equal(goods.rate, 7627.12);
  assert.equal(goods.total, 18000);
  assert.equal(delivery.isDelivery, true);
  assert.equal(delivery.total, 500);
  assert.equal(delivery.taxableAmount, 423.73);
  assert.equal(Math.round((delivery.cgst + delivery.sgst) * 100) / 100, 76.27);
});

test('web invoice back to phone keeps prices incl. GST and delivery as shipping', () => {
  const p = webToPhoneInvoice(phoneToWebInvoice(phoneBill()));
  assert.equal(p.items.length, 1);
  assert.equal(p.items[0].unit_price, 9000);
  assert.equal(p.shipping_charges, 500);
  assert.equal(p.shipping_is_reimbursement, false);
  assert.equal(p.total_amount, 18500);
});

test('first sync: phone data lands on the web and web-only bills go to the phone', () => {
  const web = { businesses: [{ id: 'b1', name: 'QA Traders' }], activeBusinessId: 'b1', invoices: [
    { id: 'w1', invoiceNumber: 'INV-0001', partyName: 'Walk-in', status: 'paid', date: '2026-09-28', grandTotal: 118, totalTax: 18, items: [{ description: 'Pen', quantity: 1, total: 118, gstRate: 18, taxableAmount: 100, cgst: 9, sgst: 9, igst: 0 }] },
  ], parties: [{ id: 's1', name: 'Supplier', type: 'supplier' }], expenses: [{ id: 'e1' }] };
  const { appData, toPhone } = mergePhoneSync(web, { invoices: [phoneBill()], customers: [customer], inventory: [] });

  assert.deepEqual(appData.invoices.map((i) => i.id), ['w1', 'inv-phone-1']);
  assert.equal(appData.invoices[1].businessId, 'b1');
  // Expenses now sync with the phone too: the web's stays, with its sync stamp.
  assert.deepEqual(appData.expenses.map(({ _sync, ...e }) => e), [{ id: 'e1' }], 'web-only data is kept');
  assert.deepEqual(toPhone.invoices.map((i) => i.id), ['w1']);
  assert.equal(toPhone.invoices[0].items[0].unit_price, 118);
  assert.deepEqual(toPhone.customers, [], 'suppliers stay on the web');
  assert.equal(appData.parties.find((p) => p.id === 'c1').type, 'customer');
});

test('steady state: nothing moves when neither side changed', () => {
  const first = mergePhoneSync({}, { invoices: [phoneBill()], customers: [customer] });
  const again = mergePhoneSync(first.appData, { invoices: [phoneBill()], customers: [customer] });
  assert.deepEqual(again.toPhone.invoices, []);
  assert.deepEqual(again.toPhone.customers, []);
});

test('phone marks a bill paid: web follows', () => {
  const first = mergePhoneSync({}, { invoices: [phoneBill()] });
  const paid = { ...phoneBill(), status: 'paid' };
  const next = mergePhoneSync(first.appData, { invoices: [paid] });
  assert.equal(next.appData.invoices[0].status, 'paid');
  assert.equal(next.appData.invoices[0].balanceDue, 0);
  assert.deepEqual(next.toPhone.invoices, []);
});

test('web edits a bill: the phone gets the web version, then things settle', () => {
  const first = mergePhoneSync({}, { invoices: [phoneBill()] });
  const edited = JSON.parse(JSON.stringify(first.appData));
  edited.invoices[0].notes = 'Deliver after 5pm';
  delete edited.invoices[0]._sync; // the web form rebuilds the object
  const next = mergePhoneSync(edited, { invoices: [phoneBill()] });
  assert.equal(next.toPhone.invoices.length, 1);
  assert.equal(next.toPhone.invoices[0].notes, 'Deliver after 5pm');
  assert.equal(next.appData.invoices[0].notes, 'Deliver after 5pm');

  // The phone saves what it received; the following sync is quiet.
  const settled = mergePhoneSync(next.appData, { invoices: [next.toPhone.invoices[0]] });
  assert.deepEqual(settled.toPhone.invoices, []);
  assert.equal(settled.appData.invoices[0].notes, 'Deliver after 5pm');
});

test('output has no undefined values (Firestore rejects them)', () => {
  const { appData } = mergePhoneSync({}, { invoices: [phoneBill()], customers: [customer], inventory: [{ id: 's', name: 'Rice', gst_rate: 5, sell_price: 105, stock_on_hand: 3 }] });
  const walk = (v) => {
    if (v === undefined) assert.fail('undefined found');
    if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(appData);
  assert.equal(appData.stock[0].rate, 100);
});

test('a draft deleted on the phone disappears from the web and stays gone', () => {
  const draft = { ...phoneBill(), status: 'draft' };
  const first = mergePhoneSync({}, { invoices: [draft], customers: [customer] });
  const next = mergePhoneSync(first.appData, { invoices: [], customers: [customer], deleted: { invoices: ['inv-phone-1'] } });
  assert.deepEqual(next.appData.invoices, []);
  assert.ok(next.appData.deleted.invoices['inv-phone-1']);
  // A second phone that still has it is told to drop it, and it is not re-added.
  const other = mergePhoneSync(next.appData, { invoices: [draft] });
  assert.deepEqual(other.appData.invoices, []);
  assert.deepEqual(other.toPhone.deleted.invoices, ['inv-phone-1']);
});

test('a customer deleted on the web is removed from the phone', () => {
  const first = mergePhoneSync({}, { customers: [customer] });
  const web = JSON.parse(JSON.stringify(first.appData));
  web.parties = [];
  web.deleted = { ...(web.deleted || {}), parties: { c1: '2026-09-30T00:00:00Z' } };
  const next = mergePhoneSync(web, { customers: [customer] });
  assert.deepEqual(next.toPhone.deleted.customers, ['c1']);
  assert.deepEqual(next.appData.parties, []);
});

test('a bill of supply stays a bill of supply across phone and web', () => {
  const p = { ...phoneBill(), document_type: 'BOS', total_gst_amount: 0, total_cgst: 0, total_sgst: 0 };
  const w = phoneToWebInvoice(p);
  assert.equal(w.type, 'bill_of_supply');
  assert.equal(webToPhoneInvoice(w).document_type, 'BOS');
});

test('credit and debit notes sync both ways and keep their GST split', () => {
  const { mergePhoneSync } = require('./phone_sync');
  const phoneNote = {
    id: 'cn1', credit_note_number: 'CN/26-27/0001', invoice_id: 'inv1', customer_name: 'Mehta', status: 'active',
    subtotal: 100, total_gst_amount: 18, total_amount: 118, created_at: '2026-10-12T10:00:00',
    items: [{ name: 'Almirah', hsn_code: '9403', quantity: 1, unit_price: 118, gst_rate: 18, taxable_value: 100, gst_amount: 18, cgst: 9, sgst: 9, igst: 0, total: 118 }],
  };
  const first = mergePhoneSync(null, { creditNotes: [phoneNote], debitNotes: [] });
  const web = first.appData.creditNotes[0];
  assert.equal(web.creditNoteNumber, 'CN/26-27/0001');
  assert.equal(web.invoiceId, 'inv1');
  assert.equal(web.date, '2026-10-12');
  assert.deepEqual([web.items[0].taxableAmount, web.items[0].cgst, web.items[0].sgst, web.items[0].gstRate], [100, 9, 9, 18]);
  // Unchanged on the next sync: nothing to send back.
  const second = mergePhoneSync(first.appData, { creditNotes: [phoneNote], debitNotes: [] });
  assert.deepEqual(second.toPhone.creditNotes, []);
  // A note made on the web reaches the phone.
  const appData = { ...second.appData, debitNotes: [{ id: 'dn1', debitNoteNumber: 'DN/26-27/W0001', invoiceId: 'inv1', customerName: 'Mehta', status: 'active', subtotal: 50, totalGstAmount: 9, totalAmount: 59, date: '2026-10-12', items: [] }] };
  const third = mergePhoneSync(appData, { creditNotes: [phoneNote], debitNotes: [] });
  assert.equal(third.toPhone.debitNotes[0].debit_note_number, 'DN/26-27/W0001');
  assert.equal(third.toPhone.debitNotes[0].total_amount, 59);
  // Older apps that send no notes lose nothing.
  const old = mergePhoneSync(third.appData, { invoices: [] });
  assert.equal(old.appData.creditNotes.length, 1);
  assert.equal(old.appData.debitNotes.length, 1);
});

test('purchases sync both ways with supplier, bill number and tax heads', () => {
  const { mergePhoneSync } = require('./phone_sync');
  const phone = {
    id: 'pu1', purchase_number: 'PUR-1', supplier_name: 'Mumbai Steel', supplier_gstin: '27aapfu0939f1zv',
    supplier_invoice_number: 'MS/0042', supplier_invoice_date: '2026-10-05', total_amount: 11800, total_gst_amount: 1800,
    total_igst: 1800, total_cgst: 0, total_sgst: 0, reverse_charge: false, itc_eligible: true, created_at: '2026-10-05T10:00:00',
    items: [{ name: 'Steel', hsn_code: '7308', quantity: 1, unit_price: 11800, gst_rate: 18, taxable_value: 10000, gst_amount: 1800, cgst: 0, sgst: 0, igst: 1800, total: 11800 }],
  };
  const first = mergePhoneSync(null, { purchases: [phone] });
  const w = first.appData.purchases[0];
  assert.equal(w.supplierGstin, '27AAPFU0939F1ZV');
  assert.equal(w.supplierInvoiceNumber, 'MS/0042');
  assert.equal(w.totalIgst, 1800);
  assert.equal(w.items[0].igst, 1800);
  assert.deepEqual(mergePhoneSync(first.appData, { purchases: [phone] }).toPhone.purchases, []);
  const old = mergePhoneSync(first.appData, { invoices: [] });
  assert.equal(old.appData.purchases.length, 1);
});

test('edit log: append-only, merged both ways, each entry sent once', () => {
  const { mergePhoneSync } = require('./phone_sync');
  const phoneEntry = { id: 'a1', at: '2026-10-15T10:00:00Z', byUid: 'u1', byName: 'Owner', device: 'android', action: 'created', entity: 'bill', entityId: 'i1', ref: 'INV/26-27/0001', detail: 'Bill for Mehta' };
  const webEntry = { id: 'w1', at: '2026-10-15T09:00:00Z', byUid: 'u1', byName: 'Owner', device: 'web', action: 'edited', entity: 'customer', entityId: 'c1', ref: 'Mehta', detail: 'Phone: — → 98' };
  const first = mergePhoneSync({ auditLog: [webEntry] }, { auditLog: [phoneEntry], auditSince: '' }, '2026-10-15T11:00:00Z');
  assert.deepEqual(first.appData.auditLog.map((e) => e.id), ['w1', 'a1']);
  assert.deepEqual(first.toPhone.auditLog.map((e) => e.id), ['w1']);
  assert.equal(first.toPhone.auditSince, '2026-10-15T11:00:00Z');
  // Next sync: nothing new either way; the phone re-sending does not duplicate.
  const second = mergePhoneSync(first.appData, { auditLog: [phoneEntry], auditSince: first.toPhone.auditSince }, '2026-10-15T12:00:00Z');
  assert.equal(second.appData.auditLog.length, 2);
  assert.deepEqual(second.toPhone.auditLog, []);
  // An entry cannot be rewritten by sending it again with other text.
  const third = mergePhoneSync(second.appData, { auditLog: [{ ...phoneEntry, detail: 'changed' }], auditSince: '' }, '2026-10-15T13:00:00Z');
  assert.equal(third.appData.auditLog.find((e) => e.id === 'a1').detail, 'Bill for Mehta');
});

test('stock movements: union both ways, opening never doubled, gaps matched', () => {
  const { mergePhoneSync } = require('./phone_sync');
  const item = { id: 'it1', name: 'Paracetamol', hsn: '3004', gstRate: 5, rate: 20, currentStock: 7, minStock: 0, costPrice: 12 };
  const webMoves = [
    { id: 'open_it1', itemId: 'it1', date: '2026-10-01', kind: 'opening', qty: 10, godown: 'Main', unitCost: 12, createdAt: '2026-10-01T00:00:00Z' },
    { id: 'w-sale', itemId: 'it1', date: '2026-10-02', kind: 'sale', qty: -3, godown: 'Main', createdAt: '2026-10-02T00:00:00Z' },
  ];
  const phoneItem = { id: 'it1', name: 'Paracetamol', hsn_code: '3004', gst_rate: 5, sell_price: 21, stock_on_hand: 7, reorder_level: 0, cost_price: 12 };
  const phoneMoves = [
    // The phone made its own opening for the same item: same fixed id, so it is not added twice.
    { id: 'open_it1', itemId: 'it1', date: '2026-10-03', kind: 'opening', qty: 7, godown: 'Main', createdAt: '2026-10-03T00:00:00Z' },
    { id: 'p-in', itemId: 'it1', date: '2026-10-04', kind: 'purchase', qty: 5, godown: 'Shop 2', batch: 'B1', expiry: '2027-01-31', unitCost: 11, createdAt: '2026-10-04T00:00:00Z' },
  ];
  const r = mergePhoneSync({ stock: [item], stockMoves: webMoves, godowns: [] },
    { inventory: [{ ...phoneItem, stock_on_hand: 12 }], stockMoves: phoneMoves, godowns: ['Shop 2'] }, '2026-10-05T00:00:00Z');
  const moves = r.appData.stockMoves;
  assert.equal(moves.filter((m) => m.kind === 'opening').length, 1);
  assert.equal(moves.find((m) => m.id === 'open_it1').qty, 10);
  // Movements add up to the synced quantity on hand.
  const stock = r.appData.stock[0].currentStock;
  assert.equal(Math.round(moves.reduce((t, m) => t + m.qty, 0) * 1000) / 1000, stock);
  // Movements are the truth: 10 opening − 3 sold on the website + 5 bought on the phone.
  assert.equal(stock, 12);
  assert.ok(!moves.some((m) => m.id.startsWith('mv_sync_')), 'no correction entries for apps that record movements');
  // The phone gets the website's sale and the cloud's opening stock (its own differed), not its own purchase back.
  const back = r.toPhone.stockMoves.map((m) => m.id);
  assert.ok(back.includes('w-sale'));
  assert.ok(back.includes('open_it1'));
  assert.ok(!back.includes('p-in'));
  assert.equal(r.toPhone.stockMoves.find((m) => m.id === 'open_it1').qty, 10);
  assert.deepEqual(r.toPhone.godowns, ['Shop 2']);
  assert.equal(r.appData.stock[0].costPrice, 12);
  // Both sides sell at the same time: both sales count.
  const both = mergePhoneSync({ stock: [{ ...item, currentStock: 6 }], stockMoves: [...webMoves, { id: 'w-sale2', itemId: 'it1', date: '2026-10-05', kind: 'sale', qty: -1, godown: 'Main', createdAt: '2026-10-05T01:00:00Z' }] },
    { inventory: [{ ...phoneItem, stock_on_hand: 6 }], stockMoves: [webMoves[0], webMoves[1], { id: 'p-sale', itemId: 'it1', date: '2026-10-05', kind: 'sale', qty: -1, godown: 'Main', createdAt: '2026-10-05T02:00:00Z' }] }, '2026-10-05T03:00:00Z');
  assert.equal(both.appData.stock[0].currentStock, 5);
  assert.equal(both.toPhone.inventory.find((i) => i.id === 'it1')?.stock_on_hand ?? 5, 5);
  // Older app versions: nothing sent back, but the website's movements still match its stock.
  const legacy = mergePhoneSync({ stock: [{ ...item, currentStock: 4 }], stockMoves: webMoves }, { inventory: [] }, '2026-10-06T00:00:00Z');
  assert.equal(legacy.toPhone.stockMoves, undefined);
  assert.equal(legacy.appData.stockMoves.reduce((t, m) => t + m.qty, 0), 4);
});

test('item recipe, valuation and batches survive the round trip; old items keep their hashes', () => {
  const { mergePhoneSync } = require('./phone_sync');
  const plain = { id: 'a', name: 'Bag', hsn_code: '4202', gst_rate: 18, sell_price: 118, stock_on_hand: 2, reorder_level: 0 };
  const first = mergePhoneSync(null, { inventory: [plain] });
  assert.deepEqual(mergePhoneSync(first.appData, { inventory: [plain] }).toPhone.inventory, []);
  const kit = { ...plain, id: 'k', name: 'Kit', valuation: 'fifo', track_batches: true, cost_price: 50, bom: [{ itemId: 'a', qty: 2 }] };
  const second = mergePhoneSync(first.appData, { inventory: [plain, kit] });
  const w = second.appData.stock.find((s) => s.id === 'k');
  assert.equal(w.valuation, 'fifo');
  assert.equal(w.trackBatches, true);
  assert.deepEqual(w.bom, [{ itemId: 'a', qty: 2 }]);
  assert.deepEqual(mergePhoneSync(second.appData, { inventory: [plain, kit] }).toPhone.inventory, []);
});

test('a phone cannot delete an issued bill; a draft can be deleted', () => {
  const { mergePhoneSync } = require('./phone_sync');
  const data = { invoices: [{ id: 'i1', invoiceNumber: 'INV/26-27/0001', status: 'paid', items: [] }, { id: 'd1', invoiceNumber: 'D', status: 'draft', items: [] }] };
  const r = mergePhoneSync(data, { deleted: { invoices: ['i1', 'd1'] } }, '2026-10-15T00:00:00Z');
  assert.deepEqual(r.appData.invoices.map((i) => i.id), ['i1']);
  assert.ok(!r.appData.deleted.invoices.i1);
  assert.ok(r.appData.deleted.invoices.d1);
});

test('business details: the phone fills an empty website; the website business goes to the phone', () => {
  const { mergePhoneSync } = require('./phone_sync');
  const fromPhone = mergePhoneSync({}, { business: { name: 'Mehta Medical', gstin: '27AAPFU0939F1ZV', state: 'Maharashtra' }, invoices: [] });
  assert.equal(fromPhone.appData.businesses[0].name, 'Mehta Medical');
  assert.equal(fromPhone.appData.businesses[0].stateCode, '27');
  assert.equal(fromPhone.appData.activeBusinessId, 'biz-phone');
  assert.equal(fromPhone.toPhone.business.gstin, '27AAPFU0939F1ZV');
  // A website that already has a business keeps it.
  const web = { businesses: [{ id: 'b1', name: 'Web Name', gstin: '07AAKFS1234M1ZZ' }], activeBusinessId: 'b1' };
  const r = mergePhoneSync(web, { business: { name: 'Other' } });
  assert.equal(r.appData.businesses.length, 1);
  assert.equal(r.toPhone.business.name, 'Web Name');
});

test('a 0% phone bill to another state is inter-state (place of supply vs seller state)', () => {
  const { phoneToWebInvoice } = require('./phone_sync');
  const base = { id: 'z', invoice_number: 'INV/26-27/0009', customer_name: 'X', invoice_date: '2026-10-05', status: 'paid', seller_gstin: '27AAPFU0939F1ZV',
    total_amount: 340, total_gst_amount: 0, total_cgst: 0, total_sgst: 0, total_igst: 0,
    items: [{ name: 'Rice', hsn_code: '1006', quantity: 1, unit_price: 340, gst_rate: 0, taxable_value: 340, gst_amount: 0, cgst: 0, sgst: 0, igst: 0, total: 340 }] };
  assert.equal(phoneToWebInvoice({ ...base, place_of_supply: '07' }).isInterState, true);
  assert.equal(phoneToWebInvoice({ ...base, place_of_supply: '27' }).isInterState, false);
});

test('expenses and hand-typed khata go both ways; ledger lines made from bills stay on their side', () => {
  const web = {
    businesses: [{ id: 'b', name: 'Shop', gstin: '27AAPFU0939F1ZV' }], activeBusinessId: 'b',
    expenses: [{ id: 'e-web', category: 'Electricity', description: 'MSEB', amount: 2400, date: '2025-05-05', paymentMode: 'UPI', vendor: 'Board', gstAmount: 0, isGstClaimable: false, createdAt: '2025-05-05T10:00:00Z', updatedAt: '2025-05-05T10:00:00Z' }],
    khataEntries: [
      { id: 'k-web', customerId: 'c1', customerName: 'Ravi', amount: 500, description: 'Udhar', createdAt: '2025-05-06T10:00:00Z', isCredit: false, accountType: 'party' },
      { id: 'k-led', customerId: 'c1', customerName: 'Ravi', amount: 1180, description: 'INV-1', createdAt: '2025-05-06T10:00:00Z', isCredit: false, accountType: 'party', sourceType: 'invoice', sourceId: 'i1' },
    ],
  };
  const phone = {
    expenses: [{ id: 'e-ph', category: 'Rent', description: 'Shop rent', amount: 29500, date: '2025-05-01T00:00:00.000', payment_mode: 'bank', vendor: 'Landlord', gst_amount: 4500, is_gst_claimable: true, vendor_gstin: '27aapfu0939f1zv', created_at: '2025-05-01T09:00:00', updated_at: '2025-05-01T09:00:00' }],
    khataEntries: [
      { id: 'k-ph', customer_id: 'c2', customer_name: 'Sita', amount: 300, description: 'Udhar', created_at: '2025-05-07T10:00:00', is_credit: false },
      { id: 'k-ph-led', customer_id: 'c2', customer_name: 'Sita', amount: 300, description: 'ledger', created_at: '2025-05-07T10:00:00', is_credit: false, source_type: 'invoice', source_id: 'p1' },
    ],
  };
  const { appData, toPhone } = mergePhoneSync(web, phone, '2025-05-08T00:00:00Z');
  const rent = appData.expenses.find((e) => e.id === 'e-ph');
  assert.equal(rent.date, '2025-05-01');
  assert.equal(rent.vendorGstin, '27AAPFU0939F1ZV');
  assert.equal(rent.isGstClaimable, true);
  assert.deepEqual(toPhone.expenses.map((e) => e.id), ['e-web']);
  assert.ok(appData.khataEntries.some((k) => k.id === 'k-ph'));
  assert.ok(!appData.khataEntries.some((k) => k.id === 'k-ph-led'), 'phone ledger lines are not taken');
  assert.deepEqual(toPhone.khataEntries.map((k) => k.id), ['k-web'], 'web ledger lines are not sent');
  // second sync, nothing changed: nothing goes back
  const again = mergePhoneSync(appData, { ...phone, expenses: [...phone.expenses, toPhone.expenses[0]], khataEntries: [...phone.khataEntries, toPhone.khataEntries[0]] }, '2025-05-09T00:00:00Z');
  assert.equal(again.toPhone.expenses.length, 0);
  assert.equal(again.toPhone.khataEntries.length, 0);
});

test('a branch with its own GSTIN: each return takes only its bills and their notes', () => {
  const { booksForBusiness, expensesAsPurchases } = require('./ca-exports');
  const data = {
    businesses: [{ id: 'pune', gstin: '27AAPFU0939F1ZV' }, { id: 'blr', gstin: '29AAPFU0939F1ZR' }], activeBusinessId: 'pune',
    invoices: [{ id: 'a', businessId: 'pune' }, { id: 'b', businessId: 'blr' }, { id: 'c' }],
    creditNotes: [{ id: 'cn1', invoiceId: 'b' }, { id: 'cn2', invoiceId: 'a' }], debitNotes: [],
  };
  const blr = booksForBusiness(data, '29aapfu0939f1zr');
  assert.equal(blr.business.id, 'blr');
  assert.deepEqual(blr.data.invoices.map((i) => i.id), ['b']);
  assert.deepEqual(blr.data.creditNotes.map((n) => n.id), ['cn1']);
  assert.equal(blr.data.activeBusinessId, 'blr');
  assert.deepEqual(booksForBusiness(data, '').data.invoices.map((i) => i.id), ['a', 'c']);
  assert.equal(expensesAsPurchases([{ id: 'r', isGstClaimable: true, gstAmount: 4500, amount: 29500, vendorGstin: '27AAPFU0939F1ZV', date: '2025-05-01' }, { id: 'x', isGstClaimable: true, gstAmount: 10, amount: 100 }]).length, 1);
});

test('a phone that says when it last synced gets only what changed since; an old app still gets everything', () => {
  const { stampRecords } = require('./books_store');
  const web = {
    businesses: [{ id: 'b', name: 'Shop', gstin: '27AAPFU0939F1ZV' }], activeBusinessId: 'b',
    stock: [{ id: 's1', name: 'Soap', hsn: '3401', gstRate: 5, rate: 40, currentStock: 10, _s: 't1' }],
    stockMoves: [{ id: 'm1', itemId: 's1', date: '2025-05-01', kind: 'opening', qty: 10, godown: 'Main', _s: 't1' }],
    expenses: [
      { id: 'e-old', category: 'Rent', amount: 100, date: '2025-04-01', _s: 't1' },
      { id: 'e-new', category: 'Electricity', amount: 50, date: '2025-05-02', _s: 't3' },
    ],
  };
  // old app (no since): everything it does not have comes back
  const full = mergePhoneSync(web, { expenses: [], stockMoves: [] }, 't4');
  assert.deepEqual(full.toPhone.expenses.map((e) => e.id).sort(), ['e-new', 'e-old']);
  assert.deepEqual(full.toPhone.stockMoves.map((m) => m.id), ['m1']);
  // new app, last synced at t2: only what changed after t2
  const lean = mergePhoneSync(web, { since: 't2', expenses: [], stockMoves: [] }, 't4');
  assert.deepEqual(lean.toPhone.expenses.map((e) => e.id), ['e-new']);
  assert.deepEqual(lean.toPhone.stockMoves, []);
  assert.deepEqual(lean.toPhone.inventory, []);
  // what the phone sends now is stamped with this sync and not echoed next time
  const after = stampRecords(web, mergePhoneSync(web, { since: 't4', expenses: [{ id: 'e-ph', category: 'Rent', amount: 10, date: '2025-05-03' }] }, 't5').appData, 't5');
  assert.equal(after.expenses.find((e) => e.id === 'e-ph')._s, 't5');
  const next = mergePhoneSync(after, { since: 't5', expenses: [] }, 't6');
  assert.deepEqual(next.toPhone.expenses, []);
});

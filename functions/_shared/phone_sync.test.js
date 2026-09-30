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
  assert.deepEqual(appData.expenses, [{ id: 'e1' }], 'web-only data is untouched');
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
  const first = mergePhoneSync({}, { invoices: [phoneBill()], customers: [customer] });
  const next = mergePhoneSync(first.appData, { invoices: [], customers: [customer], deleted: { invoices: ['inv-phone-1'] } });
  assert.deepEqual(next.appData.invoices, []);
  assert.ok(next.appData.deleted.invoices['inv-phone-1']);
  // A second phone that still has it is told to drop it, and it is not re-added.
  const other = mergePhoneSync(next.appData, { invoices: [phoneBill()] });
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

/**
 * Two-way sync between the Android app and the website's AppData blob
 * (users/{uid}/app_data/main.appData).
 *
 * The phone keeps its own model (snake_case, GST-inclusive unit prices,
 * delivery as `shipping_charges`); the website keeps AppData (camelCase,
 * exclusive rates, delivery as `isDelivery` lines). The server is the only
 * place that translates, so neither client has to know the other's shape.
 *
 * Change detection without clocks: each synced web record carries
 * `_sync: { p, w }` — fingerprints of the phone view and the web view at the
 * last sync. A side has "edited" a record when its current fingerprint no
 * longer matches. Web edits win when both sides changed the same record.
 * Deletions travel as tombstones in `appData.deleted[webKey][id] = time`, so
 * a record deleted on either side is not brought back by the other.
 */
const crypto = require('crypto');

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const r2 = (v) => Math.round(num(v) * 100) / 100;
const str = (v) => (v == null ? '' : String(v)).trim();
const day = (v) => str(v).slice(0, 10);

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
const hash = (v) => crypto.createHash('sha1').update(stable(v)).digest('hex').slice(0, 16);

// ------------------------------------------------------------- fingerprints
// Only fields that survive a round trip through either client's model.

const phoneInvoiceFp = (p) => hash({
  n: str(p.invoice_number), c: str(p.customer_name), s: str(p.status), d: day(p.invoice_date || p.created_at),
  t: r2(p.total_amount), sh: r2(p.shipping_charges), notes: str(p.notes),
  i: (p.items || []).map((it) => [str(it.name), r2(it.quantity), r2(it.unit_price), r2(it.gst_rate)]),
});
const webInvoiceFp = (w) => hash({
  n: str(w.invoiceNumber), c: str(w.partyName), s: str(w.status), d: day(w.date),
  t: r2(w.grandTotal), notes: str(w.notes), paid: r2(w.paidAmount),
  i: (w.items || []).map((it) => [str(it.description), r2(it.quantity), r2(it.total), r2(it.gstRate)]),
});
const phoneCustomerFp = (c) => hash([c.name, c.gstin, c.phone, c.email, c.billing_address ?? c.address, c.city, c.state, c.pincode].map(str));
const webPartyFp = (p) => hash([p.name, p.gstin, p.phone, p.email, p.address, p.city, p.state, p.pincode].map(str));
const phoneStockFp = (s) => hash([str(s.name), str(s.hsn_code), r2(s.gst_rate), r2(s.sell_price), r2(s.stock_on_hand), r2(s.reorder_level), str(s.barcode)]);
const webStockFp = (s) => hash([str(s.name), str(s.hsn), r2(s.gstRate), r2(s.rate), r2(s.currentStock), r2(s.minStock), str(s.barcode)]);

// ------------------------------------------------------------- invoices

const PHONE_TO_WEB_STATUS = { paid: 'paid', cancelled: 'cancelled', draft: 'draft' };

function phoneToWebInvoice(p, prev = {}, now = new Date().toISOString()) {
  const inter = num(p.total_igst) > 0;
  const splitTax = (tax) => (inter
    ? { cgst: 0, sgst: 0, igst: r2(tax) }
    : { cgst: r2(tax / 2), sgst: r2(tax - r2(tax / 2)), igst: 0 });

  const items = (p.items || []).map((it, i) => {
    const qty = num(it.quantity) || 1;
    const rate = num(it.gst_rate);
    const gross = num(it.total) || qty * num(it.unit_price);
    const taxable = num(it.taxable_value) || gross / (1 + rate / 100);
    const tax = num(it.cgst) + num(it.sgst) + num(it.igst) || gross - taxable;
    return {
      id: `${p.id}-${i}`,
      description: str(it.name),
      hsn: str(it.hsn_code),
      quantity: qty,
      unit: str(it.uqc) || 'NOS',
      uqc: str(it.uqc) || 'NOS',
      rate: r2(taxable / qty),
      discount: 0,
      gstRate: rate,
      taxableAmount: r2(taxable),
      ...splitTax(tax),
      cess: r2(it.cess),
      total: r2(taxable + tax),
    };
  });

  const shipping = num(p.shipping_charges);
  const reimbursement = p.shipping_is_reimbursement ? shipping : 0;
  if (shipping > 0 && !p.shipping_is_reimbursement) {
    // Delivery is taxed at the rate of the main item (s.15(2)(c)); the amount is GST-inclusive.
    const main = items.reduce((a, b) => (b.taxableAmount > (a?.taxableAmount ?? -1) ? b : a), null);
    const rate = main ? main.gstRate : 0;
    const taxable = shipping / (1 + rate / 100);
    items.push({
      id: `${p.id}-delivery`, description: 'Delivery charges', hsn: main ? main.hsn : '', quantity: 1,
      unit: 'NOS', uqc: 'NOS', rate: r2(taxable), discount: 0, gstRate: rate, taxableAmount: r2(taxable),
      ...splitTax(shipping - taxable), cess: 0, total: r2(shipping), isDelivery: true,
    });
  }

  const grandTotal = r2(p.total_amount);
  const totalTax = r2(p.total_gst_amount);
  const roundOff = r2(p.round_off);
  const status = PHONE_TO_WEB_STATUS[str(p.status)] || 'unpaid';
  const totalTaxable = r2(grandTotal - totalTax - roundOff - reimbursement);
  return {
    ...prev,
    id: str(p.id),
    invoiceNumber: str(p.invoice_number),
    type: prev.type || 'tax_invoice',
    status,
    businessId: prev.businessId || '',
    partyId: str(p.customer_id) || prev.partyId || '',
    partyName: str(p.customer_name),
    partyGstin: str(p.bill_to_gstin),
    partyPhone: prev.partyPhone || '',
    date: day(p.invoice_date || p.created_at),
    dueDate: day(p.due_date),
    items,
    subtotal: totalTaxable,
    totalDiscount: 0,
    totalTaxable,
    totalCgst: r2(p.total_cgst),
    totalSgst: r2(p.total_sgst),
    totalIgst: r2(p.total_igst),
    totalTax,
    roundOff,
    grandTotal,
    paidAmount: status === 'paid' ? grandTotal : 0,
    balanceDue: status === 'paid' ? 0 : grandTotal,
    paymentMode: prev.paymentMode || '',
    notes: str(p.notes),
    terms: prev.terms || '',
    placeOfSupply: str(p.place_of_supply),
    isInterState: inter,
    isTotalMode: false,
    createdAt: str(p.created_at) || now,
    updatedAt: now,
    sellerGstin: str(p.seller_gstin),
    shipToGstin: str(p.ship_to_gstin),
    shipToAddress: str(p.ship_to_address),
    documentType: str(p.document_type) || 'INV',
    reverseCharge: p.reverse_charge === true,
    ...(reimbursement > 0 ? { deliveryReimbursement: r2(reimbursement) } : { deliveryReimbursement: undefined }),
    irn: str(p.irn) || undefined,
    ackNo: str(p.ack_no) || undefined,
    ackDate: str(p.ack_dt) || undefined,
    signedQr: str(p.signed_qr) || undefined,
    ewayBillNo: str(p.eway_bill_no) || undefined,
    ewayBillDate: str(p.eway_bill_date) || undefined,
  };
}

function webToPhoneInvoice(w) {
  const goods = (w.items || []).filter((it) => !it.isDelivery);
  const delivery = (w.items || []).filter((it) => it.isDelivery).reduce((s, it) => s + num(it.total), 0);
  const reimbursement = num(w.deliveryReimbursement);
  const status = w.status === 'paid' || w.status === 'cancelled' || w.status === 'draft' ? w.status : 'pending';
  return {
    id: str(w.id),
    invoice_number: str(w.invoiceNumber),
    customer_name: str(w.partyName),
    customer_id: str(w.partyId) || null,
    created_at: str(w.createdAt),
    invoice_date: day(w.date),
    due_date: day(w.dueDate) || null,
    notes: str(w.notes),
    place_of_supply: str(w.placeOfSupply),
    discount_percent: 0,
    shipping_charges: r2(delivery + reimbursement),
    shipping_is_reimbursement: reimbursement > 0 && delivery === 0,
    round_off: r2(w.roundOff),
    status,
    total_amount: r2(w.grandTotal),
    total_gst_amount: r2(w.totalTax),
    total_cgst: r2(w.totalCgst),
    total_sgst: r2(w.totalSgst),
    total_igst: r2(w.totalIgst),
    items: goods.map((it) => {
      const qty = num(it.quantity) || 1;
      return {
        name: str(it.description),
        hsn_code: str(it.hsn),
        quantity: qty,
        unit_price: r2(num(it.total) / qty),
        gst_rate: num(it.gstRate),
        discount_percent: 0,
        cess: r2(it.cess),
        uqc: str(it.uqc || it.unit) || 'NOS',
        taxable_value: r2(it.taxableAmount),
        gst_amount: r2(num(it.cgst) + num(it.sgst) + num(it.igst)),
        cgst: r2(it.cgst),
        sgst: r2(it.sgst),
        igst: r2(it.igst),
        total: r2(it.total),
      };
    }),
    is_offline: false,
    currency: 'INR',
    seller_gstin: str(w.sellerGstin),
    bill_to_gstin: str(w.partyGstin),
    ship_to_gstin: str(w.shipToGstin),
    ship_to_address: str(w.shipToAddress),
    reverse_charge: w.reverseCharge === true,
    document_type: str(w.documentType) || 'INV',
    irn: w.irn || null,
    ack_no: w.ackNo || null,
    ack_dt: w.ackDate || null,
    signed_qr: w.signedQr || null,
    eway_bill_no: w.ewayBillNo || null,
    eway_bill_date: w.ewayBillDate || null,
  };
}

// ------------------------------------------------------------- customers / stock

function phoneToWebParty(c, prev = {}, now = new Date().toISOString()) {
  const gstin = str(c.gstin).toUpperCase();
  return {
    ...prev,
    id: str(c.id),
    name: str(c.name),
    gstin,
    pan: prev.pan || (gstin.length === 15 ? gstin.slice(2, 12) : ''),
    email: str(c.email),
    phone: str(c.phone),
    address: str(c.billing_address ?? c.address),
    city: str(c.city),
    state: str(c.state),
    stateCode: gstin.length === 15 ? gstin.slice(0, 2) : prev.stateCode || '',
    pincode: str(c.pincode),
    type: 'customer',
    createdAt: prev.createdAt || now,
    updatedAt: now,
    shipToGstin: str(c.ship_to_gstin) || undefined,
    shipToState: str(c.ship_to_state) || undefined,
  };
}

const webToPhoneCustomer = (p) => ({
  id: str(p.id),
  name: str(p.name),
  gstin: str(p.gstin),
  phone: str(p.phone),
  email: str(p.email),
  billing_address: str(p.address),
  shipping_address: str(p.shipToAddress),
  city: str(p.city),
  state: str(p.state),
  pincode: str(p.pincode),
  ship_to_gstin: str(p.shipToGstin),
  ship_to_state: str(p.shipToState),
});

function phoneToWebStock(s, prev = {}) {
  const gstRate = num(s.gst_rate);
  return {
    ...prev,
    id: str(s.id),
    name: str(s.name),
    hsn: str(s.hsn_code),
    unit: prev.unit || 'NOS',
    openingStock: prev.openingStock ?? num(s.stock_on_hand),
    currentStock: num(s.stock_on_hand),
    minStock: num(s.reorder_level),
    // Phone sell prices include GST; the web keeps the rate before tax.
    rate: r2(num(s.sell_price) / (1 + gstRate / 100)),
    gstRate,
    barcode: str(s.barcode) || undefined,
  };
}

const webToPhoneStock = (s, now = new Date().toISOString()) => ({
  id: str(s.id),
  name: str(s.name),
  barcode: str(s.barcode),
  hsn_code: str(s.hsn),
  gst_rate: num(s.gstRate),
  sell_price: r2(num(s.rate) * (1 + num(s.gstRate) / 100)),
  stock_on_hand: num(s.currentStock),
  reorder_level: num(s.minStock),
  updated_at: now,
});

// ------------------------------------------------------------- merge

const KINDS = {
  invoices: { webKey: 'invoices', phoneFp: phoneInvoiceFp, webFp: webInvoiceFp, toWeb: phoneToWebInvoice, toPhone: webToPhoneInvoice },
  customers: {
    webKey: 'parties', phoneFp: phoneCustomerFp, webFp: webPartyFp, toWeb: phoneToWebParty, toPhone: webToPhoneCustomer,
    include: (p) => (p.type || 'customer') === 'customer',
  },
  inventory: { webKey: 'stock', phoneFp: phoneStockFp, webFp: webStockFp, toWeb: phoneToWebStock, toPhone: webToPhoneStock },
};

/**
 * Merge what the phone sent into `appData` (mutated copy returned) and work
 * out which records the phone must upsert.
 */
function mergePhoneSync(appData, phone, now = new Date().toISOString()) {
  const data = { ...emptyAppData(), ...(appData || {}) };
  const deleted = {};
  for (const [key, ids] of Object.entries(data.deleted || {})) deleted[key] = { ...(ids || {}) };
  const out = { deleted: {} };
  const phoneDeleted = (phone && phone.deleted) || {};
  for (const [kind, k] of Object.entries(KINDS)) {
    const tomb = (deleted[k.webKey] = deleted[k.webKey] || {});
    for (const id of Array.isArray(phoneDeleted[kind]) ? phoneDeleted[kind] : []) {
      if (str(id)) tomb[str(id)] = tomb[str(id)] || now;
    }
    const web = (Array.isArray(data[k.webKey]) ? data[k.webKey] : []).filter((w) => !(w && tomb[str(w.id)]));
    const index = new Map(web.map((w, i) => [str(w && w.id), i]));
    const sent = new Map();
    const goneOnPhone = [];
    for (const p of Array.isArray(phone[kind]) ? phone[kind] : []) {
      if (!p || !str(p.id)) continue;
      if (tomb[str(p.id)]) goneOnPhone.push(str(p.id));
      else sent.set(str(p.id), p);
    }
    out.deleted[kind] = goneOnPhone;
    const toPhone = [];

    for (const [id, p] of sent) {
      const pFp = k.phoneFp(p);
      if (!index.has(id)) {
        const w = k.toWeb(p, {}, now);
        w._sync = { p: pFp, w: k.webFp(w) };
        index.set(id, web.push(w) - 1);
        continue;
      }
      const i = index.get(id);
      const w = web[i];
      const webEdited = !w._sync || w._sync.w !== k.webFp(w);
      const phoneEdited = !w._sync || w._sync.p !== pFp;
      if (webEdited) {
        toPhone.push(k.toPhone(w, now));
      } else if (phoneEdited) {
        const next = k.toWeb(p, w, now);
        next._sync = { p: pFp, w: k.webFp(next) };
        web[i] = next;
      }
    }

    for (let i = 0; i < web.length; i++) {
      const w = web[i];
      if (!w || !str(w.id) || (k.include && !k.include(w))) continue;
      const id = str(w.id);
      const phoneHasCurrent = sent.has(id) && w._sync && w._sync.w === k.webFp(w);
      if (!sent.has(id)) toPhone.push(k.toPhone(w, now));
      if (!phoneHasCurrent) {
        // After the phone applies our copy, both views agree again.
        const phoneView = k.toPhone(w, now);
        web[i] = { ...w, _sync: { p: k.phoneFp(phoneView), w: k.webFp(w) } };
      }
    }

    data[k.webKey] = web;
    out[kind] = toPhone;
  }
  if (!data.activeBusinessId && data.businesses[0]) data.activeBusinessId = data.businesses[0].id;
  for (const inv of data.invoices) {
    if (!inv.businessId && data.activeBusinessId) inv.businessId = data.activeBusinessId;
  }
  data.invoiceCounter = Math.max(num(data.invoiceCounter), data.invoices.length);
  data.deleted = deleted;
  return { appData: stripUndefined(data), toPhone: out };
}

function emptyAppData() {
  return {
    businesses: [], parties: [], invoices: [], stock: [], activeBusinessId: null, invoiceCounter: 0,
    settings: {}, creditNotes: [], debitNotes: [], payroll: [], deliveryChallans: [], expenses: [],
    quotes: [], purchases: [], payments: [], templates: [], khataEntries: [],
  };
}

// Firestore rejects `undefined` values.
function stripUndefined(v) {
  if (Array.isArray(v)) return v.map(stripUndefined);
  if (v && typeof v === 'object') {
    const o = {};
    for (const [key, val] of Object.entries(v)) if (val !== undefined) o[key] = stripUndefined(val);
    return o;
  }
  return v;
}

module.exports = {
  mergePhoneSync,
  phoneToWebInvoice,
  webToPhoneInvoice,
  phoneToWebParty,
  webToPhoneCustomer,
  phoneToWebStock,
  webToPhoneStock,
  phoneInvoiceFp,
  webInvoiceFp,
  emptyAppData,
};

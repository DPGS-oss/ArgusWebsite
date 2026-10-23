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
// Fingerprints keep the original rounding so records synced before stay "unchanged".
const r2 = (v) => Math.round(num(v) * 100) / 100;
const money = require('./money');
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
const phoneNoteFp = (p) => hash([str(p.credit_note_number || p.debit_note_number), str(p.status), r2(p.total_amount), str(p.invoice_id), (p.items || []).length]);
const webNoteFp = (w) => hash([str(w.creditNoteNumber || w.debitNoteNumber), str(w.status), r2(w.totalAmount), str(w.invoiceId), (w.items || []).length]);
const phoneCustomerFp = (c) => hash([c.name, c.gstin, c.phone, c.email, c.billing_address ?? c.address, c.city, c.state, c.pincode].map(str));
const webPartyFp = (p) => hash([p.name, p.gstin, p.phone, p.email, p.address, p.city, p.state, p.pincode].map(str));
const stockExtras = (cost, valuation, batches, bom) => {
  const bomKey = (Array.isArray(bom) ? bom : []).map((c) => `${str(c && c.itemId)}:${r2(c && c.qty)}`).join(',');
  return cost || valuation === 'fifo' || batches || bomKey ? [r2(cost), valuation === 'fifo' ? 'fifo' : 'average', !!batches, bomKey] : [];
};
const phoneStockFp = (s) => hash([str(s.name), str(s.hsn_code), r2(s.gst_rate), r2(s.sell_price), r2(s.stock_on_hand), r2(s.reorder_level), str(s.barcode),
  ...stockExtras(num(s.cost_price), str(s.valuation), s.track_batches === true, s.bom)]);
const webStockFp = (s) => hash([str(s.name), str(s.hsn), r2(s.gstRate), r2(s.rate), r2(s.currentStock), r2(s.minStock), str(s.barcode),
  ...stockExtras(num(s.costPrice), str(s.valuation), s.trackBatches === true, s.bom)]);
const cleanBom = (bom) => (Array.isArray(bom) ? bom : [])
  .filter((c) => c && str(c.itemId) && num(c.qty) > 0)
  .slice(0, 50)
  .map((c) => ({ itemId: str(c.itemId), qty: num(c.qty) }));

// ------------------------------------------------------------- invoices

const PHONE_TO_WEB_STATUS = { paid: 'paid', cancelled: 'cancelled', draft: 'draft' };

function phoneToWebInvoice(p, prev = {}, now = new Date().toISOString()) {
  // IGST on the bill means inter-state. A bill with no tax (0% goods) still
  // can be inter-state: compare the place of supply with the seller's state.
  const sellerState = /^\d{2}/.test(str(p.seller_gstin)) ? str(p.seller_gstin).slice(0, 2) : '';
  const posState = (str(p.place_of_supply).match(/^\d{2}/) || [''])[0];
  const taxed = num(p.total_cgst) + num(p.total_sgst) + num(p.total_igst) > 0;
  const inter = num(p.total_igst) > 0 || (!taxed && sellerState !== '' && posState !== '' && posState !== sellerState);
  // Same split rule as the phone: CGST is half the tax rounded, SGST the rest.
  const splitTax = (tax) => (inter
    ? { cgst: 0, sgst: 0, igst: money.round2(tax) }
    : { ...money.splitTax(tax), igst: 0 });

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
      taxableAmount: money.round2(taxable),
      ...splitTax(tax),
      cess: money.round2(it.cess),
      total: money.round2(taxable + tax),
      // Phone prices include GST; keeps the line exact if the bill is edited on the web.
      inclusiveTotal: money.round2(taxable + tax),
    };
  });

  const shipping = num(p.shipping_charges);
  const reimbursement = p.shipping_is_reimbursement ? shipping : 0;
  if (shipping > 0 && !p.shipping_is_reimbursement) {
    // Delivery is taxed with the goods (s.15(2)(c)) and the amount includes GST.
    // Split exactly as the phone does (lib/core/utils/invoice_totals.dart): by
    // each line's share of the value, the last line taking the remainder, each
    // part taxed at its line's rate; then one delivery line per rate.
    const shipPaise = money.toPaise(shipping);
    const weight = items.reduce((s2, it) => s2 + money.toPaise(it.total), 0);
    const byRate = new Map();
    let allocated = 0;
    items.forEach((it, k) => {
      if (weight <= 0) return;
      const share = k === items.length - 1
        ? shipPaise - allocated
        : money.roundPaise((shipPaise * money.toPaise(it.total)) / weight);
      allocated += share;
      const taxablePart = money.roundPaise(share / (1 + it.gstRate / 100));
      const g = byRate.get(it.gstRate) || { hsn: it.hsn, share: 0, taxable: 0 };
      g.share += share;
      g.taxable += taxablePart;
      byRate.set(it.gstRate, g);
    });
    const groups = [...byRate.entries()];
    for (const [rate, g] of groups) {
      // Split the rate's delivery GST once, so CGST and SGST stay equal halves.
      const split = inter ? { cgst: 0, sgst: 0 } : money.splitTax((g.share - g.taxable) / 100);
      g.cgst = money.toPaise(split.cgst);
      g.sgst = money.toPaise(split.sgst);
      g.igst = inter ? g.share - g.taxable : 0;
      items.push({
        id: `${p.id}-delivery${groups.length > 1 ? `-${rate}` : ''}`,
        description: groups.length > 1 ? `Delivery charges (${rate}%)` : 'Delivery charges',
        hsn: g.hsn, quantity: 1, unit: 'NOS', uqc: 'NOS', rate: g.taxable / 100, discount: 0, gstRate: rate,
        taxableAmount: g.taxable / 100, cgst: g.cgst / 100, sgst: g.sgst / 100, igst: g.igst / 100, cess: 0,
        total: g.share / 100, inclusiveTotal: g.share / 100, isDelivery: true,
      });
    }
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
    type: str(p.document_type) === 'BOS' ? 'bill_of_supply' : prev.type === 'bill_of_supply' ? 'tax_invoice' : prev.type || 'tax_invoice',
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
    documentType: str(p.document_type) === 'BOS' ? 'INV' : str(p.document_type) || 'INV',
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
    document_type: w.type === 'bill_of_supply' ? 'BOS' : str(w.documentType) || 'INV',
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

function phoneToWebStock(s, prev = {}, now = new Date().toISOString()) {
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
    costPrice: num(s.cost_price) || prev.costPrice || 0,
    valuation: str(s.valuation) === 'fifo' ? 'fifo' : 'average',
    trackBatches: s.track_batches === true,
    bom: cleanBom(s.bom),
    // Edited on the phone now: a browser's older copy must not overwrite it.
    updatedAt: now,
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
  cost_price: num(s.costPrice),
  valuation: s.valuation === 'fifo' ? 'fifo' : 'average',
  track_batches: s.trackBatches === true,
  bom: cleanBom(s.bom),
  updated_at: now,
});

// ------------------------------------------------------------- notes
// Credit and debit notes made on either side, so GSTR-1 (CDNR) and the CA see them.

function noteLineToWeb(it, id, inter) {
  const qty = num(it.quantity) || 1;
  const taxable = num(it.taxable_value);
  const tax = num(it.cgst) + num(it.sgst) + num(it.igst) || num(it.gst_amount);
  const split = inter ? { cgst: 0, sgst: 0, igst: money.round2(tax) } : { ...money.splitTax(tax), igst: 0 };
  return {
    id, description: str(it.name), hsn: str(it.hsn_code), quantity: qty, unit: str(it.uqc) || 'NOS',
    uqc: str(it.uqc) || 'NOS', rate: money.round2(taxable / qty), discount: 0, gstRate: num(it.gst_rate),
    taxableAmount: money.round2(taxable), ...split, cess: money.round2(it.cess), total: money.round2(taxable + tax),
    inclusiveTotal: money.round2(taxable + tax),
  };
}

function noteLineToPhone(it) {
  const qty = num(it.quantity) || 1;
  return {
    name: str(it.description), hsn_code: str(it.hsn), quantity: qty, unit_price: money.round2(num(it.total) / qty),
    gst_rate: num(it.gstRate), discount_percent: 0, cess: money.round2(it.cess), uqc: str(it.uqc || it.unit) || 'NOS',
    taxable_value: money.round2(it.taxableAmount), gst_amount: money.round2(num(it.cgst) + num(it.sgst) + num(it.igst)),
    cgst: money.round2(it.cgst), sgst: money.round2(it.sgst), igst: money.round2(it.igst), total: money.round2(it.total),
  };
}

function noteKind(numberKey, phoneNumberKey) {
  return {
    toWeb(p, prev = {}, now = new Date().toISOString()) {
      const inter = (p.items || []).some((it) => num(it.igst) > 0);
      return {
        ...prev,
        id: str(p.id),
        [numberKey]: str(p[phoneNumberKey]),
        invoiceId: str(p.invoice_id) || undefined,
        customerName: str(p.customer_name),
        customerId: str(p.customer_id) || undefined,
        reason: str(p.reason),
        items: (p.items || []).map((it, i) => noteLineToWeb(it, `${p.id}-${i}`, inter)),
        subtotal: money.round2(p.subtotal),
        totalGstAmount: money.round2(p.total_gst_amount),
        totalAmount: money.round2(p.total_amount),
        notes: str(p.notes),
        status: str(p.status) || 'active',
        date: day(p.created_at),
        createdAt: str(p.created_at) || now,
        updatedAt: now,
      };
    },
    toPhone(w, now = new Date().toISOString()) {
      return {
        id: str(w.id),
        [phoneNumberKey]: str(w[numberKey]),
        invoice_id: str(w.invoiceId) || null,
        customer_name: str(w.customerName),
        customer_id: str(w.customerId) || null,
        reason: str(w.reason),
        items: (w.items || []).map(noteLineToPhone),
        subtotal: money.round2(w.subtotal),
        total_gst_amount: money.round2(w.totalGstAmount),
        total_amount: money.round2(w.totalAmount),
        notes: str(w.notes),
        status: str(w.status) || 'active',
        created_at: str(w.date) || str(w.createdAt),
        updated_at: now,
      };
    },
  };
}
// ------------------------------------------------------------- purchases
// So GSTR-9, GSTR-2B matching and the CA see purchases made on the phone.

const phonePurchaseFp = (p) => hash([str(p.supplier_name), str(p.supplier_gstin), str(p.supplier_invoice_number), day(p.supplier_invoice_date), r2(p.total_amount), r2(p.total_gst_amount), p.reverse_charge === true, p.itc_eligible !== false]);
const webPurchaseFp = (w) => hash([str(w.supplierName), str(w.supplierGstin), str(w.supplierInvoiceNumber), day(w.supplierInvoiceDate), r2(w.totalAmount), r2(w.totalGstAmount), w.reverseCharge === true, w.itcEligible !== false]);

const purchaseKind = {
  toWeb(p, prev = {}, now = new Date().toISOString()) {
    const inter = num(p.total_igst) > 0 || (p.items || []).some((it) => num(it.igst) > 0);
    return {
      ...prev,
      id: str(p.id),
      purchaseNumber: str(p.purchase_number) || prev.purchaseNumber || str(p.id),
      supplierName: str(p.supplier_name),
      supplierId: str(p.supplier_id) || undefined,
      supplierGstin: str(p.supplier_gstin).toUpperCase() || undefined,
      supplierInvoiceNumber: str(p.supplier_invoice_number),
      supplierInvoiceDate: day(p.supplier_invoice_date) || undefined,
      reverseCharge: p.reverse_charge === true,
      itcEligible: p.itc_eligible !== false,
      createdAt: str(p.created_at) || now,
      totalAmount: money.round2(p.total_amount),
      totalGstAmount: money.round2(p.total_gst_amount),
      totalCgst: money.round2(p.total_cgst),
      totalSgst: money.round2(p.total_sgst),
      totalIgst: money.round2(p.total_igst),
      items: (p.items || []).map((it, i) => noteLineToWeb(it, `${p.id}-${i}`, inter)),
      paymentMethod: prev.paymentMethod,
      paidAmount: prev.paidAmount,
    };
  },
  toPhone(w, now = new Date().toISOString()) {
    return {
      id: str(w.id),
      purchase_number: str(w.purchaseNumber),
      supplier_name: str(w.supplierName),
      supplier_id: str(w.supplierId) || null,
      created_at: str(w.createdAt) || now,
      total_amount: money.round2(w.totalAmount),
      total_gst_amount: money.round2(w.totalGstAmount),
      items: (w.items || []).map(noteLineToPhone),
      supplier_gstin: str(w.supplierGstin),
      supplier_invoice_number: str(w.supplierInvoiceNumber),
      supplier_invoice_date: day(w.supplierInvoiceDate),
      reverse_charge: w.reverseCharge === true,
      itc_eligible: w.itcEligible !== false,
      total_cgst: money.round2(w.totalCgst),
      total_sgst: money.round2(w.totalSgst),
      total_igst: money.round2(w.totalIgst),
    };
  },
};

// ------------------------------------------------------------- expenses
// Rent, electricity, salaries made on the phone reach the website, the CA and
// profit and loss; those made on the website reach the phone.

const phoneExpenseFp = (p) => hash([str(p.category), str(p.description), r2(p.amount), day(p.date), str(p.payment_mode).toLowerCase(), str(p.vendor), r2(p.gst_amount), p.is_gst_claimable === true, str(p.vendor_gstin).toUpperCase()]);
const webExpenseFp = (w) => hash([str(w.category), str(w.description), r2(w.amount), day(w.date), str(w.paymentMode).toLowerCase(), str(w.vendor), r2(w.gstAmount), w.isGstClaimable === true, str(w.vendorGstin).toUpperCase()]);

const expenseKind = {
  toWeb(p, prev = {}, now = new Date().toISOString()) {
    return {
      ...prev,
      id: str(p.id),
      category: str(p.category),
      description: str(p.description),
      amount: money.round2(p.amount),
      date: day(p.date) || day(p.created_at) || day(now),
      paymentMode: str(p.payment_mode) || prev.paymentMode || 'Cash',
      vendor: str(p.vendor),
      gstAmount: money.round2(p.gst_amount),
      isGstClaimable: p.is_gst_claimable === true,
      vendorGstin: str(p.vendor_gstin).toUpperCase() || undefined,
      createdAt: str(p.created_at) || prev.createdAt || now,
      updatedAt: str(p.updated_at) || now,
    };
  },
  toPhone(w, now = new Date().toISOString()) {
    return {
      id: str(w.id),
      category: str(w.category),
      description: str(w.description),
      amount: money.round2(w.amount),
      date: day(w.date),
      payment_mode: str(w.paymentMode).toLowerCase() || 'cash',
      vendor: str(w.vendor),
      gst_amount: money.round2(w.gstAmount),
      is_gst_claimable: w.isGstClaimable === true,
      vendor_gstin: str(w.vendorGstin),
      created_at: str(w.createdAt) || now,
      updated_at: str(w.updatedAt) || now,
      is_offline: false,
    };
  },
};

// ------------------------------------------------------------- khata
// Only entries typed by hand (udhar given, money received). Ledger lines made
// from bills, purchases and payments are not synced: each side makes its own
// from those records, which sync already.

const phoneKhataFp = (p) => hash([str(p.customer_id), str(p.customer_name), r2(p.amount), str(p.description), str(p.created_at), p.is_credit === true, str(p.payment_method)]);
const webKhataFp = (w) => hash([str(w.customerId), str(w.customerName), r2(w.amount), str(w.description), str(w.createdAt), w.isCredit === true, str(w.paymentMethod)]);

const khataKind = {
  accept: (p) => !str(p.source_type),
  include: (w) => !str(w.sourceType),
  toWeb(p, prev = {}, now = new Date().toISOString()) {
    return {
      ...prev,
      id: str(p.id),
      customerId: str(p.customer_id),
      customerName: str(p.customer_name),
      amount: money.round2(p.amount),
      description: str(p.description),
      createdAt: str(p.created_at) || prev.createdAt || now,
      isCredit: p.is_credit === true,
      accountType: str(p.account_type) || 'party',
      partyKind: str(p.party_kind) || 'customer',
      paymentMethod: str(p.payment_method) || undefined,
    };
  },
  toPhone(w) {
    return {
      id: str(w.id),
      customer_id: str(w.customerId),
      customer_name: str(w.customerName),
      amount: money.round2(w.amount),
      description: str(w.description),
      created_at: str(w.createdAt),
      is_credit: w.isCredit === true,
      account_type: str(w.accountType) || 'party',
      party_kind: str(w.partyKind) || 'customer',
      payment_method: str(w.paymentMethod),
      source_type: '',
      source_id: '',
    };
  },
};

const creditNoteKind = noteKind('creditNoteNumber', 'credit_note_number');
const debitNoteKind = noteKind('debitNoteNumber', 'debit_note_number');

// ------------------------------------------------------------- merge

const KINDS = {
  invoices: { webKey: 'invoices', phoneFp: phoneInvoiceFp, webFp: webInvoiceFp, toWeb: phoneToWebInvoice, toPhone: webToPhoneInvoice },
  customers: {
    webKey: 'parties', phoneFp: phoneCustomerFp, webFp: webPartyFp, toWeb: phoneToWebParty, toPhone: webToPhoneCustomer,
    include: (p) => (p.type || 'customer') === 'customer',
  },
  inventory: { webKey: 'stock', phoneFp: phoneStockFp, webFp: webStockFp, toWeb: phoneToWebStock, toPhone: webToPhoneStock },
  creditNotes: { webKey: 'creditNotes', phoneFp: phoneNoteFp, webFp: webNoteFp, ...creditNoteKind },
  debitNotes: { webKey: 'debitNotes', phoneFp: phoneNoteFp, webFp: webNoteFp, ...debitNoteKind },
  purchases: { webKey: 'purchases', phoneFp: phonePurchaseFp, webFp: webPurchaseFp, ...purchaseKind },
  expenses: { webKey: 'expenses', phoneFp: phoneExpenseFp, webFp: webExpenseFp, ...expenseKind },
  khataEntries: { webKey: 'khataEntries', phoneFp: phoneKhataFp, webFp: webKhataFp, ...khataKind },
};

// ------------------------------------------------------------- edit log
// Append-only. The phone sends entries it has not sent before; the server
// stamps `syncedAt` on every entry the first time it reaches the cloud and
// returns those stamped after the phone's last sync (`auditSince`).

const AUDIT_FIELDS = ['id', 'at', 'byUid', 'byName', 'device', 'action', 'entity', 'entityId', 'ref', 'detail'];

function mergeAudit(data, sent, since, now) {
  const log = Array.isArray(data.auditLog) ? data.auditLog.filter((e) => e && str(e.id)) : [];
  const known = new Set(log.map((e) => str(e.id)));
  for (const e of log) if (!e.syncedAt) e.syncedAt = now;
  const sentIds = new Set();
  for (const raw of Array.isArray(sent) ? sent.slice(0, 5000) : []) {
    if (!raw || !str(raw.id)) continue;
    const id = str(raw.id);
    sentIds.add(id);
    if (known.has(id)) continue;
    const e = {};
    for (const k of AUDIT_FIELDS) e[k] = str(raw[k]).slice(0, k === 'detail' ? 2000 : 200);
    e.device = e.device === 'web' ? 'web' : 'android';
    e.syncedAt = now;
    log.push(e);
    known.add(id);
  }
  log.sort((a, b) => str(a.at).localeCompare(str(b.at)));
  data.auditLog = log;
  return log.filter((e) => !sentIds.has(str(e.id)) && (!since || str(e.syncedAt) > since));
}

// ------------------------------------------------------------- stock movements
// Movements never change once made, so both sides keep the union (by id).
// With apps that record movements, the movements are the truth: each item's
// quantity on hand is their sum, so a sale made on the phone and one made on
// the website at the same time both count. Older app versions change stock
// without movements; for them one "matched after sync" movement closes the gap.

const MOVE_KINDS = new Set(['opening', 'purchase', 'sale', 'sale_return', 'purchase_return', 'transfer', 'adjust', 'produce', 'consume']);
const r3 = (v) => Math.round(num(v) * 1000) / 1000;

function cleanMove(m) {
  const out = {
    id: str(m.id).slice(0, 80),
    itemId: str(m.itemId).slice(0, 80),
    date: str(m.date).slice(0, 10),
    kind: MOVE_KINDS.has(str(m.kind)) ? str(m.kind) : 'adjust',
    qty: r3(m.qty),
    godown: str(m.godown).slice(0, 60) || 'Main',
    createdAt: str(m.createdAt).slice(0, 40),
  };
  for (const k of ['batch', 'expiry', 'ref', 'refId', 'note']) if (str(m[k])) out[k] = str(m[k]).slice(0, k === 'note' ? 200 : 80);
  if (m.unitCost != null && Number.isFinite(Number(m.unitCost))) out.unitCost = num(m.unitCost);
  return out;
}

const sameMove = (a, b) => r3(a.qty) === r3(b.qty) && str(a.godown || 'Main') === str(b.godown || 'Main') && str(a.batch) === str(b.batch) && str(a.itemId) === str(b.itemId);

/**
 * `sent` is the phone's movements (undefined from older app versions).
 * Returns the movements the phone must add or replace (by id).
 */
function mergeStockMoves(data, sent, sentGodowns, now) {
  const recordsMoves = Array.isArray(sent);
  const moves = Array.isArray(data.stockMoves) ? data.stockMoves.filter((m) => m && str(m.id)) : [];
  const byId = new Map(moves.map((m) => [str(m.id), m]));
  const sentIds = new Set();
  const differs = new Set();
  for (const raw of recordsMoves ? sent.slice(0, 50000) : []) {
    if (!raw || !str(raw.id) || !str(raw.itemId)) continue;
    const id = str(raw.id);
    sentIds.add(id);
    const have = byId.get(id);
    if (have) {
      // Same id, different content (e.g. both sides made the opening stock): the cloud's copy wins.
      if (!sameMove(have, raw)) differs.add(id);
      continue;
    }
    const m = cleanMove(raw);
    moves.push(m);
    byId.set(id, m);
  }
  // Gone items take their movements with them.
  const items = new Map((data.stock || []).map((s) => [str(s.id), s]));
  const kept = moves.filter((m) => items.has(str(m.itemId)));
  const sums = new Map();
  for (const m of kept) sums.set(m.itemId, r3((sums.get(m.itemId) || 0) + num(m.qty)));
  for (const [itemId, sum] of sums) {
    const item = items.get(itemId);
    const gap = r3(num(item.currentStock) - sum);
    if (Math.abs(gap) < 1e-9) continue;
    if (recordsMoves) {
      // The movements are the truth; the phone works out the same sum, so keep both sides in step.
      const inStep = item._sync && item._sync.w === webStockFp(item);
      item.currentStock = sum;
      if (inStep) item._sync = { p: phoneStockFp(webToPhoneStock(item)), w: webStockFp(item) };
    } else {
      kept.push({
        id: `mv_sync_${crypto.randomUUID()}`, itemId, date: now.slice(0, 10), kind: 'adjust', qty: gap, godown: 'Main',
        note: 'Matched to stock after sync', createdAt: now,
      });
    }
  }
  data.stockMoves = kept;
  const names = [...(Array.isArray(data.godowns) ? data.godowns : []), ...(Array.isArray(sentGodowns) ? sentGodowns : [])]
    .map((g) => str(g).slice(0, 60))
    .filter((g) => g && g !== 'Main');
  data.godowns = [...new Set(names)].slice(0, 100);
  return kept.filter((m) => !sentIds.has(str(m.id)) || differs.has(str(m.id)));
}

const ISSUED_DOCS = new Set(['invoices', 'creditNotes', 'debitNotes']);
const isDraft = (w) => str(w.status).toLowerCase() === 'draft';

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
    // Issued bills and notes are never deleted (GST law: cancel or issue a note);
    // only drafts, or records the cloud never had, can be removed.
    const current = new Map((Array.isArray(data[k.webKey]) ? data[k.webKey] : []).map((w) => [str(w && w.id), w]));
    for (const id of Array.isArray(phoneDeleted[kind]) ? phoneDeleted[kind] : []) {
      if (!str(id)) continue;
      const w = current.get(str(id));
      if (ISSUED_DOCS.has(kind) && w && !isDraft(w)) continue;
      tomb[str(id)] = tomb[str(id)] || now;
    }
    const web = (Array.isArray(data[k.webKey]) ? data[k.webKey] : []).filter((w) => !(w && tomb[str(w.id)]));
    const index = new Map(web.map((w, i) => [str(w && w.id), i]));
    const sent = new Map();
    const goneOnPhone = [];
    for (const p of Array.isArray(phone[kind]) ? phone[kind] : []) {
      if (!p || !str(p.id) || (k.accept && !k.accept(p))) continue;
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
  // The business itself: a phone that has one fills an empty website; the
  // website's active business goes back so a new phone is set up at once.
  const pb = phone.business && typeof phone.business === 'object' ? phone.business : null;
  if (!data.businesses.length && pb && str(pb.name)) {
    const gstin = str(pb.gstin).toUpperCase();
    data.businesses = [{
      id: 'biz-phone', name: str(pb.name).slice(0, 200), gstin, pan: gstin.length === 15 ? gstin.slice(2, 12) : '',
      address: str(pb.address).slice(0, 500), city: str(pb.city).slice(0, 100), state: str(pb.state).slice(0, 100),
      stateCode: /^\d{2}/.test(gstin) ? gstin.slice(0, 2) : '', pincode: str(pb.pincode).slice(0, 10),
      phone: str(pb.phone).slice(0, 20), email: str(pb.email).slice(0, 200), composition: pb.composition === true,
    }];
  }
  if (!data.activeBusinessId && data.businesses[0]) data.activeBusinessId = data.businesses[0].id;
  for (const inv of data.invoices) {
    if (!inv.businessId && data.activeBusinessId) inv.businessId = data.activeBusinessId;
  }
  data.invoiceCounter = Math.max(num(data.invoiceCounter), data.invoices.length);
  data.deleted = deleted;
  const active = data.businesses.find((b) => b && b.id === data.activeBusinessId) || data.businesses[0];
  if (active) {
    out.business = {
      name: str(active.name), gstin: str(active.gstin), address: str(active.address), city: str(active.city),
      state: str(active.state), pincode: str(active.pincode), phone: str(active.phone), email: str(active.email),
      composition: active.composition === true,
    };
  }
  out.auditLog = mergeAudit(data, phone.auditLog, str(phone.auditSince), now);
  out.auditSince = now;
  // Older app versions send no movements and get none back, but their stock
  // changes are still matched in the website's movements.
  const newMoves = mergeStockMoves(data, phone.stockMoves, phone.godowns, now);
  if (Array.isArray(phone.stockMoves)) {
    out.stockMoves = newMoves;
    out.godowns = data.godowns;
    const fresh = new Map(data.stock.map((w) => [str(w.id), w]));
    out.inventory = (out.inventory || []).map((p) => (fresh.has(str(p.id)) ? webToPhoneStock(fresh.get(str(p.id)), now) : p));
  }
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
  isDraft,
  mergeStockMoves,
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

const test = require('node:test');
const assert = require('node:assert/strict');
const { parse2b, match2b, itcTotals, normNumber } = require('./gstr2b');
const { buildGstr9, gstr9Rows, exemptReport } = require('./gstr9');

// Shape of the JSON the GST portal gives for GSTR-2B (Returns → GSTR-2B → Download).
const SAMPLE_2B = {
  data: {
    gstin: '07AAKFS1234M1ZZ',
    rtnprd: '102026',
    gendt: '14-11-2026',
    docdata: {
      b2b: [
        {
          ctin: '27AAPFU0939F1ZV', trdnm: 'Mumbai Steel',
          inv: [
            { inum: 'MS/0042', dt: '05-10-2026', val: 11800, pos: '07', rev: 'N', itcavl: 'Y', txval: 10000, igst: 1800, cgst: 0, sgst: 0, cess: 0 },
            { inum: 'MS/0043', dt: '09-10-2026', val: 5900, pos: '07', rev: 'N', itcavl: 'Y', txval: 5000, igst: 900, cgst: 0, sgst: 0, cess: 0 },
            { inum: 'MS/0050', dt: '20-10-2026', val: 1180, pos: '07', rev: 'N', itcavl: 'N', rsn: 'P', txval: 1000, igst: 180, cgst: 0, sgst: 0, cess: 0 },
          ],
        },
        {
          ctin: '07AAPFU0939F1ZX', trdnm: 'Delhi Traders',
          inv: [{ inum: 'DT-77', dt: '11-10-2026', val: 2360, pos: '07', rev: 'N', itcavl: 'Y', txval: 2000, igst: 0, cgst: 180, sgst: 180, cess: 0 }],
        },
      ],
      cdnr: [
        { ctin: '27AAPFU0939F1ZV', trdnm: 'Mumbai Steel', nt: [{ ntnum: 'CN-5', typ: 'C', dt: '25-10-2026', val: 1180, pos: '07', rev: 'N', itcavl: 'Y', txval: 1000, igst: 180, cgst: 0, sgst: 0, cess: 0 }] },
      ],
    },
  },
};

const purchase = (id, gstin, number, date, total, tax, head = 'igst', extra = {}) => ({
  id, purchaseNumber: id, supplierName: 'x', supplierGstin: gstin, supplierInvoiceNumber: number, supplierInvoiceDate: date,
  totalAmount: total, totalGstAmount: tax, [head === 'igst' ? 'totalIgst' : 'totalCgst']: head === 'igst' ? tax : tax / 2,
  ...(head === 'igst' ? {} : { totalSgst: tax / 2 }), itcEligible: true, items: [], createdAt: date, ...extra,
});

test('bill numbers match whatever the punctuation, case or leading zeros', () => {
  assert.equal(normNumber('MS/0042'), normNumber('ms-42'));
  assert.equal(normNumber('INV 2026/007'), normNumber('inv-2026-7'));
  assert.notEqual(normNumber('MS/42'), normNumber('MS/420'));
});

test('GSTR-2B: matched, amount differs, only in 2B, only in books, not claimable', () => {
  const parsed = parse2b(SAMPLE_2B);
  assert.equal(parsed.docs.length, 5);
  const books = [
    purchase('p1', '27AAPFU0939F1ZV', 'ms-42', '2026-10-05', 11800, 1800),
    purchase('p2', '27AAPFU0939F1ZV', 'MS/43', '2026-10-09', 6018, 918), // supplier billed ₹5,900
    purchase('p3', '07AAPFU0939F1ZX', 'DT-99', '2026-10-15', 1180, 180, 'cgst'), // not filed by supplier
    purchase('p4', '07AAPFU0939F1ZX', 'DT-50', '2026-09-30', 1180, 180, 'cgst'), // another month: ignored
  ];
  const r = match2b(parsed, books);
  const by = (s) => r.rows.filter((x) => x.status === s);
  assert.equal(r.period, '2026-10');
  assert.equal(by('matched')[0].purchase.id, 'p1');
  assert.equal(by('amount_differs')[0].purchase.id, 'p2');
  assert.deepEqual(by('amount_differs')[0].difference, { taxable: -100, tax: -18 });
  assert.equal(by('only_in_2b')[0].doc.number, 'DT-77');
  assert.deepEqual(by('only_in_books').map((x) => x.purchase.id), ['p3']);
  assert.equal(by('not_claimable')[0].doc.number, 'MS/0050');
  assert.equal(r.summary.notes, 1);
  assert.equal(r.summary.claimableAsPer2b, 1800 + 900 + 360);
});

test('GSTR-2B credit totals per head (for GSTR-9 Table 8A) net of supplier credit notes', () => {
  assert.deepEqual(itcTotals(parse2b(SAMPLE_2B)), { igst: 1800 + 900 - 180, cgst: 180, sgst: 180, cess: 0 });
});

const line = (taxable, rate, inter, hsn = '9403') => {
  const tax = Math.round(taxable * rate) / 100;
  return {
    description: 'x', hsn, uqc: 'NOS', quantity: 1, gstRate: rate, taxableAmount: taxable,
    igst: inter ? tax : 0, cgst: inter ? 0 : tax / 2, sgst: inter ? 0 : tax / 2, total: taxable + tax,
  };
};
const bill = (id, date, items, extra = {}) => ({ id, invoiceNumber: id, type: 'tax_invoice', status: 'unpaid', date, partyGstin: '', items, ...extra });

test('GSTR-9: outward, exempt, credit notes, reverse charge, input credit and HSN tables', () => {
  const data = {
    invoices: [
      bill('b1', '2026-05-10', [line(1000, 18, false)]), // B2C
      bill('b2', '2026-06-10', [line(2000, 18, true)], { partyGstin: '27AAPFU0939F1ZV', isInterState: true }), // B2B
      bill('b3', '2026-07-10', [line(500, 0, false, '0701')]), // nil-rated line
      bill('b4', '2026-08-10', [line(300, 0, false, '1006')], { type: 'bill_of_supply' }), // exempt
      bill('b5', '2027-04-02', [line(9999, 18, false)]), // next year: ignored
      bill('b6', '2026-09-01', [line(4000, 18, false)], { status: 'cancelled' }), // ignored
    ],
    creditNotes: [{ id: 'c1', creditNoteNumber: 'CN/26-27/W0001', invoiceId: 'b2', customerName: 'x', status: 'active', date: '2026-06-20', createdAt: '', items: [line(200, 18, true)], subtotal: 200, totalGstAmount: 36, totalAmount: 236 }],
    debitNotes: [],
    purchases: [
      purchase('p1', '27AAPFU0939F1ZV', 'MS-1', '2026-05-01', 11800, 1800),
      purchase('p2', '', 'T-1', '2026-06-01', 1050, 50, 'cgst', { reverseCharge: true }), // RCM from unregistered
      purchase('p3', '07AAPFU0939F1ZX', 'X-1', '2026-07-01', 1180, 180, 'cgst', { itcEligible: false }), // blocked
    ],
  };
  const r = buildGstr9(data, '2026-27', { '102026': { igst: 1500, cgst: 0, sgst: 0, cess: 0 } });
  assert.deepEqual(r.table4.A, { txval: 1000, igst: 0, cgst: 90, sgst: 90, cess: 0 });
  assert.deepEqual(r.table4.B, { txval: 2000, igst: 360, cgst: 0, sgst: 0, cess: 0 });
  assert.deepEqual(r.table4.I, { txval: 200, igst: 36, cgst: 0, sgst: 0, cess: 0 });
  assert.equal(r.table4.G.txval, 1000);
  assert.equal(r.table4.N.txval, 1000 + 2000 + 1000 - 200);
  assert.equal(r.table5.C.txval, 500);
  assert.equal(r.table5.D.txval, 300);
  assert.equal(r.table5.turnover, 3800 + 800);
  assert.deepEqual(r.table6.B, { txval: 10000, igst: 1800, cgst: 0, sgst: 0, cess: 0 });
  assert.equal(r.table6.C.cgst, 25);
  assert.equal(r.table6.O.igst, 1800);
  assert.equal(r.table8.monthsWith2b, 1);
  assert.equal(r.table8.D.igst, 1500 - 1800);
  const hsn9403 = r.table17.find((h) => h.hsn === '9403' && h.rate === 18);
  assert.equal(hsn9403.txval, 1000 + 2000 - 200);
  assert.ok(gstr9Rows(r).length > 20);
});

test('exempt and nil-rated supplies report', () => {
  const data = {
    invoices: [
      bill('b3', '2026-07-10', [line(500, 0, false, '0701'), line(1000, 18, false)]),
      bill('b4', '2026-07-12', [line(300, 0, true, '1006')], { type: 'bill_of_supply', isInterState: true, partyGstin: '27AAPFU0939F1ZV' }),
    ],
    creditNotes: [], debitNotes: [],
  };
  const r = exemptReport(data, '2026-07-01', '2026-07-31');
  assert.equal(r.total, 800);
  assert.deepEqual(r.rows.map((x) => [x.supply, x.kind, x.value]).sort(), [
    ['Inter-state to registered', 'exempt', 300],
    ['Within state to unregistered', 'nil', 500],
  ]);
  assert.equal(r.lines.length, 2);
});

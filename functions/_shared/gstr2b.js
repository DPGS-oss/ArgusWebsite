/**
 * GSTR-2B matching without a GSP. The owner downloads their GSTR-2B JSON from
 * the GST portal (Returns → GSTR-2B → Download JSON) and uploads it; we match
 * every supplier document in it against the purchases in the books.
 *
 * Results, in plain words:
 * - matched: in 2B and in your books, amounts agree (within ₹1).
 * - amount_differs: same supplier and bill number, but the value or tax differs.
 * - only_in_2b: the supplier reported it, but it is not in your books.
 * - only_in_books: in your books for this month, but the supplier has not
 *   reported it yet, so you cannot claim its GST yet.
 * - not_claimable: in 2B but the portal marks the credit as not available.
 */
const { round2, toPaise } = require('./money');

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v) => (v == null ? '' : String(v)).trim();

/** "05-10-2026" or "2026-10-05" → "2026-10-05". */
function isoDate(v) {
  const s = str(v);
  const dmy = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(s);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return s.slice(0, 10);
}

/** Bill numbers match regardless of case, spaces, punctuation or leading zeros. */
function normNumber(v) {
  return str(v)
    .toUpperCase()
    .split(/[^A-Z0-9]+|(?<=[A-Z])(?=\d)|(?<=\d)(?=[A-Z])/)
    .filter(Boolean)
    .map((part) => part.replace(/^0+(?=\d)/, ''))
    .join('|');
}

/** Tax and taxable value of a 2B document: on the document, or summed over its items. */
function amounts(doc) {
  const lines = doc.items || doc.itms || [];
  const det = (l) => l.itm_det || l;
  const sum = (key) =>
    doc[key] != null ? num(doc[key]) : lines.reduce((s, l) => s + num(det(l)[key] ?? det(l)[key === 'igst' ? 'iamt' : key === 'cgst' ? 'camt' : key === 'sgst' ? 'samt' : key === 'cess' ? 'csamt' : key]), 0);
  return {
    txval: round2(sum('txval')),
    igst: round2(sum('igst')),
    cgst: round2(sum('cgst')),
    sgst: round2(sum('sgst')),
    cess: round2(sum('cess')),
  };
}

/** Supplier documents from a GSTR-2B JSON file (B2B invoices and credit/debit notes). */
function parse2b(json) {
  const root = json && json.data ? json.data : json || {};
  const docdata = root.docdata || {};
  const out = [];
  for (const sup of docdata.b2b || []) {
    for (const inv of sup.inv || []) {
      out.push({
        kind: 'invoice', ctin: str(sup.ctin).toUpperCase(), supplier: str(sup.trdnm), number: str(inv.inum),
        date: isoDate(inv.dt), value: round2(num(inv.val)), reverseCharge: str(inv.rev) === 'Y',
        itcAvailable: str(inv.itcavl || 'Y') !== 'N', reason: str(inv.rsn), ...amounts(inv),
      });
    }
  }
  for (const sup of docdata.cdnr || []) {
    for (const nt of sup.nt || []) {
      out.push({
        kind: str(nt.typ) === 'D' ? 'debit_note' : 'credit_note', ctin: str(sup.ctin).toUpperCase(), supplier: str(sup.trdnm),
        number: str(nt.ntnum), date: isoDate(nt.dt), value: round2(num(nt.val)), reverseCharge: str(nt.rev) === 'Y',
        itcAvailable: str(nt.itcavl || 'Y') !== 'N', reason: str(nt.rsn), ...amounts(nt),
      });
    }
  }
  return {
    gstin: str(root.gstin).toUpperCase(),
    period: str(root.rtnprd), // MMYYYY
    generated: str(root.gendt),
    docs: out,
  };
}

/** Tax of a purchase in the books, by head. */
function purchaseAmounts(p) {
  const items = p.items || [];
  const fromItems = (k) => items.reduce((s, l) => s + num(l[k]), 0);
  const total = num(p.totalAmount);
  const tax = num(p.totalGstAmount);
  let igst = num(p.totalIgst) || fromItems('igst');
  let cgst = num(p.totalCgst) || fromItems('cgst');
  let sgst = num(p.totalSgst) || fromItems('sgst');
  if (!igst && !cgst && !sgst && tax) {
    cgst = round2(tax / 2);
    sgst = round2(tax - cgst);
  }
  return { txval: round2(total - tax), igst: round2(igst), cgst: round2(cgst), sgst: round2(sgst), cess: 0, value: round2(total) };
}

/**
 * Match a parsed 2B against the books' purchases.
 * `period` is "YYYY-MM"; purchases dated in it that are not in 2B are "only in books".
 */
function match2b(parsed, purchases, opts = {}) {
  const tolerance = toPaise(opts.tolerance ?? 1);
  const period = opts.period || (parsed.period ? `${parsed.period.slice(2)}-${parsed.period.slice(0, 2)}` : '');
  const books = (purchases || []).filter((p) => str(p.supplierGstin)).map((p) => ({
    p,
    key: `${str(p.supplierGstin).toUpperCase()}|${normNumber(p.supplierInvoiceNumber)}`,
    date: isoDate(p.supplierInvoiceDate || p.createdAt),
    a: purchaseAmounts(p),
  }));
  const byKey = new Map();
  for (const b of books) byKey.set(b.key, [...(byKey.get(b.key) || []), b]);
  const used = new Set();
  const rows = [];
  const tax = (a) => toPaise(a.igst) + toPaise(a.cgst) + toPaise(a.sgst) + toPaise(a.cess);

  for (const d of parsed.docs) {
    if (d.kind !== 'invoice') {
      rows.push({ status: d.itcAvailable ? 'note' : 'not_claimable', doc: d, purchase: null, difference: null });
      continue;
    }
    const candidates = (byKey.get(`${d.ctin}|${normNumber(d.number)}`) || []).filter((b) => !used.has(b.p.id));
    const hit = candidates[0];
    if (!hit) {
      rows.push({ status: d.itcAvailable ? 'only_in_2b' : 'not_claimable', doc: d, purchase: null, difference: null });
      continue;
    }
    used.add(hit.p.id);
    const difference = {
      taxable: (toPaise(d.txval) - toPaise(hit.a.txval)) / 100,
      tax: (tax(d) - tax(hit.a)) / 100,
    };
    const agrees = Math.abs(toPaise(difference.taxable)) <= tolerance && Math.abs(toPaise(difference.tax)) <= tolerance;
    rows.push({
      status: !d.itcAvailable ? 'not_claimable' : agrees ? 'matched' : 'amount_differs',
      doc: d,
      purchase: { id: hit.p.id, number: str(hit.p.supplierInvoiceNumber), date: hit.date, ...hit.a },
      difference,
    });
  }

  for (const b of books) {
    if (used.has(b.p.id) || b.p.itcEligible === false) continue;
    if (period && !b.date.startsWith(period)) continue;
    rows.push({
      status: 'only_in_books', doc: null,
      purchase: { id: b.p.id, number: str(b.p.supplierInvoiceNumber), date: b.date, supplier: str(b.p.supplierName), ctin: str(b.p.supplierGstin).toUpperCase(), ...b.a },
      difference: null,
    });
  }

  const count = (s) => rows.filter((r) => r.status === s).length;
  const credit = (list) => round2(list.reduce((s, r) => s + tax(r.doc) / 100, 0));
  return {
    period,
    rows,
    summary: {
      matched: count('matched'),
      amountDiffers: count('amount_differs'),
      onlyIn2b: count('only_in_2b'),
      onlyInBooks: count('only_in_books'),
      notClaimable: count('not_claimable'),
      notes: count('note'),
      // GST you can claim for this month as the portal sees it (matched + amount-differs at 2B values).
      claimableAsPer2b: credit(rows.filter((r) => r.doc && r.doc.itcAvailable && r.doc.kind === 'invoice')),
      creditNotesIn2b: credit(rows.filter((r) => r.doc && r.doc.kind === 'credit_note')),
    },
  };
}

/** Per-head ITC totals of a 2B (for GSTR-9 Table 8A). */
function itcTotals(parsed) {
  const t = { igst: 0, cgst: 0, sgst: 0, cess: 0 };
  for (const d of parsed.docs) {
    if (!d.itcAvailable) continue;
    const sign = d.kind === 'credit_note' ? -1 : 1;
    for (const k of Object.keys(t)) t[k] = round2(t[k] + sign * d[k]);
  }
  return t;
}

module.exports = { parse2b, match2b, itcTotals, normNumber, isoDate };

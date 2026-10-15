/**
 * GSTR-9 (annual return) worksheet from the books, laid out by the portal's
 * table numbers so it can be checked against the auto-filled GSTR-9 and used
 * to fill it. Like Tally's GSTR-9 export, it is not filed from here: the owner
 * or CA files on the GST portal.
 *
 * What the books cannot know is left at zero and listed in `notes`: input
 * credit split into inputs / capital goods / services (all shown as inputs),
 * credit reversals (Table 7), late-fee and tax actually paid (Table 9 paid).
 */
const { round2, toPaise } = require('./money');
const { notesAsInvoices, isRegisteredGstin } = require('./ca-exports');

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v) => (v == null ? '' : String(v)).trim();
const zero = () => ({ txval: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 });

const HEADS = ['txval', 'igst', 'cgst', 'sgst', 'cess'];

/** Adds taxable value and tax heads of `a` into `into` (other fields are left alone). */
function add(into, a, sign = 1) {
  for (const k of HEADS) into[k] = round2(num(into[k]) + sign * num(a[k]));
  return into;
}

/** "2026-27" → { from: "2026-04-01", to: "2027-03-31" }. */
function fyBounds(fy) {
  const start = Number(String(fy).slice(0, 4));
  return { from: `${start}-04-01`, to: `${start + 1}-03-31` };
}

function lineTax(l) {
  return { txval: num(l.taxableAmount), igst: num(l.igst), cgst: num(l.cgst), sgst: num(l.sgst), cess: num(l.cess) };
}

function purchaseTax(p) {
  const tax = num(p.totalGstAmount);
  let igst = num(p.totalIgst);
  let cgst = num(p.totalCgst);
  let sgst = num(p.totalSgst);
  if (!igst && !cgst && !sgst && tax) {
    const items = p.items || [];
    igst = items.reduce((s, l) => s + num(l.igst), 0);
    cgst = items.reduce((s, l) => s + num(l.cgst), 0);
    sgst = items.reduce((s, l) => s + num(l.sgst), 0);
    if (!igst && !cgst && !sgst) {
      cgst = round2(tax / 2);
      sgst = round2(tax - cgst);
    }
  }
  return { txval: round2(num(p.totalAmount) - tax), igst: round2(igst), cgst: round2(cgst), sgst: round2(sgst), cess: 0 };
}

const isCredit = (d) => d.type === 'credit_note' || d.documentType === 'CRN';
const isDebit = (d) => d.type === 'debit_note' || d.documentType === 'DBN';

/**
 * @param data AppData (invoices, creditNotes, debitNotes, purchases)
 * @param fy "2026-27"
 * @param itc2b optional { "MMYYYY": { igst, cgst, sgst, cess } } from uploaded GSTR-2B files (Table 8A)
 */
function buildGstr9(data, fy, itc2b = {}) {
  const { from, to } = fyBounds(fy);
  const inYear = (d) => {
    const day = str(d).slice(0, 10);
    return day >= from && day <= to;
  };
  const docs = [...(data.invoices || []), ...notesAsInvoices(data)].filter(
    (d) => d.status !== 'draft' && d.status !== 'cancelled' && inYear(d.date),
  );

  const t4 = { A: zero(), B: zero(), G: zero(), I: zero(), J: zero() };
  const t5 = { C: zero(), D: zero(), H: zero(), I: zero() };
  const hsnOut = new Map();
  const hsnIn = new Map();

  for (const d of docs) {
    const b2b = isRegisteredGstin(d.partyGstin);
    const credit = isCredit(d);
    const debit = isDebit(d);
    const sign = credit ? -1 : 1;
    for (const l of d.items || []) {
      const amt = lineTax(l);
      const taxed = amt.igst + amt.cgst + amt.sgst > 0;
      // Bills of supply are exempt supplies; 0% lines on tax invoices are nil-rated.
      if (d.type === 'bill_of_supply' || !taxed) {
        if (credit) add(t5.H, amt);
        else if (debit) add(t5.I, amt);
        else add(d.type === 'bill_of_supply' ? t5.D : t5.C, amt);
      } else if (credit) add(t4.I, amt);
      else if (debit) add(t4.J, amt);
      else add(b2b ? t4.B : t4.A, amt);

      const hsn = str(l.hsn) || '0000';
      const uqc = str(l.uqc || l.unit || 'NOS').toUpperCase();
      const rt = num(l.gstRate);
      const key = `${hsn}|${uqc}|${rt}`;
      const row = hsnOut.get(key) || { hsn, uqc, rate: rt, qty: 0, ...zero() };
      row.qty = round2(row.qty + sign * num(l.quantity));
      add(row, amt, sign);
      hsnOut.set(key, row);
    }
  }

  const t6 = { B: zero(), C: zero(), D: zero() };
  const inwardRcm = zero();
  for (const p of data.purchases || []) {
    const date = str(p.supplierInvoiceDate || p.createdAt).slice(0, 10);
    if (!inYear(date)) continue;
    const amt = purchaseTax(p);
    if (p.reverseCharge) {
      // Tax on inward supplies under reverse charge is payable (4G) and, once paid, claimable (6C/6D).
      add(inwardRcm, amt);
      if (p.itcEligible !== false) add(isRegisteredGstin(p.supplierGstin) ? t6.D : t6.C, amt);
    } else if (p.itcEligible !== false && isRegisteredGstin(p.supplierGstin)) {
      add(t6.B, amt);
    }
    for (const l of p.items || []) {
      const hsn = str(l.hsn || l.hsnCode) || '0000';
      const uqc = str(l.uqc || l.unit || 'NOS').toUpperCase();
      const rt = num(l.gstRate);
      const key = `${hsn}|${uqc}|${rt}`;
      const row = hsnIn.get(key) || { hsn, uqc, rate: rt, qty: 0, ...zero() };
      row.qty = round2(row.qty + num(l.quantity));
      add(row, lineTax(l));
      hsnIn.set(key, row);
    }
  }
  add(t4.G, inwardRcm);

  const t4N = add(add(add(add(zero(), t4.A), t4.B), t4.G), t4.J);
  add(t4N, t4.I, -1);
  const t5N = add(add(add(zero(), t5.C), t5.D), t5.I);
  add(t5N, t5.H, -1);
  const turnover = round2(t4N.txval + t5N.txval);

  const t6O = add(add(add(zero(), t6.B), t6.C), t6.D);

  // Table 8A: credit as per GSTR-2B for the months of this year that were uploaded.
  const startYear = Number(String(fy).slice(0, 4));
  const months = [];
  for (let m = 0; m < 12; m++) {
    const month = ((3 + m) % 12) + 1;
    const year = month >= 4 ? startYear : startYear + 1;
    months.push(`${String(month).padStart(2, '0')}${year}`);
  }
  const uploaded = months.filter((m) => itc2b[m]);
  const t8A = zero();
  for (const m of uploaded) add(t8A, itc2b[m]);
  // Table 8 compares credit only, so the taxable value is left out.
  const t8B = { ...add(zero(), t6.B), txval: 0 };
  const t8D = add(add(zero(), t8A), t8B, -1);

  // Table 9: tax payable by head (what was paid in cash or by credit is on the portal).
  const payable = { igst: t4N.igst, cgst: t4N.cgst, sgst: t4N.sgst, cess: t4N.cess };

  const sortHsn = (m) => [...m.values()].sort((a, b) => a.hsn.localeCompare(b.hsn) || a.rate - b.rate);
  return {
    fy,
    period: { from, to },
    table4: { ...t4, N: t4N },
    table5: { ...t5, N: t5N, turnover },
    table6: { ...t6, O: t6O },
    table8: { A: t8A, B: t8B, D: t8D, monthsWith2b: uploaded.length },
    table9: { payable },
    table17: sortHsn(hsnOut),
    table18: sortHsn(hsnIn),
    notes: [
      'Input credit is shown under inputs; split capital goods and input services in Table 6B if you have them.',
      'Credit reversals (Table 7) and tax paid in cash or by credit (Table 9) come from your GSTR-3B filings on the portal.',
      uploaded.length < 12
        ? `Table 8A uses GSTR-2B files for ${uploaded.length} of 12 months. Upload the rest for a full comparison.`
        : 'Table 8A uses your GSTR-2B files for all 12 months.',
    ],
  };
}

/** Rows for a CSV/Excel download: table, description, then amounts. */
function gstr9Rows(r) {
  const row = (table, label, a) => [table, label, a.txval, a.igst, a.cgst, a.sgst, a.cess];
  return [
    ['Table', 'Description', 'Taxable value', 'IGST', 'CGST', 'SGST/UTGST', 'Cess'],
    row('4A', 'Supplies to unregistered persons (B2C)', r.table4.A),
    row('4B', 'Supplies to registered persons (B2B)', r.table4.B),
    row('4G', 'Inward supplies on which tax is paid on reverse charge', r.table4.G),
    row('4I', 'Credit notes issued (reduce)', r.table4.I),
    row('4J', 'Debit notes issued', r.table4.J),
    row('4N', 'Supplies on which tax is payable (total)', r.table4.N),
    row('5C', 'Nil-rated supplies', r.table5.C),
    row('5D', 'Exempted supplies (bills of supply)', r.table5.D),
    row('5H', 'Credit notes on these (reduce)', r.table5.H),
    row('5I', 'Debit notes on these', r.table5.I),
    row('5N', 'Supplies on which tax is not payable (total)', r.table5.N),
    ['5N', 'Total turnover (4N + 5N)', r.table5.turnover, '', '', '', ''],
    row('6B', 'Input credit on inward supplies (inputs)', r.table6.B),
    row('6C', 'Input credit, reverse charge, unregistered suppliers', r.table6.C),
    row('6D', 'Input credit, reverse charge, registered suppliers', r.table6.D),
    row('6O', 'Total input credit availed', r.table6.O),
    ['8A', `Input credit as per GSTR-2B (${r.table8.monthsWith2b} of 12 months uploaded)`, '', r.table8.A.igst, r.table8.A.cgst, r.table8.A.sgst, r.table8.A.cess],
    ['8B', 'Input credit availed (6B)', '', r.table8.B.igst, r.table8.B.cgst, r.table8.B.sgst, r.table8.B.cess],
    ['8D', 'Difference (8A − 8B)', '', r.table8.D.igst, r.table8.D.cgst, r.table8.D.sgst, r.table8.D.cess],
    ['9', 'Tax payable', '', r.table9.payable.igst, r.table9.payable.cgst, r.table9.payable.sgst, r.table9.payable.cess],
    [],
    ['Table 17', 'HSN', 'UQC', 'Quantity', 'Rate %', 'Taxable value', 'IGST', 'CGST', 'SGST', 'Cess'],
    ...r.table17.map((h) => ['17', h.hsn, h.uqc, h.qty, h.rate, h.txval, h.igst, h.cgst, h.sgst, h.cess]),
    [],
    ['Table 18', 'HSN', 'UQC', 'Quantity', 'Rate %', 'Taxable value', 'IGST', 'CGST', 'SGST', 'Cess'],
    ...r.table18.map((h) => ['18', h.hsn, h.uqc, h.qty, h.rate, h.txval, h.igst, h.cgst, h.sgst, h.cess]),
  ];
}

/** Exempt, nil-rated and non-GST supplies for a period (GSTR-1 Table 8 / GSTR-3B 3.1(c)). */
function exemptReport(data, from, to) {
  const docs = [...(data.invoices || []), ...notesAsInvoices(data)].filter((d) => {
    const day = str(d.date).slice(0, 10);
    return d.status !== 'draft' && d.status !== 'cancelled' && day >= from && day <= to;
  });
  const rows = new Map();
  const lines = [];
  for (const d of docs) {
    const b2b = isRegisteredGstin(d.partyGstin);
    const sign = isCredit(d) ? -1 : 1;
    const inter = !!d.isInterState;
    for (const l of d.items || []) {
      const taxed = num(l.igst) + num(l.cgst) + num(l.sgst) > 0;
      if (taxed && d.type !== 'bill_of_supply') continue;
      const kind = d.type === 'bill_of_supply' ? 'exempt' : 'nil';
      const supply = `${inter ? 'Inter-state' : 'Within state'} to ${b2b ? 'registered' : 'unregistered'}`;
      const key = `${supply}|${kind}`;
      const r = rows.get(key) || { supply, kind, value: 0 };
      r.value = round2(r.value + sign * num(l.taxableAmount || l.total));
      rows.set(key, r);
      lines.push({ number: d.invoiceNumber, date: str(d.date).slice(0, 10), party: d.partyName, item: l.description, hsn: l.hsn, kind, value: round2(sign * num(l.taxableAmount || l.total)) });
    }
  }
  const total = round2([...rows.values()].reduce((s, r) => s + toPaise(r.value) / 100, 0));
  return { from, to, rows: [...rows.values()], lines, total };
}

module.exports = { buildGstr9, gstr9Rows, exemptReport, fyBounds };

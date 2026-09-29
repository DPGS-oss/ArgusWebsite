/**
 * CA handoff files — GSTN GSTR-1 offline-tool JSON and TallyPrime XML.
 * Built from stored invoice document fields (taxable, cgst/sgst/igst). Does not
 * recalculate tax, file returns, mint IRNs, or call gst.gov.in.
 *
 * GSTR-1 JSON keys follow the GSTN Returns Offline Tool / public schema:
 * gstin, fp, b2b[].ctin/inv[].inum,idt,val,pos,rchrg,inv_typ,itms[].itm_det
 * {rt,txval,iamt,camt,samt,csamt}, b2cl, b2cs {sply_ty,pos,typ,rt,txval,...},
 * cdnr[].ctin/nt[].ntty,nt_num,nt_dt, hsn.data[], doc_issue.doc_det[].docs[].
 *
 * TallyPrime XML: ENVELOPE / TALLYMESSAGE / LEDGER + Sales and Credit Note vouchers.
 * Download only — no HTTP push to Tally localhost:9000.
 */

const B2CL_THRESHOLD = 250000;
const GSTN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const GSTIN_FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const INDIAN_STATES = [
  { name: 'Andhra Pradesh', code: '37' },
  { name: 'Arunachal Pradesh', code: '12' },
  { name: 'Assam', code: '18' },
  { name: 'Bihar', code: '10' },
  { name: 'Chhattisgarh', code: '22' },
  { name: 'Goa', code: '30' },
  { name: 'Gujarat', code: '24' },
  { name: 'Haryana', code: '06' },
  { name: 'Himachal Pradesh', code: '02' },
  { name: 'Jharkhand', code: '20' },
  { name: 'Karnataka', code: '29' },
  { name: 'Kerala', code: '32' },
  { name: 'Madhya Pradesh', code: '23' },
  { name: 'Maharashtra', code: '27' },
  { name: 'Manipur', code: '14' },
  { name: 'Meghalaya', code: '17' },
  { name: 'Mizoram', code: '15' },
  { name: 'Nagaland', code: '13' },
  { name: 'Odisha', code: '21' },
  { name: 'Punjab', code: '03' },
  { name: 'Rajasthan', code: '08' },
  { name: 'Sikkim', code: '11' },
  { name: 'Tamil Nadu', code: '33' },
  { name: 'Telangana', code: '36' },
  { name: 'Tripura', code: '16' },
  { name: 'Uttar Pradesh', code: '09' },
  { name: 'Uttarakhand', code: '05' },
  { name: 'West Bengal', code: '19' },
  { name: 'Andaman and Nicobar Islands', code: '35' },
  { name: 'Chandigarh', code: '04' },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', code: '26' },
  { name: 'Delhi', code: '07' },
  { name: 'Jammu and Kashmir', code: '01' },
  { name: 'Ladakh', code: '38' },
  { name: 'Lakshadweep', code: '31' },
  { name: 'Puducherry', code: '34' },
];

const STATE_ALIASES = {
  mh: '27', maha: '27', maharastra: '27',
  ka: '29', kar: '29', kn: '29',
  dl: '07', nctofdelhi: '07', nctdelhi: '07', newdelhi: '07', ncr: '07',
  or: '21', orissa: '21', od: '21',
  py: '34', pondicherry: '34', pondichery: '34',
  jk: '01', uk: '05', ua: '05', uttaranchal: '05',
  cg: '22', chattisgarh: '22',
  tn: '33', tamilnadu: '33',
  ts: '36', telengana: '36',
  up: '09', wb: '19', bengal: '19',
  hp: '02', mp: '23', ap: '37',
  gj: '24', guj: '24', rj: '08', raj: '08',
  pb: '03', hr: '06', br: '10', as: '18',
  kl: '32', ker: '32', ga: '30', ch: '04',
  an: '35', andaman: '35',
  dn: '26', dd: '26', dnh: '26', daman: '26', damananddiu: '26',
  dadranagarhaveli: '26', dadraandnagarhaveli: '26',
  ld: '31', la: '38',
};

function gstinCheckDigit(first14) {
  const input = String(first14 || '').trim().toUpperCase();
  let factor = 2;
  let sum = 0;
  const mod = GSTN_CHARS.length;
  for (let i = input.length - 1; i >= 0; i -= 1) {
    const codePoint = GSTN_CHARS.indexOf(input[i]);
    if (codePoint < 0) return '';
    let digit = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    digit = Math.floor(digit / mod) + (digit % mod);
    sum += digit;
  }
  const checkCodePoint = (mod - (sum % mod)) % mod;
  return GSTN_CHARS[checkCodePoint];
}

function normalizeGstin(value) {
  const trimmed = String(value || '').trim().toUpperCase();
  if (!trimmed) return 'URP';
  return trimmed;
}

function isRegisteredGstin(value) {
  const trimmed = String(value || '').trim().toUpperCase();
  if (!trimmed || trimmed === 'URP') return false;
  if (!GSTIN_FORMAT.test(trimmed)) return false;
  return trimmed[14] === gstinCheckDigit(trimmed.slice(0, 14));
}

function normalizeStateKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '');
}

let stateLookupCache = null;
function stateLookup() {
  if (stateLookupCache) return stateLookupCache;
  const map = new Map();
  for (const state of INDIAN_STATES) {
    map.set(normalizeStateKey(state.name), state.code);
    map.set(state.code, state.code);
  }
  for (const [alias, code] of Object.entries(STATE_ALIASES)) {
    if (!map.has(alias)) map.set(alias, code);
  }
  stateLookupCache = map;
  return map;
}

function stateCodeFromPlaceOfSupply(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^\d{2}$/.test(raw)) return raw;
  return stateLookup().get(normalizeStateKey(raw)) || null;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function currentMonthYm(now) {
  const d = now instanceof Date ? now : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function parseMonthParam(value, now) {
  const raw = String(value || '').trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return raw;
  return currentMonthYm(now);
}

function monthBounds(month, now) {
  const ym = parseMonthParam(month, now);
  const [yearStr, monthStr] = ym.split('-');
  const year = Number(yearStr);
  const m = Number(monthStr);
  const from = `${yearStr}-${monthStr}-01`;
  const last = new Date(year, m, 0).getDate();
  const to = `${yearStr}-${monthStr}-${String(last).padStart(2, '0')}`;
  const fp = `${monthStr}${yearStr}`;
  return { from, to, fp, month: ym };
}

function inMonth(inv, from, to) {
  const d = String(inv.date || '').slice(0, 10);
  return d >= from && d <= to;
}

function isOpen(inv) {
  return inv.status !== 'draft' && inv.status !== 'cancelled';
}

function isCreditNote(inv) {
  return inv.type === 'credit_note' || inv.documentType === 'CRN';
}

function isDebitNote(inv) {
  return inv.type === 'debit_note';
}

function posOf(inv) {
  const mapped = stateCodeFromPlaceOfSupply(inv.placeOfSupply);
  if (mapped) return mapped;
  const raw = String(inv.placeOfSupply || '').trim();
  if (/^\d{2}$/.test(raw)) return raw;
  const fromGstin = String(inv.shipToGstin || inv.partyGstin || inv.sellerGstin || '')
    .replace(/^URP/i, '')
    .slice(0, 2);
  return /^\d{2}$/.test(fromGstin) ? fromGstin : '';
}

function gstDate(iso) {
  const d = String(iso || '').slice(0, 10);
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return d;
  return `${day}-${m}-${y}`;
}

function rchrg(inv) {
  return inv.reverseCharge ? 'Y' : 'N';
}

function itemRows(inv) {
  const byRate = new Map();
  for (const item of inv.items || []) {
    const rt = Number(item.gstRate) || 0;
    const cur = byRate.get(rt) || { rt, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
    cur.txval = round2(cur.txval + (item.taxableAmount || 0));
    cur.iamt = round2(cur.iamt + (item.igst || 0));
    cur.camt = round2(cur.camt + (item.cgst || 0));
    cur.samt = round2(cur.samt + (item.sgst || 0));
    cur.csamt = round2(cur.csamt + (item.cess || 0));
    byRate.set(rt, cur);
  }
  return [...byRate.values()];
}

function toItms(dets) {
  return dets.map((itm_det, i) => ({ num: i + 1, itm_det }));
}

function toInv(inv) {
  return {
    inum: inv.invoiceNumber,
    idt: gstDate(inv.date),
    val: round2(inv.grandTotal || 0),
    pos: posOf(inv),
    rchrg: rchrg(inv),
    inv_typ: 'R',
    itms: toItms(itemRows(inv)),
  };
}

function isInter(inv) {
  if (typeof inv.isInterState === 'boolean') return inv.isInterState;
  return (inv.totalIgst || 0) > 0;
}

/**
 * GSTR-1 Table 5 (B2CL) cut-off for inter-state B2C invoices. Notification
 * 12/2024-CT lowered it from ₹2.5 lakh to ₹1 lakh for supplies from 1 Aug 2024.
 */
function b2clThreshold(date) {
  return String(date || '').slice(0, 10) >= '2024-08-01' ? 100000 : B2CL_THRESHOLD;
}

function isLargeB2c(inv) {
  return isInter(inv) && round2(inv.grandTotal || 0) > b2clThreshold(inv.date);
}

/**
 * GSTN offline-tool GSTR-1 JSON for one month (or an explicit from/to range).
 *
 * - B2B / B2CL invoices carry rate-wise items; B2CS is aggregated per
 *   supply type + place of supply + rate.
 * - Credit/debit notes: registered buyers go to CDNR; unregistered large
 *   inter-state notes go to CDNUR; small unregistered notes are netted into
 *   B2CS (credit negative, debit positive), as the portal expects.
 * - Table 12 HSN is split into hsn_b2b / hsn_b2c and is net of notes.
 * - Table 13 counts cancelled documents in the issued series.
 */
function buildGstr1Json(input) {
  const bounds = monthBounds(input.month);
  const from = input.from || bounds.from;
  const to = input.to || bounds.to;
  const fp = input.fp || bounds.fp;
  const inPeriod = (input.invoices || []).filter((inv) => inv.status !== 'draft' && inMonth(inv, from, to));
  const invoices = inPeriod.filter(isOpen);

  const b2bMap = new Map();
  const b2clMap = new Map();
  const b2csMap = new Map();
  const cdnrMap = new Map();
  const cdnur = [];
  const hsnB2b = new Map();
  const hsnB2c = new Map();

  function addB2cs(inv, sign) {
    const pos = posOf(inv);
    const sply_ty = isInter(inv) ? 'INTER' : 'INTRA';
    for (const det of itemRows(inv)) {
      const key = `${sply_ty}|${pos}|${det.rt}`;
      const cur = b2csMap.get(key) || {
        sply_ty, pos, typ: 'OE', rt: det.rt, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0,
      };
      cur.txval = round2(cur.txval + sign * det.txval);
      cur.iamt = round2(cur.iamt + sign * det.iamt);
      cur.camt = round2(cur.camt + sign * det.camt);
      cur.samt = round2(cur.samt + sign * det.samt);
      cur.csamt = round2(cur.csamt + sign * det.csamt);
      b2csMap.set(key, cur);
    }
  }

  function addHsn(map, inv, sign) {
    for (const item of inv.items || []) {
      const hsn_sc = String(item.hsn || '').trim() || '0000';
      const uqc = String(item.uqc || item.unit || 'NOS').trim().toUpperCase() || 'NOS';
      const rt = Number(item.gstRate) || 0;
      const key = `${hsn_sc}|${rt}|${uqc}`;
      const cur = map.get(key) || {
        num: 0, hsn_sc, desc: item.description || '', uqc, qty: 0, rt,
        txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0,
      };
      cur.qty = round2(cur.qty + sign * (item.quantity || 0));
      cur.txval = round2(cur.txval + sign * (item.taxableAmount || 0));
      cur.iamt = round2(cur.iamt + sign * (item.igst || 0));
      cur.camt = round2(cur.camt + sign * (item.cgst || 0));
      cur.samt = round2(cur.samt + sign * (item.sgst || 0));
      cur.csamt = round2(cur.csamt + sign * (item.cess || 0));
      map.set(key, cur);
    }
  }

  for (const inv of invoices) {
    const registered = isRegisteredGstin(inv.partyGstin);
    const credit = isCreditNote(inv);
    const note = credit || isDebitNote(inv);
    const sign = credit ? -1 : 1;

    addHsn(registered ? hsnB2b : hsnB2c, inv, sign);

    if (note) {
      const noteRow = {
        ntty: credit ? 'C' : 'D',
        nt_num: inv.invoiceNumber,
        nt_dt: gstDate(inv.date),
        val: round2(inv.grandTotal || 0),
        pos: posOf(inv),
        rchrg: rchrg(inv),
        itms: toItms(itemRows(inv)),
      };
      if (registered) {
        const ctin = normalizeGstin(inv.partyGstin);
        const list = cdnrMap.get(ctin) || [];
        list.push({ ...noteRow, inv_typ: 'R' });
        cdnrMap.set(ctin, list);
      } else if (isLargeB2c(inv)) {
        cdnur.push({ ...noteRow, typ: 'B2CL' });
      } else {
        addB2cs(inv, sign);
      }
      continue;
    }

    if (registered) {
      const ctin = normalizeGstin(inv.partyGstin);
      const list = b2bMap.get(ctin) || [];
      list.push(toInv(inv));
      b2bMap.set(ctin, list);
    } else if (isLargeB2c(inv)) {
      const pos = posOf(inv);
      const list = b2clMap.get(pos) || [];
      const { pos: _pos, rchrg: _rchrg, inv_typ: _typ, ...b2clInv } = toInv(inv);
      list.push(b2clInv);
      b2clMap.set(pos, list);
    } else {
      addB2cs(inv, 1);
    }
  }

  const numbered = (map) => [...map.values()].map((row, i) => ({ ...row, num: i + 1 }));

  function docBlock(doc_num, doc_typ, rows) {
    const numbers = rows.map((r) => r.invoiceNumber).filter(Boolean).sort();
    const cancel = rows.filter((r) => r.status === 'cancelled').length;
    return {
      doc_num,
      doc_typ,
      docs: [
        {
          num: 1,
          from: numbers[0] || '',
          to: numbers[numbers.length - 1] || '',
          totnum: numbers.length,
          cancel,
          net_issue: numbers.length - cancel,
        },
      ],
    };
  }

  const docs = { inv: [], cn: [], dn: [] };
  for (const inv of inPeriod) {
    if (isCreditNote(inv)) docs.cn.push(inv);
    else if (isDebitNote(inv)) docs.dn.push(inv);
    else docs.inv.push(inv);
  }
  const doc_det = [];
  if (docs.inv.length) doc_det.push(docBlock(1, 'Invoices for outward supply', docs.inv));
  if (docs.dn.length) doc_det.push(docBlock(4, 'Debit Note', docs.dn));
  if (docs.cn.length) doc_det.push(docBlock(5, 'Credit Note', docs.cn));

  return {
    gstin: String(input.gstin || '').trim().toUpperCase(),
    fp,
    gt: 0,
    cur_gt: 0,
    b2b: [...b2bMap.entries()].map(([ctin, inv]) => ({ ctin, inv })),
    b2cl: [...b2clMap.entries()].map(([pos, inv]) => ({ pos, inv })),
    b2cs: [...b2csMap.values()].filter((r) => r.txval !== 0 || r.iamt !== 0 || r.camt !== 0 || r.samt !== 0),
    cdnr: [...cdnrMap.entries()].map(([ctin, nt]) => ({ ctin, nt })),
    cdnur,
    hsn: { hsn_b2b: numbered(hsnB2b), hsn_b2c: numbered(hsnB2c) },
    doc_issue: { doc_det },
  };
}

/**
 * Credit / debit notes from the Notes screens as GST documents, so GSTR-1/3B,
 * the GST check, and the CA portal all count them. A note inherits the buyer
 * GSTIN, place of supply, and intra/inter-state split of the invoice it amends.
 */
function notesAsInvoices(data) {
  const invoices = (data && data.invoices) || [];
  const byId = new Map(invoices.map((i) => [i.id, i]));
  function build(kind, id, number, invoiceId, customerName, createdAt, status, items, taxable, gst) {
    const base = (invoiceId && byId.get(invoiceId)) || null;
    const inter = !!(base && base.isInterState);
    let lines = Array.isArray(items) && items.length ? items : [];
    if (!lines.length) {
      const rate = taxable > 0 ? round2((gst / taxable) * 100) : 0;
      const half = round2(gst / 2);
      lines = [{
        id: `${id}-line`, description: 'Adjustment',
        hsn: (base && base.items && base.items[0] && base.items[0].hsn) || '',
        quantity: 1, unit: 'NOS', uqc: 'NOS', rate: taxable, discount: 0, gstRate: rate,
        taxableAmount: round2(taxable), cgst: inter ? 0 : half, sgst: inter ? 0 : round2(gst - half),
        igst: inter ? round2(gst) : 0, cess: 0, total: round2(taxable + gst),
      }];
    }
    const sum = (k) => round2(lines.reduce((t, l) => t + (Number(l[k]) || 0), 0));
    return {
      ...(base || {}),
      id: `${kind}:${id}`,
      invoiceNumber: number,
      type: kind,
      documentType: kind === 'credit_note' ? 'CRN' : 'DBN',
      status: status === 'cancelled' ? 'cancelled' : 'unpaid',
      partyName: customerName || (base && base.partyName) || '',
      partyGstin: (base && base.partyGstin) || '',
      placeOfSupply: (base && base.placeOfSupply) || '',
      isInterState: inter,
      date: String(createdAt || '').slice(0, 10),
      items: lines,
      subtotal: sum('taxableAmount'),
      totalDiscount: 0,
      totalTaxable: sum('taxableAmount'),
      totalCgst: sum('cgst'),
      totalSgst: sum('sgst'),
      totalIgst: sum('igst'),
      totalTax: round2(sum('cgst') + sum('sgst') + sum('igst')),
      grandTotal: sum('total'),
      reverseCharge: !!(base && base.reverseCharge),
    };
  }
  return [
    ...((data && data.creditNotes) || []).map((n) =>
      build('credit_note', n.id, n.creditNoteNumber, n.invoiceId, n.customerName, n.createdAt, n.status, n.items,
        round2((n.totalAmount || 0) - (n.totalGstAmount || 0)), n.totalGstAmount || 0)),
    ...((data && data.debitNotes) || []).map((n) =>
      build('debit_note', n.id, n.debitNoteNumber, n.invoiceId, n.customerName, n.createdAt, n.status, null,
        n.subtotal || round2((n.totalAmount || 0) - (n.totalGstAmount || 0)), n.totalGstAmount || 0)),
  ];
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tallyDate(iso) {
  return String(iso || '').slice(0, 10).replace(/-/g, '');
}

function amt(n) {
  return round2(n).toFixed(2);
}

function ledgerMessage(name, parent) {
  return `    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <LEDGER NAME="${xmlEscape(name)}" ACTION="Create">
      <NAME>${xmlEscape(name)}</NAME>
      <PARENT>${xmlEscape(parent)}</PARENT>
     </LEDGER>
    </TALLYMESSAGE>`;
}

function entry(name, amount, debit) {
  const signed = debit ? -Math.abs(amount) : Math.abs(amount);
  return `      <ALLLEDGERENTRIES.LIST>
       <LEDGERNAME>${xmlEscape(name)}</LEDGERNAME>
       <ISDEEMEDPOSITIVE>${debit ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
       <AMOUNT>${amt(signed)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;
}

function voucherXml(inv, vchType) {
  const party = inv.partyName || (normalizeGstin(inv.partyGstin) === 'URP' ? 'Walk-in' : 'Customer');
  const taxable = round2(inv.totalTaxable || 0);
  const cgst = round2(inv.totalCgst || 0);
  const sgst = round2(inv.totalSgst || 0);
  const igst = round2(inv.totalIgst || 0);
  const total = round2(inv.grandTotal || 0);
  const isCn = vchType === 'Credit Note';
  const lines = [
    entry(party, total, !isCn),
    entry('Sales', taxable, isCn),
  ];
  if (igst) lines.push(entry('IGST', igst, isCn));
  if (cgst) lines.push(entry('CGST', cgst, isCn));
  if (sgst) lines.push(entry('SGST', sgst, isCn));
  return `    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <VOUCHER VCHTYPE="${vchType}" ACTION="Create">
      <DATE>${tallyDate(inv.date)}</DATE>
      <VOUCHERTYPENAME>${vchType}</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${xmlEscape(inv.invoiceNumber)}</VOUCHERNUMBER>
      <PARTYLEDGERNAME>${xmlEscape(party)}</PARTYLEDGERNAME>
      <NARRATION>${xmlEscape(`${vchType} ${inv.invoiceNumber}`)}</NARRATION>
${lines.join('\n')}
     </VOUCHER>
    </TALLYMESSAGE>`;
}

function buildTallyXml(input) {
  const { from, to } = monthBounds(input.month);
  const invoices = (input.invoices || []).filter((inv) => isOpen(inv) && inMonth(inv, from, to));
  const parties = new Set();
  for (const inv of invoices) {
    parties.add(inv.partyName || (normalizeGstin(inv.partyGstin) === 'URP' ? 'Walk-in' : 'Customer'));
  }
  const ledgers = [
    ledgerMessage('Sales', 'Sales Accounts'),
    ledgerMessage('CGST', 'Duties & Taxes'),
    ledgerMessage('SGST', 'Duties & Taxes'),
    ledgerMessage('IGST', 'Duties & Taxes'),
    ...[...parties].map((p) => ledgerMessage(p, 'Sundry Debtors')),
  ];
  const vouchers = invoices.map((inv) =>
    voucherXml(inv, isCreditNote(inv) ? 'Credit Note' : 'Sales')
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Import Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>All Masters</REPORTNAME>
    <STATICVARIABLES>
     <SVCURRENTCOMPANY>${xmlEscape(input.companyName || 'Argus')}</SVCURRENTCOMPANY>
    </STATICVARIABLES>
   </REQUESTDESC>
   <REQUESTDATA>
${ledgers.join('\n')}
${vouchers.join('\n')}
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>
`;
}

function sellerGstinFromAppData(appData) {
  const data = appData || {};
  const businesses = data.businesses || [];
  const active = businesses.find((b) => b.id === data.activeBusinessId) || businesses[0];
  if (active && active.gstin) return String(active.gstin).trim().toUpperCase();
  const fromInv = (data.invoices || []).find((i) => i.sellerGstin);
  return String((fromInv && fromInv.sellerGstin) || '').trim().toUpperCase();
}

function companyNameFromAppData(appData) {
  const data = appData || {};
  const businesses = data.businesses || [];
  const active = businesses.find((b) => b.id === data.activeBusinessId) || businesses[0];
  return (active && active.name) || 'Argus';
}

module.exports = {
  B2CL_THRESHOLD,
  b2clThreshold,
  buildGstr1Json,
  notesAsInvoices,
  buildTallyXml,
  sellerGstinFromAppData,
  companyNameFromAppData,
  currentMonthYm,
  parseMonthParam,
  monthBounds,
  isRegisteredGstin,
  posOf,
};

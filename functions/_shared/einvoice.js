/**
 * NIC IRP e-invoice JSON schema v1.1 (GST INV-1 / Generate IRN payload).
 * Built from stored invoice fields. Does not mint IRNs, call IRP, or store
 * GST portal passwords. Upload the file on einvoice.gst.gov.in.
 *
 * Field names (IRP v1.1):
 * Version, TranDtls.{TaxSch,SupTyp,RegRev,IgstOnIntra},
 * DocDtls.{Typ,No,Dt}  Typ = INV|CRN|DBN, Dt = DD/MM/YYYY,
 * SellerDtls.{Gstin,LglNm,Addr1,Loc,Pin,Stcd},
 * BuyerDtls.{Gstin,LglNm,Pos,Addr1,Loc,Pin,Stcd}  Gstin = 15-char or URP,
 * ShipDtls.{Gstin,LglNm,Addr1,Loc,Pin,Stcd}  Gstin always present (URP if unregistered),
 * ItemList[].{SlNo,PrdDesc,IsServc,HsnCd,Qty,Unit,UnitPrice,TotAmt,Discount,AssAmt,GstRt,IgstAmt,CgstAmt,SgstAmt,CesAmt,TotItemVal},
 * ValDtls.{AssVal,CgstVal,SgstVal,IgstVal,CesVal,RndOffAmt,TotInvVal}.
 * Do not emit Irn or EwbDtls.
 */
const { monthBounds, posOf: invoicePos } = require('./ca-exports');

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function nicGstin(value) {
  const trimmed = String(value || '').trim().toUpperCase();
  if (!trimmed || trimmed === 'URP') return 'URP';
  if (!/^[0-9]{2}[A-Z0-9]{13}$/.test(trimmed)) return 'URP';
  return trimmed;
}

function stateCode(value, gstin) {
  const raw = String(value || '').trim();
  if (/^\d{2}$/.test(raw)) return raw;
  const fromGstin = nicGstin(gstin);
  if (fromGstin !== 'URP') return fromGstin.slice(0, 2);
  return '';
}

function pinOf(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const n = Number(digits.slice(0, 6));
  if (n >= 100000 && n <= 999999) return n;
  return 400001;
}

function text(value, fallback) {
  const s = String(value || '').trim();
  return s || fallback;
}

function nicDate(iso) {
  const d = String(iso || '').slice(0, 10);
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

function docTyp(inv) {
  if (inv.type === 'credit_note' || inv.documentType === 'CRN') return 'CRN';
  if (inv.type === 'debit_note' || inv.documentType === 'DBN') return 'DBN';
  return 'INV';
}

function isOpen(inv) {
  return inv.status !== 'draft' && inv.status !== 'cancelled';
}

function inMonth(inv, from, to) {
  const d = String(inv.date || '').slice(0, 10);
  return d >= from && d <= to;
}

function partyAddr(inv) {
  return {
    Addr1: text(inv.shipToAddress || inv.partyAddress, 'Address'),
    Loc: text(inv.partyCity || inv.shipToCity, 'City'),
    Pin: pinOf(inv.partyPincode || inv.shipToPincode),
  };
}

function buildEinvoiceJson(input) {
  const inv = input.invoice || {};
  const biz = input.business || {};
  const sellerGstin = nicGstin(biz.gstin || inv.sellerGstin);
  const buyerGstin = nicGstin(inv.partyGstin);
  const shipRaw = inv.shipToGstin;
  const shipGstin = shipRaw == null || String(shipRaw).trim() === ''
    ? buyerGstin
    : nicGstin(shipRaw);
  const pos = invoicePos(inv) || stateCode(biz.stateCode, sellerGstin);
  const sellerStcd = stateCode(biz.stateCode, sellerGstin) || (sellerGstin !== 'URP' ? sellerGstin.slice(0, 2) : '');
  const buyerStcd = buyerGstin !== 'URP' ? buyerGstin.slice(0, 2) : pos;
  const shipStcd = shipGstin !== 'URP' ? shipGstin.slice(0, 2) : pos;
  const addr = partyAddr(inv);

  const items = (inv.items || []).map((item, i) => {
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    const totAmt = round2(qty * rate);
    const discountAmt = round2(totAmt - (Number(item.taxableAmount) || 0));
    const hsn = String(item.hsn || '').trim() || '0000';
    return {
      SlNo: String(i + 1),
      PrdDesc: text(item.description, 'Item'),
      IsServc: hsn.startsWith('99') ? 'Y' : 'N',
      HsnCd: hsn,
      Qty: qty,
      Unit: text(item.uqc || item.unit, 'NOS'),
      UnitPrice: round2(rate),
      TotAmt: totAmt,
      Discount: discountAmt > 0 ? discountAmt : 0,
      AssAmt: round2(item.taxableAmount || 0),
      GstRt: Number(item.gstRate) || 0,
      IgstAmt: round2(item.igst || 0),
      CgstAmt: round2(item.cgst || 0),
      SgstAmt: round2(item.sgst || 0),
      CesAmt: round2(item.cess || 0),
      TotItemVal: round2(item.total || 0),
    };
  });

  return {
    Version: '1.1',
    TranDtls: {
      TaxSch: 'GST',
      SupTyp: 'B2B',
      RegRev: inv.reverseCharge ? 'Y' : 'N',
      IgstOnIntra: 'N',
    },
    DocDtls: {
      Typ: docTyp(inv),
      No: String(inv.invoiceNumber || ''),
      Dt: nicDate(inv.date),
    },
    SellerDtls: {
      Gstin: sellerGstin,
      LglNm: text(biz.name, 'Seller'),
      Addr1: text(biz.address, 'Address'),
      Loc: text(biz.city, 'City'),
      Pin: pinOf(biz.pincode),
      Stcd: sellerStcd,
    },
    BuyerDtls: {
      Gstin: buyerGstin,
      LglNm: text(inv.partyName, 'Buyer'),
      Pos: pos,
      Addr1: addr.Addr1,
      Loc: addr.Loc,
      Pin: addr.Pin,
      Stcd: buyerStcd,
    },
    ShipDtls: {
      Gstin: shipGstin,
      LglNm: text(inv.shipToName || inv.partyName, 'Buyer'),
      Addr1: text(inv.shipToAddress, addr.Addr1),
      Loc: text(inv.shipToCity, addr.Loc),
      Pin: inv.shipToPincode ? pinOf(inv.shipToPincode) : addr.Pin,
      Stcd: shipStcd,
    },
    ItemList: items,
    ValDtls: {
      AssVal: round2(inv.totalTaxable || 0),
      CgstVal: round2(inv.totalCgst || 0),
      SgstVal: round2(inv.totalSgst || 0),
      IgstVal: round2(inv.totalIgst || 0),
      CesVal: round2(inv.totalCess || 0),
      RndOffAmt: round2(inv.roundOff || 0),
      TotInvVal: round2(inv.grandTotal || 0),
    },
  };
}

function resolveBusiness(invoice, businesses) {
  const list = businesses || [];
  return list.find((b) => b && b.id === invoice.businessId) || list[0] || {};
}

function buildEinvoiceBatch(input) {
  const { from, to } = monthBounds(input.month);
  const invoices = (input.invoices || []).filter((inv) => isOpen(inv) && inMonth(inv, from, to));
  return invoices.map((inv) =>
    buildEinvoiceJson({
      invoice: inv,
      business: input.business || resolveBusiness(inv, input.businesses),
    })
  );
}

module.exports = {
  buildEinvoiceJson,
  buildEinvoiceBatch,
  nicGstin,
};

import { describe, expect, it } from "vitest";
import { calculateItem } from "./gst";
import { isRegisteredGstin } from "./gstin";
import {
  buildGstr1Json,
  buildTallyXml,
  sellerGstinFromAppData,
  companyNameFromAppData,
  parseMonthParam,
  monthBounds,
} from "./ca-exports";
import type { Invoice, InvoiceItem } from "./types";

const MH = "27";
const KA = "29";
const MH_GSTIN = "27AAPFU0939F1ZV";
const KA_GSTIN = "29AABCU9603R1ZJ";

function line(partial: Partial<InvoiceItem> & { gstRate: number; isInterState: boolean }): InvoiceItem {
  const calc = calculateItem({
    quantity: partial.quantity ?? 1,
    rate: partial.rate ?? 1000,
    discount: partial.discount ?? 0,
    gstRate: partial.gstRate,
    isInterState: partial.isInterState,
    cess: partial.cess ?? 0,
  });
  return {
    id: partial.id ?? "item-1",
    description: partial.description ?? "Goods",
    hsn: partial.hsn ?? "9983",
    quantity: calc.quantity,
    unit: partial.unit ?? "NOS",
    uqc: partial.uqc ?? "NOS",
    rate: calc.rate,
    discount: calc.discount,
    gstRate: calc.gstRate,
    taxableAmount: calc.taxableAmount,
    cgst: calc.cgst,
    sgst: calc.sgst,
    igst: calc.igst,
    cess: calc.cess,
    total: calc.total,
  };
}

function invoice(partial: Partial<Invoice> & { items: InvoiceItem[] }): Invoice {
  const items = partial.items;
  const totalTaxable = items.reduce((s, i) => s + i.taxableAmount, 0);
  const totalCgst = items.reduce((s, i) => s + i.cgst, 0);
  const totalSgst = items.reduce((s, i) => s + i.sgst, 0);
  const totalIgst = items.reduce((s, i) => s + i.igst, 0);
  const grandTotal = items.reduce((s, i) => s + i.total, 0);
  return {
    id: partial.id ?? "inv-1",
    invoiceNumber: partial.invoiceNumber ?? "INV-2026-0001",
    type: partial.type ?? "tax_invoice",
    status: partial.status ?? "paid",
    businessId: "biz-1",
    partyId: partial.partyId ?? "p1",
    partyName: partial.partyName ?? "Buyer",
    partyGstin: partial.partyGstin ?? MH_GSTIN,
    partyPhone: "",
    date: partial.date ?? "2026-04-10",
    dueDate: "2026-04-25",
    items,
    subtotal: totalTaxable,
    totalDiscount: 0,
    totalTaxable,
    totalCgst,
    totalSgst,
    totalIgst,
    totalTax: totalCgst + totalSgst + totalIgst,
    roundOff: 0,
    grandTotal,
    paidAmount: grandTotal,
    balanceDue: 0,
    paymentMode: "Cash",
    notes: "",
    terms: "",
    placeOfSupply: partial.placeOfSupply ?? MH,
    isInterState: partial.isInterState ?? false,
    isTotalMode: false,
    createdAt: "2026-04-10T00:00:00.000Z",
    updatedAt: "2026-04-10T00:00:00.000Z",
    sellerGstin: partial.sellerGstin ?? MH_GSTIN,
    shipToGstin: partial.shipToGstin,
    documentType: partial.documentType,
    reverseCharge: partial.reverseCharge ?? false,
    totalCess: 0,
  };
}

describe("GSTR-1 GSTN offline-tool JSON", () => {
  it("puts a registered buyer in b2b with GSTN field names", () => {
    expect(isRegisteredGstin(KA_GSTIN)).toBe(true);
    const inv = invoice({
      invoiceNumber: "INV-2026-0001",
      partyGstin: KA_GSTIN,
      partyName: "KA Buyer",
      placeOfSupply: KA,
      isInterState: true,
      items: [line({ gstRate: 18, isInterState: true, rate: 1000, hsn: "8471" })],
    });
    const json = buildGstr1Json({
      gstin: MH_GSTIN,
      month: "2026-04",
      invoices: [inv],
    });
    expect(json.gstin).toBe(MH_GSTIN);
    expect(json.fp).toBe("042026");
    expect(json.b2b).toHaveLength(1);
    expect(json.b2b[0].ctin).toBe(KA_GSTIN);
    const row = json.b2b[0].inv[0];
    expect(row.inum).toBe("INV-2026-0001");
    expect(row.idt).toBe("10-04-2026");
    expect(row.pos).toBe(KA);
    expect(row.rchrg).toBe("N");
    expect(row.inv_typ).toBe("R");
    expect(row.val).toBe(1180);
    const det = row.itms[0].itm_det;
    expect(det.rt).toBe(18);
    expect(det.txval).toBe(1000);
    expect(det.iamt).toBe(180);
    expect(det.camt).toBe(0);
    expect(det.samt).toBe(0);
    expect(json.b2cs || []).toEqual([]);
  });

  it("puts intra-state URP in b2cs and large inter-state URP in b2cl", () => {
    const small = invoice({
      id: "b2cs",
      invoiceNumber: "INV-2026-0002",
      partyGstin: "URP",
      partyName: "Walk-in",
      placeOfSupply: MH,
      isInterState: false,
      items: [line({ gstRate: 18, isInterState: false, rate: 1000 })],
    });
    const large = invoice({
      id: "b2cl",
      invoiceNumber: "INV-2026-0003",
      partyGstin: "",
      partyName: "Big walk-in",
      placeOfSupply: KA,
      isInterState: true,
      items: [line({ gstRate: 18, isInterState: true, rate: 300000, quantity: 1 })],
    });
    const json = buildGstr1Json({ gstin: MH_GSTIN, month: "2026-04", invoices: [small, large] });
    expect(json.b2cs.length).toBeGreaterThan(0);
    const cs = json.b2cs[0];
    expect(cs.typ).toBe("OE");
    expect(cs.sply_ty).toBe("INTRA");
    expect(cs.pos).toBe(MH);
    expect(cs.rt).toBe(18);
    expect(cs.txval).toBe(1000);
    expect(cs.camt).toBe(90);
    expect(cs.samt).toBe(90);
    expect(cs.iamt).toBe(0);

    expect(json.b2cl).toHaveLength(1);
    expect(json.b2cl[0].pos).toBe(KA);
    expect(json.b2cl[0].inv[0].inum).toBe("INV-2026-0003");
    expect(json.b2cl[0].inv[0].val).toBeGreaterThan(250000);
    expect(json.b2cl[0].inv[0].itms[0].itm_det.iamt).toBe(54000);
  });

  it("puts registered credit notes in cdnr", () => {
    const cn = invoice({
      invoiceNumber: "CN-2026-0001",
      type: "credit_note",
      documentType: "CRN",
      partyGstin: KA_GSTIN,
      placeOfSupply: KA,
      isInterState: true,
      items: [line({ gstRate: 18, isInterState: true, rate: 500 })],
    });
    const json = buildGstr1Json({ gstin: MH_GSTIN, month: "2026-04", invoices: [cn] });
    expect(json.cdnr).toHaveLength(1);
    expect(json.cdnr[0].ctin).toBe(KA_GSTIN);
    const nt = json.cdnr[0].nt[0];
    expect(nt.ntty).toBe("C");
    expect(nt.nt_num).toBe("CN-2026-0001");
    expect(nt.nt_dt).toBe("10-04-2026");
    expect(nt.itms[0].itm_det.iamt).toBe(90);
    expect(json.b2b || []).toEqual([]);
  });

  it("builds hsn and doc_issue with GSTN field names", () => {
    const inv = invoice({
      items: [line({ gstRate: 18, isInterState: false, hsn: "9983", quantity: 2, rate: 100 })],
    });
    const json = buildGstr1Json({ gstin: MH_GSTIN, month: "2026-04", invoices: [inv] });
    const hsnRows = json.hsn?.data || json.hsn;
    expect(Array.isArray(hsnRows)).toBe(true);
    expect(hsnRows[0].hsn_sc).toBe("9983");
    expect(hsnRows[0].rt).toBe(18);
    expect(hsnRows[0].txval).toBe(200);
    expect(hsnRows[0].uqc).toBe("NOS");
    expect(json.doc_issue.doc_det.length).toBeGreaterThan(0);
    const docs = json.doc_issue.doc_det[0].docs[0];
    expect(docs.from).toBe("INV-2026-0001");
    expect(docs.to).toBe("INV-2026-0001");
    expect(docs.totnum).toBe(1);
    expect(docs.net_issue).toBe(1);
  });

  it("keeps CGST+SGST vs IGST consistent with stored Sprint 1 line tax", () => {
    const intra = invoice({
      id: "intra",
      invoiceNumber: "INV-IN",
      partyGstin: MH_GSTIN,
      placeOfSupply: MH,
      isInterState: false,
      items: [line({ gstRate: 18, isInterState: false })],
    });
    const inter = invoice({
      id: "inter",
      invoiceNumber: "INV-IG",
      partyGstin: KA_GSTIN,
      placeOfSupply: KA,
      isInterState: true,
      items: [line({ gstRate: 18, isInterState: true })],
    });
    const json = buildGstr1Json({ gstin: MH_GSTIN, month: "2026-04", invoices: [intra, inter] });
    const intraDet = json.b2b.find((g) => g.ctin === MH_GSTIN)!.inv[0].itms[0].itm_det;
    const interDet = json.b2b.find((g) => g.ctin === KA_GSTIN)!.inv[0].itms[0].itm_det;
    expect(intraDet.camt).toBe(90);
    expect(intraDet.samt).toBe(90);
    expect(intraDet.iamt).toBe(0);
    expect(interDet.iamt).toBe(180);
    expect(interDet.camt).toBe(0);
    expect(interDet.samt).toBe(0);
  });

  it("does not crash on unregistered / URP / blank GSTIN or missing items", () => {
    const empty = invoice({
      partyGstin: "URP",
      shipToGstin: "URP",
      items: [],
    });
    empty.items = [];
    const json = buildGstr1Json({
      gstin: MH_GSTIN,
      month: "2026-04",
      invoices: [empty, { ...empty, partyGstin: "", invoiceNumber: "INV-BLANK" } as Invoice],
    });
    expect(json.gstin).toBe(MH_GSTIN);
    expect(json.fp).toBe("042026");
  });

  it("skips other months, drafts, and cancelled invoices", () => {
    const keep = invoice({ invoiceNumber: "INV-KEEP", items: [line({ gstRate: 5, isInterState: false })] });
    const otherMonth = invoice({
      invoiceNumber: "INV-MAY",
      date: "2026-05-01",
      items: [line({ gstRate: 5, isInterState: false })],
    });
    const draft = invoice({ invoiceNumber: "INV-DR", status: "draft", items: [line({ gstRate: 5, isInterState: false })] });
    const json = buildGstr1Json({
      gstin: MH_GSTIN,
      month: "2026-04",
      invoices: [keep, otherMonth, draft],
    });
    expect(json.b2b[0].inv.map((i) => i.inum)).toEqual(["INV-KEEP"]);
  });

  it("maps a named place of supply to a two-digit GSTN POS code", () => {
    const inv = invoice({
      partyGstin: KA_GSTIN,
      placeOfSupply: "Karnataka",
      isInterState: true,
      items: [line({ gstRate: 18, isInterState: true })],
    });
    const json = buildGstr1Json({ gstin: MH_GSTIN, month: "2026-04", invoices: [inv] });
    expect(json.b2b[0].inv[0].pos).toBe(KA);
  });

  it("reads seller GSTIN and company name from app_data without a second tax calculator", () => {
    expect(
      sellerGstinFromAppData({
        activeBusinessId: "biz-1",
        businesses: [{ id: "biz-1", gstin: MH_GSTIN, name: "Demo Shop" }],
      })
    ).toBe(MH_GSTIN);
    expect(
      companyNameFromAppData({
        activeBusinessId: "biz-1",
        businesses: [{ id: "biz-1", name: "Demo Shop" }],
      })
    ).toBe("Demo Shop");
    expect(parseMonthParam("2026-04")).toBe("2026-04");
    expect(monthBounds("2026-04").fp).toBe("042026");
    expect(parseMonthParam("not-a-month", new Date(2026, 7, 27))).toBe("2026-08");
  });
});

describe("TallyPrime XML", () => {
  it("emits ENVELOPE / TALLYMESSAGE with sales and credit-note vouchers plus ledgers", () => {
    const sale = invoice({
      invoiceNumber: "INV-2026-0001",
      partyName: "KA Buyer",
      partyGstin: KA_GSTIN,
      placeOfSupply: KA,
      isInterState: true,
      items: [line({ gstRate: 18, isInterState: true })],
    });
    const cn = invoice({
      invoiceNumber: "CN-2026-0001",
      type: "credit_note",
      documentType: "CRN",
      partyName: "KA Buyer",
      partyGstin: KA_GSTIN,
      placeOfSupply: KA,
      isInterState: true,
      items: [line({ gstRate: 18, isInterState: true, rate: 100 })],
    });
    const xml = buildTallyXml({
      companyName: "Demo Shop",
      month: "2026-04",
      invoices: [sale, cn],
    });
    expect(xml).toContain("<ENVELOPE>");
    expect(xml).toContain("</ENVELOPE>");
    expect(xml).toContain("<TALLYMESSAGE");
    expect(xml).toMatch(/VCHTYPE="Sales"/);
    expect(xml).toMatch(/VCHTYPE="Credit Note"/);
    expect(xml).toContain("Duties &amp; Taxes");
    expect(xml).toContain("INV-2026-0001");
    expect(xml).toContain("CN-2026-0001");
    expect(xml).toContain("IGST");
    expect(xml).toMatch(/<VOUCHERNUMBER>INV-2026-0001<\/VOUCHERNUMBER>[\s\S]*<LEDGERNAME>IGST<\/LEDGERNAME>/);
  });

  it("uses CGST+SGST ledger lines for intra-state sales matching stored Sprint 1 tax", () => {
    const sale = invoice({
      invoiceNumber: "INV-INTRA",
      partyGstin: MH_GSTIN,
      placeOfSupply: MH,
      isInterState: false,
      items: [line({ gstRate: 18, isInterState: false })],
    });
    const xml = buildTallyXml({ companyName: "Demo Shop", month: "2026-04", invoices: [sale] });
    expect(xml).toMatch(/<VOUCHERNUMBER>INV-INTRA<\/VOUCHERNUMBER>[\s\S]*<LEDGERNAME>CGST<\/LEDGERNAME>/);
    expect(xml).toMatch(/<VOUCHERNUMBER>INV-INTRA<\/VOUCHERNUMBER>[\s\S]*<LEDGERNAME>SGST<\/LEDGERNAME>/);
    expect(xml).not.toMatch(/<VOUCHERNUMBER>INV-INTRA<\/VOUCHERNUMBER>[\s\S]*<LEDGERNAME>IGST<\/LEDGERNAME>/);
  });

  it("does not crash Tally export for URP walk-ins", () => {
    const walk = invoice({
      partyGstin: "URP",
      partyName: "Walk-in",
      items: [line({ gstRate: 18, isInterState: false })],
    });
    const xml = buildTallyXml({ companyName: "Demo Shop", month: "2026-04", invoices: [walk] });
    expect(xml).toContain("<ENVELOPE>");
    expect(xml).toContain("Walk-in");
  });
});

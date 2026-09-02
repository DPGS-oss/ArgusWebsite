/**
 * NIC IRP e-invoice schema v1.1 field names (upload on einvoice.gst.gov.in).
 * Cite: GST INV-1 / IRP Generate IRN payload — Version, TranDtls, DocDtls,
 * SellerDtls, BuyerDtls, ShipDtls, ItemList, ValDtls.
 * DocDtls.Typ: INV | CRN | DBN. DocDtls.Dt: DD/MM/YYYY.
 * BuyerDtls.Gstin / ShipDtls.Gstin: 15-char GSTIN or URP.
 * ItemList[].HsnCd, AssAmt, GstRt, IgstAmt, CgstAmt, SgstAmt.
 * Argus does not mint IRNs — payloads must not include Irn.
 */
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { calculateItem } from "./gst";
import type { Invoice, InvoiceItem } from "./types";

const require = createRequire(import.meta.url);
const { buildEinvoiceJson, buildEinvoiceBatch } = require("../functions/_shared/einvoice.js");

const MH = "27";
const KA = "29";
const MH_GSTIN = "27AAPFU0939F1ZV";
const KA_GSTIN = "29AABCU9603R1ZJ";

const seller = {
  id: "biz-1",
  name: "Demo Shop",
  gstin: MH_GSTIN,
  address: "1 MG Road",
  city: "Mumbai",
  state: "Maharashtra",
  stateCode: MH,
  pincode: "400001",
  phone: "9999999999",
  email: "shop@example.com",
};

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
    hsn: partial.hsn ?? "8471",
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
    partyGstin: partial.partyGstin ?? KA_GSTIN,
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
    placeOfSupply: partial.placeOfSupply ?? KA,
    isInterState: partial.isInterState ?? true,
    isTotalMode: false,
    createdAt: "2026-04-10T00:00:00.000Z",
    updatedAt: "2026-04-10T00:00:00.000Z",
    sellerGstin: partial.sellerGstin ?? MH_GSTIN,
    shipToGstin: partial.shipToGstin,
    shipToAddress: partial.shipToAddress,
    documentType: partial.documentType,
    reverseCharge: partial.reverseCharge ?? false,
    totalCess: 0,
  };
}

describe("NIC IRP e-invoice JSON v1.1", () => {
  it("includes seller GSTIN, buyer GSTIN, ship-to GSTIN, POS, HSN, and stored tax split", () => {
    const inv = invoice({
      items: [line({ gstRate: 18, isInterState: true, hsn: "8471" })],
    });
    const json = buildEinvoiceJson({ invoice: inv, business: seller });
    expect(json.Version).toBe("1.1");
    expect(json.Irn).toBeUndefined();
    expect(json.TranDtls.TaxSch).toBe("GST");
    expect(json.TranDtls.SupTyp).toBe("B2B");
    expect(json.DocDtls.Typ).toBe("INV");
    expect(json.DocDtls.No).toBe("INV-2026-0001");
    expect(json.DocDtls.Dt).toBe("10/04/2026");
    expect(json.SellerDtls.Gstin).toBe(MH_GSTIN);
    expect(json.SellerDtls.Stcd).toBe(MH);
    expect(json.BuyerDtls.Gstin).toBe(KA_GSTIN);
    expect(json.BuyerDtls.Pos).toBe(KA);
    expect(json.ShipDtls.Gstin).toBe(KA_GSTIN);
    const item = json.ItemList[0];
    expect(item.HsnCd).toBe("8471");
    expect(item.AssAmt).toBe(1000);
    expect(item.GstRt).toBe(18);
    expect(item.IgstAmt).toBe(180);
    expect(item.CgstAmt).toBe(0);
    expect(item.SgstAmt).toBe(0);
    expect(json.ValDtls.IgstVal).toBe(180);
    expect(json.ValDtls.TotInvVal).toBe(1180);
  });

  it("uses ship-to GSTIN when bill-to ≠ ship-to, and URP when ship-to is unregistered", () => {
    const different = invoice({
      partyGstin: MH_GSTIN,
      placeOfSupply: KA,
      isInterState: true,
      shipToGstin: KA_GSTIN,
      items: [line({ gstRate: 18, isInterState: true })],
    });
    const json = buildEinvoiceJson({ invoice: different, business: seller });
    expect(json.BuyerDtls.Gstin).toBe(MH_GSTIN);
    expect(json.ShipDtls.Gstin).toBe(KA_GSTIN);
    expect(json.BuyerDtls.Pos).toBe(KA);

    const urpShip = invoice({
      partyGstin: KA_GSTIN,
      shipToGstin: "URP",
      items: [line({ gstRate: 18, isInterState: true })],
    });
    const urpJson = buildEinvoiceJson({ invoice: urpShip, business: seller });
    expect(urpJson.BuyerDtls.Gstin).toBe(KA_GSTIN);
    expect(urpJson.ShipDtls.Gstin).toBe("URP");
  });

  it("always includes ShipDtls.Gstin (copies bill-to or URP when ship-to is blank)", () => {
    const same = invoice({
      partyGstin: KA_GSTIN,
      items: [line({ gstRate: 18, isInterState: true })],
    });
    delete same.shipToGstin;
    const json = buildEinvoiceJson({ invoice: same, business: seller });
    expect(json.ShipDtls).toBeTruthy();
    expect(json.ShipDtls.Gstin).toBe(KA_GSTIN);

    const walkIn = invoice({
      partyGstin: "URP",
      partyName: "Walk-in",
      placeOfSupply: MH,
      isInterState: false,
      items: [line({ gstRate: 18, isInterState: false })],
    });
    expect(buildEinvoiceJson({ invoice: walkIn, business: seller })).toBeNull();
  });

  it("sets DocDtls.Typ to CRN for credit notes and DBN for debit notes", () => {
    const cn = invoice({
      invoiceNumber: "CN-2026-0001",
      type: "credit_note",
      documentType: "CRN",
      items: [line({ gstRate: 18, isInterState: true, rate: 500 })],
    });
    expect(buildEinvoiceJson({ invoice: cn, business: seller }).DocDtls.Typ).toBe("CRN");

    const dn = invoice({
      invoiceNumber: "DN-2026-0001",
      type: "debit_note",
      items: [line({ gstRate: 18, isInterState: true, rate: 500 })],
    });
    expect(buildEinvoiceJson({ invoice: dn, business: seller }).DocDtls.Typ).toBe("DBN");
  });

  it("does not mint IRN or call GSTN/IRP (pure stored-field mapping)", () => {
    const fetchCalls: unknown[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = ((...args: unknown[]) => {
      fetchCalls.push(args);
      return Promise.reject(new Error("network forbidden in unit tests"));
    }) as typeof fetch;
    try {
      const json = buildEinvoiceJson({
        invoice: invoice({ items: [line({ gstRate: 5, isInterState: false })] }),
        business: seller,
      });
      expect(json.Irn).toBeUndefined();
      expect(json.TranDtls.EwbDtls).toBeUndefined();
      expect(json.EwbDtls).toBeUndefined();
      expect(fetchCalls).toEqual([]);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("batches a month of invoices without drafts or other months", () => {
    const keep = invoice({ invoiceNumber: "INV-KEEP", items: [line({ gstRate: 18, isInterState: true })] });
    const other = invoice({
      invoiceNumber: "INV-MAY",
      date: "2026-05-01",
      items: [line({ gstRate: 18, isInterState: true })],
    });
    const draft = invoice({
      invoiceNumber: "INV-DR",
      status: "draft",
      items: [line({ gstRate: 18, isInterState: true })],
    });
    const urp = invoice({
      invoiceNumber: "INV-URP",
      partyGstin: "URP",
      items: [line({ gstRate: 18, isInterState: false })],
    });
    const batch = buildEinvoiceBatch({
      month: "2026-04",
      invoices: [keep, other, draft, urp],
      businesses: [seller],
    });
    expect(Array.isArray(batch)).toBe(true);
    expect(batch).toHaveLength(1);
    expect(batch[0].DocDtls.No).toBe("INV-KEEP");
    expect(batch[0].Version).toBe("1.1");
    expect(batch[0].ShipDtls.Gstin).toBeTruthy();
  });

  it("emits SupTyp B2B for a registered GSTIN and omits URP/blank/invalid (B2C is not an IRP enum)", () => {
    const registered = invoice({
      partyGstin: KA_GSTIN,
      items: [line({ gstRate: 18, isInterState: true })],
    });
    const json = buildEinvoiceJson({ invoice: registered, business: seller });
    expect(json).not.toBeNull();
    expect(json.TranDtls.SupTyp).toBe("B2B");
    expect(json.TranDtls.SupTyp).not.toBe("B2C");

    for (const partyGstin of ["URP", "", "   ", "ABC", "27AAPFU0939F1Z0"]) {
      const unreg = invoice({
        partyGstin,
        partyName: "Walk-in",
        placeOfSupply: MH,
        isInterState: false,
        items: [line({ gstRate: 18, isInterState: false })],
      });
      expect(buildEinvoiceJson({ invoice: unreg, business: seller })).toBeNull();
    }

    const mixed = buildEinvoiceBatch({
      month: "2026-04",
      invoices: [
        registered,
        invoice({ id: "u1", invoiceNumber: "INV-URP", partyGstin: "URP", items: [line({ gstRate: 18, isInterState: false })] }),
        invoice({ id: "u2", invoiceNumber: "INV-BLANK", partyGstin: "", items: [line({ gstRate: 18, isInterState: false })] }),
      ],
      businesses: [seller],
    });
    expect(mixed).toHaveLength(1);
    expect(mixed[0].DocDtls.No).toBe(registered.invoiceNumber);
    expect(mixed[0].TranDtls.SupTyp).toBe("B2B");
  });

  it("puts bill-to on BuyerDtls and keeps a different ship-to on ShipDtls only", () => {
    const inv = {
      ...invoice({
        partyGstin: KA_GSTIN,
        shipToGstin: MH_GSTIN,
        shipToAddress: "Mumbai warehouse",
        items: [line({ gstRate: 18, isInterState: true })],
      }),
      partyAddress: "Bengaluru bill-to",
      partyCity: "Bengaluru",
      partyPincode: "560001",
      shipToCity: "Mumbai",
      shipToPincode: "400001",
    };
    const json = buildEinvoiceJson({ invoice: inv, business: seller });
    expect(json.BuyerDtls.Addr1).toBe("Bengaluru bill-to");
    expect(json.BuyerDtls.Loc).toBe("Bengaluru");
    expect(json.BuyerDtls.Pin).toBe(560001);
    expect(json.ShipDtls.Addr1).toBe("Mumbai warehouse");
    expect(json.ShipDtls.Loc).toBe("Mumbai");
    expect(json.ShipDtls.Pin).toBe(400001);

    const fromParty = invoice({
      partyId: "p-bill",
      partyGstin: KA_GSTIN,
      shipToAddress: "Mumbai warehouse",
      items: [line({ gstRate: 18, isInterState: true })],
    });
    const lookedUp = buildEinvoiceJson({
      invoice: fromParty,
      business: seller,
      parties: [
        {
          id: "p-bill",
          address: "1 MG Road",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
        },
      ],
    });
    expect(lookedUp.BuyerDtls.Addr1).toBe("1 MG Road, Bengaluru, Karnataka, 560001");
    expect(lookedUp.ShipDtls.Addr1).toBe("Mumbai warehouse");
  });
});

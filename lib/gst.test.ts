import { describe, expect, it } from "vitest";
import {
  GST_2_0_RATES,
  buildInvoiceDocument,
  calculateItem,
  defaultGstRateForNew,
  documentTypeFromInvoiceType,
  generateGSTRReport,
  gstRatePickerOptions,
  isInterState,
  openHistoricalInvoice,
  resolvePlaceOfSupply,
  resolveShipTo,
  stateCodeFromPlaceOfSupply,
} from "./gst";
import { isRegisteredGstin, normalizeGstin } from "./gstin";
import type { Invoice, InvoiceItem } from "./types";

const MH = "27";
const KA = "29";
const MH_GSTIN = "27AAPFU0939F1ZV";
const DL_GSTIN = "07AABCU9603R1ZP";

function line(partial: Partial<InvoiceItem> & { gstRate: number; isInterState: boolean }): InvoiceItem {
  const calc = calculateItem({
    quantity: partial.quantity ?? 1,
    rate: partial.rate ?? 1000,
    discount: partial.discount ?? 0,
    gstRate: partial.gstRate,
    isInterState: partial.isInterState,
    cessRate: partial.cess ?? 0,
  });
  return {
    id: partial.id ?? "item-1",
    description: partial.description ?? "Goods",
    hsn: partial.hsn ?? "7108",
    quantity: calc.quantity,
    unit: partial.unit ?? "NOS",
    uqc: partial.uqc ?? partial.unit ?? "NOS",
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

describe("GST 2.0 rate table", () => {
  it("defaults new invoices to 0 / 0.25 / 3 / 5 / 18 / 40", () => {
    expect(GST_2_0_RATES).toEqual([0, 0.25, 3, 5, 18, 40]);
    const picker = gstRatePickerOptions();
    expect(picker).toEqual([0, 0.25, 3, 5, 18, 40]);
    expect(picker).not.toContain(12);
    expect(picker).not.toContain(28);
  });

  it("does not default-offer 12% or 28% on the new rate picker", () => {
    expect(gstRatePickerOptions(18)).not.toContain(12);
    expect(gstRatePickerOptions(18)).not.toContain(28);
    expect(gstRatePickerOptions(undefined)).not.toContain(12);
    expect(gstRatePickerOptions(undefined)).not.toContain(28);
  });

  it("keeps a historical 12% or 28% rate visible when that invoice is open", () => {
    expect(gstRatePickerOptions(12)).toContain(12);
    expect(gstRatePickerOptions(12)).toContain(18);
    expect(gstRatePickerOptions(28)).toContain(28);
    expect(gstRatePickerOptions(28)).not.toEqual(expect.arrayContaining([12]));
  });

  it("does not use a stored 12%/28% default for new invoices", () => {
    expect(defaultGstRateForNew(12)).toBe(18);
    expect(defaultGstRateForNew(28)).toBe(18);
    expect(defaultGstRateForNew(18)).toBe(18);
    expect(defaultGstRateForNew(5)).toBe(5);
    expect(defaultGstRateForNew(0.25)).toBe(0.25);
  });
});

describe("place of supply tax split", () => {
  it("intra-state bill-to/ship-to same → CGST + SGST", () => {
    const ship = resolveShipTo({
      billToGstin: MH_GSTIN,
      billToAddress: "Pune",
      billToStateCode: MH,
    });
    const pos = resolvePlaceOfSupply(ship.shipToStateCode, MH);
    expect(pos).toBe(MH);
    expect(isInterState(MH, pos)).toBe(false);

    const item = calculateItem({
      quantity: 2,
      rate: 100,
      discount: 0,
      gstRate: 18,
      isInterState: isInterState(MH, pos),
    });
    expect(item.taxableAmount).toBe(200);
    expect(item.cgst).toBe(18);
    expect(item.sgst).toBe(18);
    expect(item.igst).toBe(0);
  });

  it("inter-state → IGST", () => {
    const pos = resolvePlaceOfSupply(KA, MH);
    expect(pos).toBe(KA);
    expect(isInterState(MH, pos)).toBe(true);

    const item = calculateItem({
      quantity: 1,
      rate: 1000,
      discount: 0,
      gstRate: 18,
      isInterState: isInterState(MH, pos),
    });
    expect(item.cgst).toBe(0);
    expect(item.sgst).toBe(0);
    expect(item.igst).toBe(180);
  });

  it("bill-to registered / ship-to URP uses ship-to state as place of supply", () => {
    const ship = resolveShipTo({
      billToGstin: MH_GSTIN,
      billToAddress: "Pune, Maharashtra",
      billToStateCode: MH,
      shipToGstin: "URP",
      shipToAddress: "Bengaluru warehouse",
      shipToStateCode: KA,
    });
    expect(ship.shipToGstin).toBe("URP");
    expect(ship.shipToAddress).toBe("Bengaluru warehouse");
    expect(ship.shipToStateCode).toBe(KA);

    const invoice = buildInvoiceDocument({
      id: "inv-urp",
      invoiceNumber: "INV-2026-0001",
      type: "tax_invoice",
      status: "unpaid",
      businessId: "biz-1",
      sellerGstin: MH_GSTIN,
      sellerStateCode: MH,
      partyId: "party-1",
      partyName: "Registered Buyer",
      partyGstin: MH_GSTIN,
      partyPhone: "",
      partyAddress: "Pune, Maharashtra",
      partyStateCode: MH,
      shipToGstin: "URP",
      shipToAddress: "Bengaluru warehouse",
      shipToStateCode: KA,
      date: "2026-04-01",
      dueDate: "2026-04-16",
      items: [
        line({ gstRate: 18, isInterState: true, rate: 1000, hsn: "8471", unit: "NOS" }),
      ],
      roundOffEnabled: false,
      paidAmount: 0,
      paymentMode: "",
      notes: "",
      terms: "",
      reverseCharge: false,
      isTotalMode: false,
      createdAt: "2026-04-01T00:00:00.000Z",
    });

    expect(invoice.partyGstin).toBe(MH_GSTIN);
    expect(invoice.shipToGstin).toBe("URP");
    expect(invoice.placeOfSupply).toBe(KA);
    expect(invoice.isInterState).toBe(true);
    expect(invoice.totalIgst).toBeGreaterThan(0);
    expect(invoice.totalCgst).toBe(0);
    expect(invoice.totalSgst).toBe(0);
  });

  it("blank ship-to copies bill-to, including URP for unregistered bill-to", () => {
    const ship = resolveShipTo({
      billToGstin: "",
      billToAddress: "Walk-in counter",
      billToStateCode: MH,
    });
    expect(ship.shipToGstin).toBe("URP");
    expect(ship.shipToAddress).toBe("Walk-in counter");
    expect(ship.shipToStateCode).toBe(MH);
  });

  it("derives ship-to state code from a registered ship-to GSTIN when state is omitted", () => {
    const ship = resolveShipTo({
      billToGstin: MH_GSTIN,
      billToAddress: "Pune",
      billToStateCode: MH,
      shipToGstin: DL_GSTIN,
      shipToAddress: "Delhi depot",
    });
    expect(ship.shipToGstin).toBe(DL_GSTIN);
    expect(ship.shipToStateCode).toBe("07");
  });
});

describe("historical invoices", () => {
  it("opens a historical 12% invoice without rewriting GST rates or tax split", () => {
    const historical: Invoice = {
      id: "old-12",
      invoiceNumber: "INV-2024-0099",
      type: "tax_invoice",
      status: "paid",
      businessId: "biz-1",
      partyId: "party-1",
      partyName: "Old Customer",
      partyGstin: MH_GSTIN,
      partyPhone: "",
      date: "2024-06-01",
      dueDate: "2024-06-16",
      items: [
        {
          id: "i1",
          description: "Pharma",
          hsn: "3004",
          quantity: 1,
          unit: "NOS",
          rate: 1000,
          discount: 0,
          gstRate: 12,
          taxableAmount: 1000,
          cgst: 60,
          sgst: 60,
          igst: 0,
          total: 1120,
        },
      ],
      subtotal: 1000,
      totalDiscount: 0,
      totalTaxable: 1000,
      totalCgst: 60,
      totalSgst: 60,
      totalIgst: 0,
      totalTax: 120,
      roundOff: 0,
      grandTotal: 1120,
      paidAmount: 1120,
      balanceDue: 0,
      paymentMode: "Cash",
      notes: "",
      terms: "",
      placeOfSupply: "Maharashtra",
      isInterState: false,
      isTotalMode: false,
      createdAt: "2024-06-01T00:00:00.000Z",
      updatedAt: "2024-06-01T00:00:00.000Z",
    };

    const opened = openHistoricalInvoice(historical);
    expect(opened.items[0].gstRate).toBe(12);
    expect(opened.items[0].cgst).toBe(60);
    expect(opened.items[0].sgst).toBe(60);
    expect(opened.items[0].igst).toBe(0);
    expect(stateCodeFromPlaceOfSupply(opened.placeOfSupply)).toBe(MH);
    expect(opened.placeOfSupply === "Maharashtra" || opened.placeOfSupply === MH).toBe(true);
    expect(gstRatePickerOptions(opened.items[0].gstRate)).toContain(12);

    const rebuilt = buildInvoiceDocument({
      id: historical.id,
      invoiceNumber: historical.invoiceNumber,
      type: historical.type,
      status: historical.status,
      businessId: historical.businessId,
      sellerGstin: MH_GSTIN,
      sellerStateCode: MH,
      partyId: historical.partyId,
      partyName: historical.partyName,
      partyGstin: historical.partyGstin,
      partyPhone: historical.partyPhone,
      partyAddress: "Pune",
      // Bill-to state that does not match named POS — must not steal place of supply or flip tax.
      partyStateCode: KA,
      placeOfSupply: historical.placeOfSupply,
      date: historical.date,
      dueDate: historical.dueDate,
      items: historical.items,
      roundOffEnabled: false,
      paidAmount: historical.paidAmount,
      paymentMode: historical.paymentMode,
      notes: historical.notes,
      terms: historical.terms,
      reverseCharge: false,
      isTotalMode: false,
      createdAt: historical.createdAt,
    });
    expect(rebuilt.items[0].gstRate).toBe(12);
    expect(rebuilt.items[0].cgst).toBe(60);
    expect(rebuilt.items[0].sgst).toBe(60);
    expect(rebuilt.items[0].igst).toBe(0);
    expect(rebuilt.totalCgst).toBe(60);
    expect(rebuilt.totalSgst).toBe(60);
    expect(rebuilt.totalIgst).toBe(0);
    expect(stateCodeFromPlaceOfSupply(rebuilt.placeOfSupply)).toBe(MH);
    expect(rebuilt.isInterState).toBe(false);
  });

  it("maps common place-of-supply name aliases to GST state codes", () => {
    expect(stateCodeFromPlaceOfSupply("Maharashtra")).toBe("27");
    expect(stateCodeFromPlaceOfSupply("MH")).toBe("27");
    expect(stateCodeFromPlaceOfSupply("27")).toBe("27");
    expect(stateCodeFromPlaceOfSupply("NCT of Delhi")).toBe("07");
    expect(stateCodeFromPlaceOfSupply("New Delhi")).toBe("07");
    expect(stateCodeFromPlaceOfSupply("Orissa")).toBe("21");
    expect(stateCodeFromPlaceOfSupply("Pondicherry")).toBe("34");
    expect(stateCodeFromPlaceOfSupply("Jammu & Kashmir")).toBe("01");
  });

  it("keeps walk-in IGST when empty party state would otherwise fall back to the seller", () => {
    // On main, empty party stateCode made "" !== seller → IGST, while POS was often the
    // seller's state *name*. Falling back party → business.stateCode turns POS into the
    // seller code and would rewrite IGST → CGST+SGST on an accidental save.
    const walkIn: Invoice = {
      id: "old-walkin-igst",
      invoiceNumber: "INV-2024-0100",
      type: "tax_invoice",
      status: "paid",
      businessId: "biz-1",
      partyId: "",
      partyName: "Walk-in",
      partyGstin: "",
      partyPhone: "",
      date: "2024-06-01",
      dueDate: "2024-06-16",
      items: [
        {
          id: "i1",
          description: "Counter sale",
          hsn: "9983",
          quantity: 1,
          unit: "NOS",
          rate: 1000,
          discount: 0,
          gstRate: 18,
          taxableAmount: 1000,
          cgst: 0,
          sgst: 0,
          igst: 180,
          total: 1180,
        },
      ],
      subtotal: 1000,
      totalDiscount: 0,
      totalTaxable: 1000,
      totalCgst: 0,
      totalSgst: 0,
      totalIgst: 180,
      totalTax: 180,
      roundOff: 0,
      grandTotal: 1180,
      paidAmount: 1180,
      balanceDue: 0,
      paymentMode: "Cash",
      notes: "",
      terms: "",
      placeOfSupply: "Maharashtra",
      isInterState: true,
      isTotalMode: false,
      createdAt: "2024-06-01T00:00:00.000Z",
      updatedAt: "2024-06-01T00:00:00.000Z",
    };

    const opened = openHistoricalInvoice(walkIn);
    expect(stateCodeFromPlaceOfSupply(opened.placeOfSupply)).toBe(MH);
    expect(opened.items[0].igst).toBe(180);
    expect(opened.items[0].cgst).toBe(0);
    expect(opened.items[0].sgst).toBe(0);
    expect(opened.isInterState).toBe(true);

    const rebuildInput = {
      id: walkIn.id,
      invoiceNumber: walkIn.invoiceNumber,
      type: walkIn.type,
      status: walkIn.status,
      businessId: walkIn.businessId,
      sellerGstin: MH_GSTIN,
      sellerStateCode: MH,
      partyId: "",
      partyName: walkIn.partyName,
      partyGstin: walkIn.partyGstin,
      partyPhone: walkIn.partyPhone,
      partyAddress: "Counter",
      date: walkIn.date,
      dueDate: walkIn.dueDate,
      items: walkIn.items,
      roundOffEnabled: false,
      paidAmount: walkIn.paidAmount,
      paymentMode: walkIn.paymentMode,
      notes: walkIn.notes,
      terms: walkIn.terms,
      reverseCharge: false,
      isTotalMode: false,
      createdAt: walkIn.createdAt,
      preserveStoredTax: true,
      storedIsInterState: true,
    };

    for (const partyStateCode of ["", MH]) {
      const rebuilt = buildInvoiceDocument({
        ...rebuildInput,
        partyStateCode,
        placeOfSupply: opened.placeOfSupply,
        shipToStateCode: stateCodeFromPlaceOfSupply(opened.placeOfSupply) || "",
      });
      expect(rebuilt.items[0].igst).toBe(180);
      expect(rebuilt.items[0].cgst).toBe(0);
      expect(rebuilt.items[0].sgst).toBe(0);
      expect(rebuilt.totalIgst).toBe(180);
      expect(rebuilt.totalCgst).toBe(0);
      expect(rebuilt.totalSgst).toBe(0);
      expect(rebuilt.isInterState).toBe(true);
      expect(stateCodeFromPlaceOfSupply(rebuilt.placeOfSupply)).toBe(MH);
    }

    const afterRateEdit = buildInvoiceDocument({
      ...rebuildInput,
      partyStateCode: MH,
      placeOfSupply: opened.placeOfSupply,
      shipToStateCode: MH,
      items: [
        {
          ...walkIn.items[0],
          quantity: 2,
          taxableAmount: 1000,
          igst: 180,
          total: 1180,
        },
      ],
    });
    expect(afterRateEdit.isInterState).toBe(true);
    expect(afterRateEdit.items[0].igst).toBe(360);
    expect(afterRateEdit.items[0].cgst).toBe(0);
    expect(afterRateEdit.items[0].sgst).toBe(0);
  });
});

describe("GSTR-1 B2B vs B2C", () => {
  function gstrInvoice(id: string, partyGstin: string): Invoice {
    return {
      id,
      invoiceNumber: `INV-${id}`,
      type: "tax_invoice",
      status: "paid",
      businessId: "biz-1",
      partyId: id,
      partyName: id,
      partyGstin,
      partyPhone: "",
      date: "2026-04-10",
      dueDate: "2026-04-25",
      items: [],
      subtotal: 100,
      totalDiscount: 0,
      totalTaxable: 100,
      totalCgst: 9,
      totalSgst: 9,
      totalIgst: 0,
      totalTax: 18,
      roundOff: 0,
      grandTotal: 118,
      paidAmount: 118,
      balanceDue: 0,
      paymentMode: "Cash",
      notes: "",
      terms: "",
      placeOfSupply: MH,
      isInterState: false,
      isTotalMode: true,
      createdAt: "2026-04-10T00:00:00.000Z",
      updatedAt: "2026-04-10T00:00:00.000Z",
    };
  }

  it("sends URP and blank GSTIN to B2C, and a valid 15-char GSTIN to B2B", () => {
    expect(isRegisteredGstin("URP")).toBe(false);
    expect(isRegisteredGstin("")).toBe(false);
    expect(isRegisteredGstin("   ")).toBe(false);
    expect(isRegisteredGstin(MH_GSTIN)).toBe(true);
    expect(isRegisteredGstin("ABC")).toBe(false);

    const report = generateGSTRReport(
      [
        gstrInvoice("urp", "URP"),
        gstrInvoice("blank", ""),
        gstrInvoice("registered", MH_GSTIN),
        gstrInvoice("invalid", "27AAAAA0000A1Z0"),
      ],
      "gstr1",
      "2026-04-01",
      "2026-04-30"
    );
    const b2b = report.sections.find((s) => s.section === "B2B");
    const b2c = report.sections.find((s) => s.section === "B2C");
    expect(b2b?.invoices.map((i) => i.id)).toEqual(["registered"]);
    expect(b2c?.invoices.map((i) => i.id).sort()).toEqual(["blank", "invalid", "urp"]);
  });
});

describe("invoice document shape", () => {
  it("stores seller, bill-to, ship-to, POS, HSN, UQC, cess, reverse charge, and INV/CRN/CHL", () => {
    const invoice = buildInvoiceDocument({
      id: "inv-shape",
      invoiceNumber: "INV-2026-0002",
      type: "tax_invoice",
      status: "unpaid",
      businessId: "biz-1",
      sellerGstin: MH_GSTIN,
      sellerStateCode: MH,
      partyId: "party-1",
      partyName: "Buyer",
      partyGstin: MH_GSTIN,
      partyPhone: "9999999999",
      partyAddress: "Pune",
      partyStateCode: MH,
      date: "2026-04-01",
      dueDate: "2026-04-16",
      items: [
        line({
          gstRate: 3,
          isInterState: false,
          rate: 50000,
          quantity: 1,
          hsn: "7108",
          unit: "GM",
          cess: 0,
        }),
      ],
      roundOffEnabled: true,
      paidAmount: 0,
      paymentMode: "",
      notes: "",
      terms: "",
      reverseCharge: false,
      isTotalMode: false,
      createdAt: "2026-04-01T00:00:00.000Z",
    });

    expect(invoice.sellerGstin).toBe(MH_GSTIN);
    expect(invoice.partyGstin).toBe(MH_GSTIN);
    expect(invoice.shipToGstin).toBe(MH_GSTIN);
    expect(invoice.shipToAddress).toBe("Pune");
    expect(invoice.placeOfSupply).toBe(MH);
    expect(invoice.documentType).toBe("INV");
    expect(invoice.reverseCharge).toBe(false);
    expect(invoice.totalCess).toBe(0);
    expect(invoice.roundOff).toBeTypeOf("number");
    expect(invoice.items[0].hsn).toBe("7108");
    expect(invoice.items[0].quantity).toBe(1);
    expect(invoice.items[0].rate).toBe(50000);
    expect(invoice.items[0].taxableAmount).toBe(50000);
    expect(invoice.items[0].cgst).toBeGreaterThan(0);
    expect(invoice.items[0].sgst).toBeGreaterThan(0);
    expect(invoice.items[0].igst).toBe(0);
    expect(invoice.items[0].cess).toBe(0);
    expect(invoice.items[0].uqc).toBe("GM");
  });

  it("maps credit notes to CRN and delivery challans to CHL", () => {
    expect(documentTypeFromInvoiceType("credit_note")).toBe("CRN");
    expect(documentTypeFromInvoiceType("tax_invoice")).toBe("INV");
    expect(documentTypeFromInvoiceType("bill_of_supply")).toBe("INV");
    expect(documentTypeFromInvoiceType("debit_note")).toBe("INV");
    expect(documentTypeFromInvoiceType("delivery_challan")).toBe("CHL");
  });

  it("normalizes blank party GSTIN to URP on the document", () => {
    expect(normalizeGstin("")).toBe("URP");
    const invoice = buildInvoiceDocument({
      id: "inv-walkin",
      invoiceNumber: "INV-2026-0003",
      type: "tax_invoice",
      status: "draft",
      businessId: "biz-1",
      sellerGstin: MH_GSTIN,
      sellerStateCode: MH,
      partyId: "",
      partyName: "Walk-in",
      partyGstin: "",
      partyPhone: "",
      partyAddress: "Counter",
      partyStateCode: MH,
      date: "2026-04-01",
      dueDate: "2026-04-16",
      items: [line({ gstRate: 5, isInterState: false, rate: 100 })],
      roundOffEnabled: false,
      paidAmount: 0,
      paymentMode: "",
      notes: "",
      terms: "",
      reverseCharge: false,
      isTotalMode: false,
      createdAt: "2026-04-01T00:00:00.000Z",
    });
    expect(invoice.partyGstin).toBe("URP");
    expect(invoice.shipToGstin).toBe("URP");
  });
});

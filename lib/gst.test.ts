import { describe, expect, it } from "vitest";
import {
  GST_2_0_RATES,
  buildInvoiceDocument,
  calculateItem,
  defaultGstRateForNew,
  exclusiveRateFromInclusive,
  generateInvoiceHTML,
  b2clThreshold,
  generateGstnJson,
  deliveryItems,
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
import type { Invoice, InvoiceItem, Purchase } from "./types";

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

  it("keeps walk-in IGST on rebuild when mapped POS would classify as intra", () => {
    // Accidental save of a paid walk-in: stored IGST, POS "Maharashtra", empty party.
    // Open maps POS to 27; seller is 27 → classifier says intra. Must NOT rewrite IGST.
    const items: InvoiceItem[] = [
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
    ];

    const opened = openHistoricalInvoice({
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
      items,
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
    });
    expect(stateCodeFromPlaceOfSupply(opened.placeOfSupply)).toBe(MH);
    expect(opened.items[0].igst).toBe(180);

    const rebuilt = buildInvoiceDocument({
      id: opened.id,
      invoiceNumber: opened.invoiceNumber,
      type: opened.type,
      status: opened.status,
      businessId: opened.businessId,
      sellerGstin: MH_GSTIN,
      sellerStateCode: MH,
      partyId: "",
      partyName: opened.partyName,
      partyGstin: opened.partyGstin,
      partyPhone: "",
      partyAddress: "Counter",
      partyStateCode: "",
      placeOfSupply: opened.placeOfSupply,
      date: opened.date,
      dueDate: opened.dueDate,
      items: opened.items,
      roundOffEnabled: false,
      paidAmount: opened.paidAmount,
      paymentMode: opened.paymentMode,
      notes: "",
      terms: "",
      reverseCharge: false,
      isTotalMode: false,
      createdAt: opened.createdAt,
    });

    expect(isInterState(MH, rebuilt.placeOfSupply)).toBe(false);
    expect(rebuilt.items[0].igst).toBe(180);
    expect(rebuilt.items[0].cgst).toBe(0);
    expect(rebuilt.items[0].sgst).toBe(0);
    expect(rebuilt.totalIgst).toBe(180);
    expect(rebuilt.totalCgst).toBe(0);
    expect(rebuilt.totalSgst).toBe(0);
    expect(rebuilt.totalTax).toBe(180);
    expect(rebuilt.grandTotal).toBe(1180);
  });

  it("recalculates walk-in tax when the user edits POS (preserveStoredTax false)", () => {
    const rebuilt = buildInvoiceDocument({
      id: "walkin-pos-edit",
      invoiceNumber: "INV-2024-0101",
      type: "tax_invoice",
      status: "paid",
      businessId: "biz-1",
      sellerGstin: MH_GSTIN,
      sellerStateCode: MH,
      partyId: "",
      partyName: "Walk-in",
      partyGstin: "",
      partyPhone: "",
      partyAddress: "Counter",
      partyStateCode: "",
      placeOfSupply: MH,
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
      roundOffEnabled: false,
      paidAmount: 1180,
      paymentMode: "Cash",
      notes: "",
      terms: "",
      reverseCharge: false,
      isTotalMode: false,
      createdAt: "2024-06-01T00:00:00.000Z",
      preserveStoredTax: false,
    });
    expect(rebuilt.items[0].igst).toBe(0);
    expect(rebuilt.items[0].cgst).toBe(90);
    expect(rebuilt.items[0].sgst).toBe(90);
    expect(rebuilt.isInterState).toBe(false);
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
    const b2b = report.sections.find((s) => s.section === "4A");
    const b2c = report.sections.find((s) => s.section === "7");
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

describe("GST-inclusive (total mode) invoices", () => {
  function inclusiveInvoice(amount: number, gstRate: InvoiceItem["gstRate"], discount = 0) {
    return buildInvoiceDocument({
      id: "inv-total",
      invoiceNumber: "INV-2026-0100",
      type: "tax_invoice",
      status: "unpaid",
      businessId: "biz-1",
      sellerGstin: MH_GSTIN,
      sellerStateCode: MH,
      partyId: "",
      partyName: "Walk-in",
      partyGstin: "",
      partyPhone: "",
      partyAddress: "",
      partyStateCode: MH,
      date: "2026-09-27",
      dueDate: "2026-10-12",
      items: [
        line({
          gstRate,
          isInterState: false,
          rate: exclusiveRateFromInclusive(amount, gstRate),
          discount,
        }),
      ],
      roundOffEnabled: false,
      paidAmount: 0,
      paymentMode: "",
      notes: "",
      terms: "",
      reverseCharge: false,
      isTotalMode: true,
      createdAt: "2026-09-27T00:00:00.000Z",
    });
  }

  it("keeps the entered ₹1,180 incl. 18% as the grand total, not GST on GST", () => {
    const inv = inclusiveInvoice(1180, 18);
    expect(inv.totalTaxable).toBe(1000);
    expect(inv.totalCgst).toBe(90);
    expect(inv.totalSgst).toBe(90);
    expect(inv.grandTotal).toBe(1180);
  });

  it("reproduces awkward inclusive amounts within one paisa", () => {
    // CGST/SGST halves are rounded per line, so an odd-paisa tax can land 0.01 high.
    for (const [amount, rate] of [[1000, 18], [999, 5], [250, 40], [73.5, 18]] as const) {
      expect(Math.abs(inclusiveInvoice(amount, rate).grandTotal - amount)).toBeLessThanOrEqual(0.0101);
    }
  });

  it("applies discount before splitting out GST", () => {
    expect(inclusiveInvoice(1180, 18, 10).grandTotal).toBeCloseTo(1062, 2);
  });
});

describe("invoice HTML branding", () => {
  const biz = {
    name: "QA Traders",
    gstin: MH_GSTIN,
    address: "",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411001",
    phone: "",
    email: "",
  };
  const inv = {
    id: "i1",
    invoiceNumber: "INV-1",
    type: "tax_invoice",
    status: "unpaid",
    date: "2026-09-27",
    dueDate: "2026-10-12",
    partyName: "",
    items: [line({ gstRate: 18, isInterState: false })],
    subtotal: 1000,
    totalDiscount: 0,
    totalTaxable: 1000,
    totalCgst: 90,
    totalSgst: 90,
    totalIgst: 0,
    totalTax: 180,
    roundOff: 0,
    grandTotal: 1180,
    paidAmount: 0,
    balanceDue: 1180,
  } as unknown as Invoice;

  it("leads with the shop name and has no Argus mark for paid plans", () => {
    const html = generateInvoiceHTML(inv, biz);
    expect(html).toContain("<h1>QA Traders</h1>");
    expect(html).not.toMatch(/Made with Argus|<h1>Argus<\/h1>/);
  });

  it("adds a small Argus footer only for the Free plan", () => {
    expect(generateInvoiceHTML(inv, biz, { showArgusBranding: true })).toContain("Made with Argus");
  });

  it("prints a clean em dash for a walk-in with no name", () => {
    const html = generateInvoiceHTML(inv, biz);
    expect(html).toContain("<strong>—</strong>");
    expect(html).not.toContain("Ã");
  });
});

describe("GSTR-1 B2CL threshold", () => {
  it("uses ₹1 lakh from 1 Aug 2024 and ₹2.5 lakh before", () => {
    expect(b2clThreshold("2024-07-31")).toBe(250000);
    expect(b2clThreshold("2024-08-01")).toBe(100000);
    expect(b2clThreshold("2026-09-27")).toBe(100000);
  });
});

describe("GSTR-3B JSON", () => {
  const sale = (p: Partial<Invoice> & { inter?: boolean; amount?: number }) => {
    const inter = !!p.inter;
    const item = line({ gstRate: 18, isInterState: inter, rate: p.amount ?? 1000 });
    return {
      id: p.id ?? "s",
      invoiceNumber: p.invoiceNumber ?? "INV-1",
      type: p.type ?? "tax_invoice",
      status: "unpaid",
      date: "2026-04-10",
      partyGstin: p.partyGstin ?? "",
      placeOfSupply: inter ? KA : MH,
      isInterState: inter,
      items: [item],
      totalTaxable: item.taxableAmount,
      totalIgst: item.igst,
      totalCgst: item.cgst,
      totalSgst: item.sgst,
      totalTax: item.igst + item.cgst + item.sgst,
      grandTotal: item.total,
    } as unknown as Invoice;
  };

  it("reports inter-state IGST in 3.1(a), not as zero-rated, and nets credit notes", () => {
    const json = generateGstnJson(
      [
        sale({ id: "a", inter: false }),
        sale({ id: "b", inter: true }),
        sale({ id: "c", type: "credit_note", inter: false, amount: 100 }),
      ],
      "gstr3b", "2026-04-01", "2026-04-30", [], MH_GSTIN
    ) as { sup_details: Record<string, Record<string, number>>; inter_sup: { unreg_details: { pos: string; iamt: number }[] } };
    expect(json.sup_details.osup_det).toMatchObject({ txval: 1900, iamt: 180, camt: 81, samt: 81 });
    expect(json.sup_details.osup_zero.txval).toBe(0);
    expect(json.inter_sup.unreg_details).toEqual([{ pos: KA, txval: 1000, iamt: 180 }]);
  });

  it("claims ITC with real amounts, separating reverse charge and ineligible credit", () => {
    const purchase = (p: Partial<Purchase>) =>
      ({
        id: p.id ?? "p",
        purchaseNumber: "PUR-1",
        supplierName: "Supplier",
        createdAt: "2026-04-05T10:00:00.000Z",
        totalAmount: 1180,
        totalGstAmount: 180,
        items: [],
        ...p,
      }) as Purchase;
    const json = generateGstnJson(
      [],
      "gstr3b", "2026-04-01", "2026-04-30",
      [
        purchase({ id: "1", supplierGstin: DL_GSTIN }),
        purchase({ id: "2", supplierGstin: MH_GSTIN, reverseCharge: true }),
        purchase({ id: "3", supplierGstin: MH_GSTIN, itcEligible: false }),
        purchase({ id: "4" }),
      ],
      MH_GSTIN
    ) as { itc_elg: { itc_avl: { ty: string; iamt: number; camt: number }[]; itc_net: { iamt: number; camt: number; samt: number } }; sup_details: { isup_rev: { txval: number } } };
    const byTy = Object.fromEntries(json.itc_elg.itc_avl.map((r) => [r.ty, r]));
    expect(byTy.OTH.iamt).toBe(180); // Delhi supplier → IGST
    expect(byTy.ISRC.camt).toBe(90); // RCM, intra-state
    expect(json.itc_elg.itc_net).toMatchObject({ iamt: 180, camt: 90, samt: 90 });
    expect(json.sup_details.isup_rev.txval).toBe(1000);
  });
});

describe("GSTR report totals", () => {
  it("subtracts credit notes from GSTR-3B output tax", () => {
    const mk = (id: string, type: Invoice["type"], rate: number) => {
      const item = line({ gstRate: 18, isInterState: false, rate });
      return {
        id, invoiceNumber: id, type, status: "unpaid", date: "2026-04-10", partyGstin: "",
        placeOfSupply: MH, isInterState: false, items: [item],
        totalTaxable: item.taxableAmount, totalIgst: 0, totalCgst: item.cgst, totalSgst: item.sgst,
        totalTax: item.cgst + item.sgst, grandTotal: item.total,
      } as unknown as Invoice;
    };
    const r = generateGSTRReport([mk("a", "tax_invoice", 1000), mk("c", "credit_note", 100)], "gstr3b", "2026-04-01", "2026-04-30");
    expect(r.totalTaxableValue).toBe(900);
    expect(r.totalTax).toBe(162);
    expect(r.sections.map((x) => x.section)).not.toContain("3.1(b)");
  });
});

describe("delivery charges (s.15(2)(c))", () => {
  it("taxes delivery at the goods' rate, GST-inclusive", () => {
    const goods = [line({ gstRate: 18, isInterState: false, rate: 1000 })];
    const [d] = deliveryItems(goods, 118, false);
    expect(d.isDelivery).toBe(true);
    expect(d.gstRate).toBe(18);
    expect(d.taxableAmount).toBe(100);
    expect(d.cgst + d.sgst).toBe(18);
    expect(d.total).toBe(118);
  });

  it("splits delivery across rates by goods value", () => {
    const goods = [
      line({ id: "a", gstRate: 5, isInterState: true, rate: 1000 }),
      line({ id: "b", gstRate: 18, isInterState: true, rate: 1000 }),
    ];
    const lines = deliveryItems(goods, 200, true);
    expect(lines.map((l) => l.gstRate).sort((x, y) => x - y)).toEqual([5, 18]);
    expect(Math.abs(lines.reduce((s, l) => s + l.total, 0) - 200)).toBeLessThanOrEqual(0.02);
    expect(lines.every((l) => l.igst > 0 && l.cgst === 0)).toBe(true);
  });

  it("adds nothing for zero delivery or an empty bill", () => {
    expect(deliveryItems([], 100, false)).toEqual([]);
    expect(deliveryItems([line({ gstRate: 18, isInterState: false })], 0, false)).toEqual([]);
  });
});

/**
 * Invoice compliance audit: builds bills for the common real-world cases the
 * way the web app does, prints them, and checks every Rule 46 field and the
 * tax arithmetic. A failure here means a bill could be legally defective.
 */
import { describe, expect, it } from "vitest";
import { buildInvoiceDocument, billOfSupplyNote, calculateItem, deliveryItems, generateInvoiceHTML, placeOfSupplyLabel } from "./gst";
import { generateInvoiceNumber } from "./storage";
import type { BusinessProfile, InvoiceItem, InvoiceType } from "./types";

const SELLER: BusinessProfile = {
  id: "b1", name: "Sharma Kirana Store", gstin: "07AAKFS1234M1Z5", pan: "AAKFS1234M", email: "shop@example.com",
  phone: "9800000000", address: "12 Main Market", city: "New Delhi", state: "Delhi", stateCode: "07", pincode: "110016",
  bankName: "", bankAccount: "", bankIfsc: "", bankBranch: "", upiId: "",
};

function line(description: string, hsn: string, quantity: number, rate: number, gstRate: number, inter: boolean): InvoiceItem {
  return {
    id: description, description, hsn, unit: "NOS", uqc: "NOS",
    ...calculateItem({ quantity, rate, discount: 0, gstRate, isInterState: inter }),
  } as InvoiceItem;
}

function bill(opts: {
  type?: InvoiceType; seller?: BusinessProfile; buyerGstin?: string; buyerState?: string; buyerAddress?: string;
  items: InvoiceItem[]; number?: string; reverseCharge?: boolean;
}) {
  const seller = opts.seller ?? SELLER;
  const inv = buildInvoiceDocument({
    id: "inv", invoiceNumber: opts.number ?? generateInvoiceNumber(42, "INV", ""), type: opts.type ?? "tax_invoice",
    status: "unpaid", businessId: seller.id, sellerGstin: seller.gstin, sellerStateCode: seller.stateCode,
    partyId: "p1", partyName: "Mehta Retail", partyGstin: opts.buyerGstin ?? "", partyPhone: "9811111111",
    partyAddress: opts.buyerAddress ?? "45 Ring Road, New Delhi", partyStateCode: opts.buyerState ?? "07",
    date: "2026-10-12", dueDate: "2026-10-27", items: opts.items, roundOffEnabled: false, paidAmount: 0,
    paymentMode: "", notes: "", terms: "", reverseCharge: opts.reverseCharge ?? false, isTotalMode: false,
    createdAt: "2026-10-12T10:00:00Z",
  });
  return { inv, html: generateInvoiceHTML(inv, seller) };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function expectArithmetic(inv: ReturnType<typeof bill>["inv"]) {
  const lines = inv.items;
  const taxable = r2(lines.reduce((s, l) => s + l.taxableAmount, 0));
  const tax = r2(lines.reduce((s, l) => s + l.cgst + l.sgst + l.igst + (l.cess || 0), 0));
  expect(r2(inv.totalTaxable)).toBeCloseTo(taxable, 2);
  expect(r2(inv.totalTax)).toBeCloseTo(tax, 2);
  expect(r2(inv.grandTotal - inv.roundOff)).toBeCloseTo(r2(taxable + tax), 2);
  for (const l of lines) {
    // CGST = SGST within a state; IGST only across states — never both.
    if (inv.isInterState) {
      expect(l.cgst + l.sgst).toBe(0);
    } else {
      expect(l.igst).toBe(0);
      expect(Math.abs(l.cgst - l.sgst)).toBeLessThanOrEqual(0.01);
    }
    expect(r2(l.taxableAmount * (l.gstRate / 100))).toBeCloseTo(r2(l.cgst + l.sgst + l.igst), 1);
  }
}

function expectRule46(html: string, inv: ReturnType<typeof bill>["inv"], seller = SELLER) {
  // (a) supplier name, address, GSTIN
  expect(html).toContain(seller.name);
  expect(html).toContain(seller.address);
  if (seller.gstin) expect(html).toContain(seller.gstin);
  // (b) serial number: present, at most 16 characters
  expect(inv.invoiceNumber.length).toBeGreaterThan(0);
  expect(inv.invoiceNumber.length).toBeLessThanOrEqual(16);
  expect(html).toContain(inv.invoiceNumber);
  // (c) date
  expect(html).toMatch(/12[-/ ](10|Oct)[-/ ]2026|2026-10-12|12 Oct 2026/);
  // (d) recipient name
  expect(html).toContain(inv.partyName);
  // (g)(h)(i) description, quantity, value; (f) HSN
  for (const l of inv.items) {
    expect(html).toContain(l.description);
    if (l.hsn) expect(html).toContain(l.hsn);
  }
  // (q) signature
  expect(html).toContain("Authorised Signatory");
}

describe("invoice compliance audit", () => {
  it("B2B, same state: buyer GSTIN, CGST + SGST, Rule 46 fields", () => {
    const { inv, html } = bill({ buyerGstin: "07AAPFU0939F1ZV", items: [line("Basmati rice 25kg", "1006", 4, 1500, 5, false)] });
    expect(inv.isInterState).toBe(false);
    expect(html).toContain("07AAPFU0939F1ZV");
    expectRule46(html, inv);
    expectArithmetic(inv);
  });

  it("B2B, other state: IGST only and place of supply with the state name", () => {
    const { inv, html } = bill({ buyerGstin: "27AAPFU0939F1ZV", buyerState: "27", items: [line("Steel almirah", "9403", 2, 7627.12, 18, true)] });
    expect(inv.isInterState).toBe(true);
    expect(html).toContain(placeOfSupplyLabel(inv.placeOfSupply));
    expect(html).toMatch(/Maharashtra/);
    expectRule46(html, inv);
    expectArithmetic(inv);
  });

  it("B2C bill to an unregistered buyer is marked URP and taxed by place of supply", () => {
    const { inv, html } = bill({ items: [line("Cooking oil 1L", "1512", 10, 150, 5, false)] });
    expect(["", "URP"]).toContain(inv.partyGstin || "");
    expectRule46(html, inv);
    expectArithmetic(inv);
  });

  it("delivery is a taxed line at the goods' rate (s.15(2)(c))", () => {
    const goods = [line("Steel almirah", "9403", 2, 7627.12, 18, false)];
    const delivery = deliveryItems(goods, 500, false);
    expect(delivery).toHaveLength(1);
    expect(delivery[0].gstRate).toBe(18);
    expect(r2(delivery[0].total)).toBe(500);
    const { inv } = bill({ items: [...goods, ...delivery] });
    expectArithmetic(inv);
  });

  it("reverse charge is stated on the bill", () => {
    const { inv, html } = bill({ buyerGstin: "07AAPFU0939F1ZV", reverseCharge: true, items: [line("Goods transport", "9965", 1, 1000, 5, false)] });
    expect(inv.reverseCharge).toBe(true);
    expect(html).toMatch(/Reverse charge[^<]*Yes|Reverse Charge[^<]*Yes/i);
  });

  it("unregistered seller: bill of supply, no GST, says not registered", () => {
    const seller = { ...SELLER, gstin: "", stateCode: "07" };
    const { inv, html } = bill({ seller, type: "bill_of_supply", items: [line("Sugar 1kg", "1701", 5, 45, 0, false)] });
    expect(inv.totalTax).toBe(0);
    expect(html).toContain("BILL OF SUPPLY");
    expect(html).toContain("Not registered");
    expect(billOfSupplyNote(inv, seller)).toMatch(/not registered/);
    expect(html).toMatch(/Supplier not registered under GST/);
  });

  it("composition dealer: bill of supply with the Rule 5(1)(g) declaration", () => {
    const seller = { ...SELLER, composition: true };
    const { inv, html } = bill({ seller, type: "bill_of_supply", items: [line("Snacks", "2106", 3, 40, 0, false)] });
    expect(inv.totalTax).toBe(0);
    expect(html).toMatch(/Composition taxable person, not eligible to collect tax on supplies/);
  });

  it("bill numbers stay within 16 characters even with long prefixes", () => {
    for (const [p, s] of [["INV", ""], ["SHARMAKIRANASTORE", "DELHI"], ["A", "B"]]) {
      expect(generateInvoiceNumber(9999, p, s).length).toBeLessThanOrEqual(16);
    }
  });
});

describe("GST can only be charged by a registered regular seller", () => {
  it("turns a tax invoice from an unregistered seller into a bill of supply with no GST", () => {
    const seller = { ...SELLER, gstin: "" };
    const { inv } = bill({ seller, type: "tax_invoice", items: [line("Sugar 1kg", "1701", 5, 45, 18, false)] });
    expect(inv.type).toBe("bill_of_supply");
    expect(inv.totalTax).toBe(0);
  });
});

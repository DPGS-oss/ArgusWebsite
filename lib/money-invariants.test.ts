/**
 * Randomised checks over thousands of bills: the rules every bill must obey,
 * whatever mix of rates, quantities, discounts, delivery and round-off it has.
 * Also checks that saving a bill again never changes its money, and that a
 * phone bill arriving by sync keeps the phone's figures to the paisa.
 */
import { describe, expect, it } from "vitest";
import { buildInvoiceDocument, calculateItem, deliveryItems } from "./gst";
import { linePaise, toPaise } from "./money";
import type { Invoice, InvoiceItem } from "./types";
import phoneSync from "../functions/_shared/phone_sync.js";

const { phoneToWebInvoice } = phoneSync as unknown as { phoneToWebInvoice: (p: unknown) => Invoice };

function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
}
const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];
const RATES = [0, 3, 5, 18, 40];
const SELLER = "07AAKFS1234M1ZZ";

function randomBill(r: () => number, n: number): Invoice {
  const inter = r() < 0.3;
  const goods: InvoiceItem[] = Array.from({ length: 1 + Math.floor(r() * 5) }, (_, k) => ({
    id: `l${k}`, description: `Item ${k}`, hsn: "9403", unit: "NOS", uqc: "NOS",
    ...calculateItem({
      quantity: pick(r, [1, 2, 3, 7, 0.5, 2.75, 12, 250, 1000]),
      rate: Math.round(r() * 2500000) / 100,
      discount: pick(r, [0, 0, 5, 10, 12.5]),
      gstRate: pick(r, RATES),
      isInterState: inter,
    }),
  } as InvoiceItem));
  const delivery = r() < 0.4 ? deliveryItems(goods, Math.round(r() * 50000) / 100, inter) : [];
  return buildInvoiceDocument({
    id: `b${n}`, invoiceNumber: `INV/26-27/W${n}`, type: "tax_invoice", status: "unpaid", businessId: "b1",
    sellerGstin: SELLER, sellerStateCode: "07", partyId: "p", partyName: "Mehta Retail", partyGstin: "",
    partyPhone: "", partyAddress: "", partyStateCode: inter ? "27" : "07", date: "2026-10-12", dueDate: "2026-10-12",
    items: [...goods, ...delivery], roundOffEnabled: r() < 0.7, paidAmount: 0, paymentMode: "", notes: "", terms: "",
    reverseCharge: false, isTotalMode: false, createdAt: "", preserveStoredTax: false,
  });
}

function expectSound(inv: Invoice) {
  const lines = inv.items;
  const sum = (f: (l: InvoiceItem) => number) => lines.reduce((s, l) => s + toPaise(f(l)), 0);
  // Bill total = lines + round-off; tax = CGST + SGST + IGST (+ cess).
  expect(toPaise(inv.grandTotal)).toBe(sum((l) => l.total) + toPaise(inv.roundOff));
  expect(toPaise(inv.totalTaxable)).toBe(sum((l) => l.taxableAmount));
  expect(toPaise(inv.totalTax)).toBe(sum((l) => l.cgst + l.sgst + l.igst + (l.cess || 0)));
  expect(Math.abs(toPaise(inv.roundOff))).toBeLessThanOrEqual(50);
  for (const l of lines) {
    const tax = toPaise(l.cgst) + toPaise(l.sgst) + toPaise(l.igst);
    // A synced delivery line can combine several parts at one rate, each within a paisa.
    expect(Math.abs(tax - (toPaise(l.taxableAmount) * l.gstRate) / 100)).toBeLessThanOrEqual(l.isDelivery ? 2 : 1);
    expect(toPaise(l.total)).toBe(toPaise(l.taxableAmount) + tax + toPaise(l.cess || 0));
    if (inv.isInterState) expect(toPaise(l.cgst) + toPaise(l.sgst)).toBe(0);
    else {
      expect(toPaise(l.igst)).toBe(0);
      expect(Math.abs(toPaise(l.cgst) - toPaise(l.sgst))).toBeLessThanOrEqual(1);
    }
  }
}

describe("every bill obeys the money rules", () => {
  it("3,000 random bills", () => {
    const r = rng(2026);
    for (let n = 0; n < 3000; n++) expectSound(randomBill(r, n));
  });

  it("saving a bill again never changes its money", () => {
    const r = rng(7);
    for (let n = 0; n < 1000; n++) {
      const bill = randomBill(r, n);
      const again = buildInvoiceDocument({
        ...bill, sellerGstin: SELLER, sellerStateCode: "07", partyStateCode: bill.isInterState ? "27" : "07",
        roundOffEnabled: bill.roundOff !== 0, storedIsInterState: bill.isInterState, partyAddress: "",
      } as unknown as Parameters<typeof buildInvoiceDocument>[0]);
      expect(again.grandTotal).toBe(bill.grandTotal);
      expect(again.totalTax).toBe(bill.totalTax);
      expect(again.items.map((l) => [l.taxableAmount, l.cgst, l.sgst, l.igst])).toEqual(bill.items.map((l) => [l.taxableAmount, l.cgst, l.sgst, l.igst]));
    }
  });
});

describe("phone bills arriving by sync", () => {
  // The phone's engine (golden-equal to linePaise): prices include GST; delivery
  // is split by line value, the last line taking the remainder.
  function phoneBill(r: () => number, n: number) {
    const inter = r() < 0.3;
    const lines = Array.from({ length: 1 + Math.floor(r() * 4) }, (_, k) => {
      const quantity = pick(r, [1, 3, 7, 250, 1000]);
      const unit_price = Math.round(r() * 300000) / 100;
      const gst_rate = pick(r, RATES);
      const l = linePaise({ quantity, price: unit_price, gstRate: gst_rate, inclusive: true, interState: inter });
      return { name: `Item ${k}`, hsn_code: "9403", quantity, unit_price, gst_rate, l };
    });
    const ship = r() < 0.6 ? Math.round(r() * 80000) : 0;
    const weight = lines.reduce((s, x) => s + x.l.total, 0);
    let allocated = 0, shipTax = 0, shipC = 0, shipS = 0, shipI = 0;
    lines.forEach((x, k) => {
      if (!ship || weight <= 0) return;
      const share = k === lines.length - 1 ? ship - allocated : Math.round((ship * x.l.total) / weight);
      allocated += share;
      const part = linePaise({ quantity: 1, price: share / 100, gstRate: x.gst_rate, inclusive: true, interState: inter });
      shipTax += part.tax; shipC += part.cgst; shipS += part.sgst; shipI += part.igst;
    });
    const tax = lines.reduce((s, x) => s + x.l.tax, 0) + shipTax;
    const total = weight + ship;
    return {
      phone: {
        id: `ph${n}`, invoice_number: `INV/26-27/${n}`, customer_name: "Mehta", status: "pending",
        invoice_date: "2026-10-12", place_of_supply: inter ? "27" : "07", shipping_charges: ship / 100, round_off: 0,
        total_amount: total / 100, total_gst_amount: tax / 100,
        total_cgst: (lines.reduce((s, x) => s + x.l.cgst, 0) + shipC) / 100,
        total_sgst: (lines.reduce((s, x) => s + x.l.sgst, 0) + shipS) / 100,
        total_igst: (lines.reduce((s, x) => s + x.l.igst, 0) + shipI) / 100,
        items: lines.map((x) => ({
          name: x.name, hsn_code: x.hsn_code, quantity: x.quantity, unit_price: x.unit_price, gst_rate: x.gst_rate,
          taxable_value: x.l.taxable / 100, gst_amount: x.l.tax / 100, cgst: x.l.cgst / 100, sgst: x.l.sgst / 100,
          igst: x.l.igst / 100, total: x.l.total / 100,
        })),
      },
      tax, total,
    };
  }

  it("keep the phone's total and GST to the paisa, rate by rate, and survive a web re-save", () => {
    const r = rng(99);
    for (let n = 0; n < 1000; n++) {
      const { phone, tax, total } = phoneBill(r, n);
      const web = phoneToWebInvoice(phone);
      const lineTax = web.items.reduce((s, l) => s + toPaise(l.cgst) + toPaise(l.sgst) + toPaise(l.igst), 0);
      const lineTotal = web.items.reduce((s, l) => s + toPaise(l.total), 0);
      expect(lineTax).toBe(tax);
      expect(lineTotal).toBe(total);
      const resaved = buildInvoiceDocument({
        ...web, sellerGstin: SELLER, sellerStateCode: "07", partyStateCode: web.placeOfSupply, roundOffEnabled: false,
        storedIsInterState: web.isInterState, partyAddress: "",
      } as unknown as Parameters<typeof buildInvoiceDocument>[0]);
      expect(toPaise(resaved.grandTotal)).toBe(total);
      expect(toPaise(resaved.totalTax)).toBe(tax);
      expectSound(resaved);
    }
  });
});

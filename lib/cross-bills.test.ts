/**
 * Cross-check with the Android app: 600 random bills made by the phone's real
 * engine (argus/test/cross_bills_test.dart writes lib/fixtures/phone_bills_cross.json)
 * go through phone sync, a web re-save, the GST check and GSTR-3B. Every paisa
 * of value, GST and each tax head must survive, and no bill may be flagged.
 */
import { describe, expect, it } from "vitest";
import bills from "./fixtures/phone_bills_cross.json";
import { buildInvoiceDocument, withReimbursement } from "./gst";
import { toPaise } from "./money";
import { checkBooks, gstr3b } from "./compliance";
import type { AppData, Invoice } from "./types";
import phoneSync from "../functions/_shared/phone_sync.js";

const { phoneToWebInvoice } = phoneSync as unknown as { phoneToWebInvoice: (p: unknown) => Invoice };
const SELLER = "27AAPFU0939F1ZV";
type PhoneBill = {
  invoice_number: string; total_amount: number; total_gst_amount: number; total_cgst: number; total_sgst: number;
  total_igst: number; round_off: number; shipping_charges: number; shipping_is_reimbursement: boolean;
};
const phone = bills as unknown as PhoneBill[];
const sum = (xs: Invoice["items"], f: (l: Invoice["items"][number]) => number) => xs.reduce((s, l) => s + toPaise(f(l)), 0);

describe("phone bills (real app engine) on the website", () => {
  const web = phone.map((p) => ({ ...phoneToWebInvoice(p), businessId: "b1" }));

  it("keep value, GST and each tax head to the paisa", () => {
    const off: string[] = [];
    web.forEach((w, n) => {
      const p = phone[n];
      const heads = {
        total: [toPaise(w.grandTotal), toPaise(p.total_amount)],
        gst: [sum(w.items, (l) => l.cgst + l.sgst + l.igst), toPaise(p.total_gst_amount)],
        cgst: [sum(w.items, (l) => l.cgst), toPaise(p.total_cgst)],
        sgst: [sum(w.items, (l) => l.sgst), toPaise(p.total_sgst)],
        igst: [sum(w.items, (l) => l.igst), toPaise(p.total_igst)],
      };
      for (const [k, [a, b]] of Object.entries(heads)) if (a !== b) off.push(`${p.invoice_number} ${k}: web ${a} phone ${b}`);
    });
    expect(off).toEqual([]);
  });

  it("survive a web re-save unchanged", () => {
    web.forEach((w, n) => {
      const built = buildInvoiceDocument({
        ...w, sellerGstin: SELLER, sellerStateCode: "27", partyStateCode: w.placeOfSupply, roundOffEnabled: toPaise(w.roundOff || 0) !== 0,
        storedIsInterState: w.isInterState, partyAddress: "",
      } as unknown as Parameters<typeof buildInvoiceDocument>[0]);
      // As the bill form does: the courier reimbursement is added last, rounding the whole bill.
      const again = withReimbursement(built, w.deliveryReimbursement || 0, toPaise(w.roundOff || 0) !== 0);
      expect(toPaise(again.grandTotal), phone[n].invoice_number).toBe(toPaise(phone[n].total_amount));
      expect(toPaise(again.totalTax), phone[n].invoice_number).toBe(toPaise(phone[n].total_gst_amount));
    });
  });

  it("are not flagged by the GST check (tax off, CGST/SGST split)", () => {
    const data = {
      businesses: [{ id: "b1", name: "Shop", gstin: SELLER, stateCode: "27" }], activeBusinessId: "b1",
      invoices: web, parties: [], stock: [], purchases: [], creditNotes: [], debitNotes: [], expenses: [], payments: [],
      khataEntries: [], settings: {},
    } as unknown as AppData;
    const money = checkBooks(data, new Date("2026-10-15T12:00:00Z"), null).filter((i) => /off by|CGST and SGST differ/.test(i.title));
    expect(money.map((i) => i.title)).toEqual([]);
  });

  it("add up in GSTR-3B exactly as the phone's bills do", () => {
    const data = {
      businesses: [{ id: "b1", name: "Shop", gstin: SELLER, stateCode: "27" }], activeBusinessId: "b1",
      invoices: web, parties: [], stock: [], purchases: [], creditNotes: [], debitNotes: [], expenses: [], payments: [],
      khataEntries: [], settings: {},
    } as unknown as AppData;
    const r = gstr3b(data, "2026-10-01", "2026-10-31");
    const p = (f: (b: PhoneBill) => number) => phone.reduce((s, b) => s + toPaise(f(b)), 0);
    expect(toPaise(r.cgst)).toBe(p((b) => b.total_cgst));
    expect(toPaise(r.sgst)).toBe(p((b) => b.total_sgst));
    expect(toPaise(r.igst)).toBe(p((b) => b.total_igst));
  });
});

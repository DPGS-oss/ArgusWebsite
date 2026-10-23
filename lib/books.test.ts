/**
 * The books must always balance, cancelling a bill must clear what the
 * customer owes, and profit must not include GST (it is owed to the
 * government). Checked across many generated bills.
 */
import { describe, expect, it } from "vitest";
import { applyPaymentToInvoice, postExpenseLedger, postInvoiceLedger, postNoteLedger, postPurchaseLedger, profitAndLoss, runningBook, unbalancedPostings } from "./books";
import { buildInvoiceDocument, calculateItem } from "./gst";
import { noteFromBill, creditableOnBill } from "./notes";
import { toPaise } from "./money";
import type { AppData, BusinessProfile, CreditNote, Invoice, InvoiceItem, KhataEntry } from "./types";

const SELLER: BusinessProfile = {
  id: "b1", name: "Sharma Kirana Store", gstin: "07AAKFS1234M1ZZ", pan: "", email: "", phone: "", address: "", city: "",
  state: "Delhi", stateCode: "07", pincode: "", bankName: "", bankAccount: "", bankIfsc: "", bankBranch: "", upiId: "",
};

function data(): AppData {
  return {
    businesses: [SELLER], parties: [], invoices: [], stock: [], activeBusinessId: "b1", invoiceCounter: 1,
    settings: { roundOff: true } as AppData["settings"], khataEntries: [], payments: [], purchases: [], expenses: [],
    creditNotes: [], debitNotes: [],
  } as unknown as AppData;
}

// Small seeded generator so failures can be reproduced.
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
}

function makeBill(id: string, r: () => number, paid: "none" | "full" | "part"): Invoice {
  const rates = [0, 5, 12, 18, 28];
  const items: InvoiceItem[] = Array.from({ length: 1 + Math.floor(r() * 4) }, (_, k) => ({
    id: `${id}-${k}`, description: `Item ${k}`, hsn: "9403", unit: "NOS", uqc: "NOS",
    ...calculateItem({ quantity: 1 + Math.floor(r() * 20), rate: Math.round(r() * 500000) / 100, discount: r() < 0.3 ? 10 : 0, gstRate: rates[Math.floor(r() * rates.length)], isInterState: false }),
  } as InvoiceItem));
  const draft = buildInvoiceDocument({
    id, invoiceNumber: `INV/26-27/W${id.padStart(4, "0")}`, type: "tax_invoice", status: "unpaid", businessId: "b1",
    sellerGstin: SELLER.gstin, sellerStateCode: "07", partyId: "p1", partyName: "Mehta Retail", partyGstin: "",
    partyPhone: "", partyAddress: "", partyStateCode: r() < 0.3 ? "27" : "07", date: "2026-10-12", dueDate: "2026-10-27",
    items, roundOffEnabled: true, paidAmount: 0, paymentMode: "cash", notes: "", terms: "", reverseCharge: false,
    isTotalMode: false, createdAt: "2026-10-12T10:00:00Z", preserveStoredTax: false,
  });
  const paidAmount = paid === "full" ? draft.grandTotal : paid === "part" ? Math.round(draft.grandTotal * 40) / 100 : 0;
  return { ...draft, paidAmount, balanceDue: Math.round((draft.grandTotal - paidAmount) * 100) / 100, status: paid === "full" ? "paid" : "unpaid" };
}

const owed = (entries: KhataEntry[]) =>
  entries.filter((e) => e.accountType === "party" && e.partyKind !== "supplier").reduce((s, e) => s + (e.isCredit ? 1 : -1) * toPaise(e.amount), 0);

describe("books", () => {
  it("every posting balances across 300 generated bills, payments, cancellations and notes", () => {
    const r = rng(42);
    let d = data();
    for (let n = 1; n <= 300; n++) {
      const kind = r();
      const bill = makeBill(String(n), r, kind < 0.3 ? "full" : kind < 0.6 ? "part" : "none");
      d = { ...d, invoices: [...d.invoices, bill] };
      d = postInvoiceLedger(d, bill);
      if (bill.balanceDue > 0 && r() < 0.5) {
        d = applyPaymentToInvoice(d, { id: `pay-${n}`, invoiceId: bill.id, amount: bill.balanceDue, method: r() < 0.5 ? "cash" : "upi", date: "2026-10-13" });
      }
      if (r() < 0.15) {
        const cancelled = { ...bill, status: "cancelled" as const };
        d = { ...d, invoices: d.invoices.map((i) => (i.id === bill.id ? cancelled : i)) };
        d = postInvoiceLedger(d, cancelled);
      } else if (r() < 0.15) {
        const note: CreditNote = {
          id: `cn-${n}`, creditNoteNumber: `CN/26-27/W${n}`, invoiceId: bill.id, customerName: bill.partyName, reason: "Return",
          ...noteFromBill(bill, Math.round(bill.grandTotal * r() * 100) / 100), notes: "", status: "active", createdAt: "", updatedAt: "",
        };
        d = { ...d, creditNotes: [...(d.creditNotes || []), note] };
        d = postNoteLedger(d, note, "credit_note");
      }
    }
    expect(unbalancedPostings(d.khataEntries)).toEqual([]);
  });

  it("cancelling a bill clears what the customer owes and keeps the record", () => {
    let d = data();
    const bill = makeBill("7", rng(7), "none");
    d = postInvoiceLedger({ ...d, invoices: [bill] }, bill);
    expect(owed(d.khataEntries)).toBe(toPaise(bill.grandTotal));
    const cancelled = { ...bill, status: "cancelled" as const };
    d = postInvoiceLedger({ ...d, invoices: [cancelled] }, cancelled);
    d = postInvoiceLedger(d, cancelled); // twice: still reversed once
    expect(owed(d.khataEntries)).toBe(0);
    expect(d.khataEntries.filter((e) => e.sourceType === "invoice").length).toBeGreaterThan(0);
    expect(d.khataEntries.filter((e) => e.sourceType === "invoice_cancel").length).toBe(d.khataEntries.filter((e) => e.sourceType === "invoice").length);
    expect(unbalancedPostings(d.khataEntries)).toEqual([]);
  });

  it("re-saving a bill after a payment does not count the payment twice", () => {
    let d = data();
    const bill = makeBill("9", rng(9), "none");
    d = postInvoiceLedger({ ...d, invoices: [bill] }, bill);
    d = applyPaymentToInvoice(d, { id: "pay", invoiceId: bill.id, amount: bill.grandTotal, method: "cash", date: "2026-10-13" });
    const paidBill = d.invoices[0];
    d = postInvoiceLedger(d, paidBill);
    expect(owed(d.khataEntries)).toBe(0);
    const cash = runningBook(d.khataEntries, "cash");
    expect(toPaise(cash[cash.length - 1].runningBalance)).toBe(toPaise(bill.grandTotal));
  });

  it("profit leaves out GST; GST collected sits in the GST account", () => {
    let d = data();
    const bill = buildInvoiceDocument({
      id: "x", invoiceNumber: "INV/26-27/W0001", type: "tax_invoice", status: "paid", businessId: "b1", sellerGstin: SELLER.gstin,
      sellerStateCode: "07", partyId: "", partyName: "Walk-in", partyGstin: "", partyPhone: "", partyAddress: "", partyStateCode: "07",
      date: "2026-10-12", dueDate: "2026-10-12", roundOffEnabled: false, paidAmount: 118, paymentMode: "cash", notes: "", terms: "",
      reverseCharge: false, isTotalMode: false, createdAt: "", preserveStoredTax: false,
      items: [{ id: "a", description: "Almirah", hsn: "9403", unit: "NOS", uqc: "NOS", ...calculateItem({ quantity: 1, rate: 100, discount: 0, gstRate: 18, isInterState: false }) } as InvoiceItem],
    });
    d = { ...d, invoices: [bill], purchases: [{ id: "pu", purchaseNumber: "P1", supplierName: "Wholesaler", supplierGstin: "27AAACC1234F1Z8", totalAmount: 118, totalGstAmount: 18, items: [], createdAt: "", updatedAt: "", paidAmount: 118, paymentMethod: "cash" } as unknown as AppData["purchases"][number]] };
    d = postPurchaseLedger(postInvoiceLedger(d, bill), d.purchases[0]);
    expect(profitAndLoss(d)).toEqual({ sales: 100, cogs: 100, expenses: 0, profit: 0 });
    const gst = d.khataEntries.filter((e) => e.accountType === "gst").reduce((s, e) => s + (e.isCredit ? -1 : 1) * e.amount, 0);
    expect(gst).toBe(0); // 18 collected − 18 paid
    d = postExpenseLedger(d, { id: "e", amount: 10, category: "Rent", description: "", date: "2026-10-12", paymentMode: "cash" } as unknown as AppData["expenses"][number]);
    expect(unbalancedPostings(d.khataEntries)).toEqual([]);
  });

  it("a credit note keeps each line's GST rate and cannot exceed the bill", () => {
    const bill = makeBill("11", rng(11), "none");
    const note = noteFromBill(bill, bill.grandTotal / 2);
    expect(Math.abs(toPaise(note.totalAmount) - toPaise(bill.grandTotal / 2))).toBeLessThanOrEqual(1);
    for (const l of note.items) {
      expect(Math.abs(toPaise(l.cgst + l.sgst + l.igst) - (toPaise(l.taxableAmount) * l.gstRate) / 100)).toBeLessThanOrEqual(1);
    }
    const d = { ...data(), invoices: [bill], creditNotes: [{ id: "c", invoiceId: bill.id, totalAmount: bill.grandTotal / 2, status: "active" } as CreditNote] };
    expect(creditableOnBill(d, bill)).toBeCloseTo(bill.grandTotal / 2, 1);
  });
});

describe("what a customer still owes on a bill", () => {
  it("falls with payments and credit notes, rises with debit notes, and cancelled notes do not count", async () => {
    const { withBalance } = await import("./notes");
    const bill = { ...makeBill("21", rng(21), "none"), grandTotal: 1180, paidAmount: 0, balanceDue: 1180, status: "unpaid" } as Invoice;
    const cn = (amount: number, status = "active") => ({ id: `c${amount}${status}`, invoiceId: bill.id, totalAmount: amount, status }) as CreditNote;
    expect(withBalance({ creditNotes: [cn(180)], debitNotes: [] }, bill).balanceDue).toBe(1000);
    expect(withBalance({ creditNotes: [cn(180, "cancelled")], debitNotes: [] }, bill).balanceDue).toBe(1180);
    const settled = withBalance({ creditNotes: [cn(180)], debitNotes: [] }, { ...bill, paidAmount: 1000 });
    expect(settled.balanceDue).toBe(0);
    expect(settled.status).toBe("paid");
    const more = withBalance({ creditNotes: [], debitNotes: [{ id: "d", invoiceId: bill.id, totalAmount: 118, status: "active" } as never] }, { ...bill, paidAmount: 1180, status: "paid" });
    expect(more.balanceDue).toBe(118);
    expect(more.status).toBe("unpaid");
  });
});

describe("profit with stock", () => {
  it("cost of goods sold = opening stock + purchases − closing stock", async () => {
    const { recordMoves, MAIN_GODOWN } = await import("./stock");
    let d = { ...data(), stock: [{ id: "s", name: "Almirah", hsn: "9403", unit: "NOS", openingStock: 0, currentStock: 0, minStock: 0, rate: 150, gstRate: 18 }] } as unknown as AppData;
    // Bought 10 at ₹100 (+18% GST, claimable); sold 4 at ₹150 before GST.
    d = { ...d, purchases: [{ id: "pu", purchaseNumber: "P1", supplierName: "W", supplierGstin: "07AAPFU0939F1ZX", totalAmount: 1180, totalGstAmount: 180, items: [], createdAt: "2026-10-01", paidAmount: 1180 } as unknown as AppData["purchases"][number]] };
    d = recordMoves(d, [
      { itemId: "s", date: "2026-10-01", kind: "purchase", qty: 10, godown: MAIN_GODOWN, unitCost: 100, refId: "pu" },
      { itemId: "s", date: "2026-10-02", kind: "sale", qty: -4, godown: MAIN_GODOWN },
    ]);
    d = { ...d, invoices: [{ id: "i", status: "paid", grandTotal: 708, totalTax: 108 } as unknown as Invoice] };
    expect(profitAndLoss(d)).toEqual({ sales: 600, cogs: 400, expenses: 0, profit: 200 });
  });

  it("goods received without a purchase bill still count as bought (profit is not inflated)", async () => {
    const { recordMoves, MAIN_GODOWN } = await import("./stock");
    let d = { ...data(), stock: [{ id: "s", name: "Almirah", hsn: "9403", unit: "NOS", openingStock: 0, currentStock: 0, minStock: 0, rate: 150, gstRate: 18 }] } as unknown as AppData;
    d = recordMoves(d, [
      { itemId: "s", date: "2026-10-01", kind: "purchase", qty: 10, godown: MAIN_GODOWN, unitCost: 100 },
      { itemId: "s", date: "2026-10-02", kind: "sale", qty: -4, godown: MAIN_GODOWN },
    ]);
    d = { ...d, invoices: [{ id: "i", status: "paid", grandTotal: 708, totalTax: 108 } as unknown as Invoice] };
    expect(profitAndLoss(d)).toEqual({ sales: 600, cogs: 400, expenses: 0, profit: 200 });
  });
});

describe("expenses in the books", () => {
  it("rent with claimable GST posts balanced entries; salary too; profit counts rent without the GST claimed back", async () => {
    const { postExpenseLedger, unbalancedPostings, profitAndLoss } = await import("./books");
    const base = { businesses: [{ id: "b", gstin: "27AAPFU0939F1ZV" }], activeBusinessId: "b", invoices: [], purchases: [], creditNotes: [], debitNotes: [], khataEntries: [], stock: [] } as any;
    const rent = { id: "r", category: "Rent", description: "May", amount: 29500, date: "2025-05-01", paymentMode: "Bank Transfer", vendor: "Landlord", vendorGstin: "27AAPFU0939F1ZV", gstAmount: 4500, isGstClaimable: true, createdAt: "", updatedAt: "" };
    const salary = { ...rent, id: "s", category: "Salaries", amount: 15000, gstAmount: 0, isGstClaimable: false, vendorGstin: undefined, paymentMode: "Cash" };
    let d = postExpenseLedger(base, rent as any);
    d = postExpenseLedger(d, salary as any);
    expect(unbalancedPostings(d.khataEntries)).toEqual([]);
    expect(d.khataEntries.find((k: any) => k.sourceId === "r" && k.accountType === "bank")?.amount).toBe(29500);
    expect(d.khataEntries.find((k: any) => k.sourceId === "r" && k.accountType === "gst")?.amount).toBe(4500);
    expect(profitAndLoss({ ...d, expenses: [rent, salary] } as any).expenses).toBe(25000 + 15000);
  });
});

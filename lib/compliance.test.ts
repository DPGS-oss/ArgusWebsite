import { describe, expect, it } from "vitest";
import { checkBooks } from "./compliance";
import { mergeData } from "./cloud-sync";
import { getDefaultData } from "./storage";
import type { AppData, Invoice, Purchase } from "./types";
import { gstr3b } from "./compliance";

function invoice(partial: Partial<Invoice>): Invoice {
  return {
    id: partial.invoiceNumber || "x",
    invoiceNumber: "INV-1",
    date: "2026-05-10",
    status: "unpaid",
    placeOfSupply: "27",
    totalTax: 18,
    grandTotal: 118,
    totalCgst: 9,
    totalSgst: 9,
    totalIgst: 0,
    items: [{ hsn: "8471", gstRate: 18 }],
    ...partial,
  } as Invoice;
}

function books(invoices: Invoice[]): AppData {
  return { ...getDefaultData(), invoices };
}

describe("checkBooks", () => {
  it("flags both a short HSN and an old GST rate on the same bill", () => {
    const issues = checkBooks(
      books([invoice({ partyGstin: "27AAPFU0939F1ZV", items: [{ hsn: "12", gstRate: 12 }] as Invoice["items"] })])
    );
    const titles = issues.map((i) => i.title);
    expect(titles.some((t) => t.startsWith("HSN too short"))).toBe(true);
    expect(titles).toContain("Old GST rate on a new bill");
  });

  it("allows the same invoice number in different financial years", () => {
    const issues = checkBooks(
      books([
        invoice({ id: "a", invoiceNumber: "INV-1", date: "2025-12-01" }),
        invoice({ id: "b", invoiceNumber: "INV-1", date: "2026-04-02" }),
      ])
    );
    expect(issues.find((i) => i.title === "Duplicate invoice number")).toBeUndefined();
  });

  it("flags duplicates within one financial year", () => {
    const issues = checkBooks(
      books([
        invoice({ id: "a", invoiceNumber: "INV-1", date: "2026-04-02" }),
        invoice({ id: "b", invoiceNumber: "inv-1", date: "2027-03-30" }),
      ])
    );
    const dup = issues.find((i) => i.title === "Duplicate invoice number");
    expect(dup?.detail).toContain("INV-1");
  });
});

describe("mergeData", () => {
  it("keeps debit notes and payroll through a cloud merge", () => {
    const local = {
      ...getDefaultData(),
      debitNotes: [{ id: "dn1", debitNoteNumber: "DN-2026-001" }],
      payroll: [{ id: "p1", employeeName: "Asha" }],
    } as unknown as AppData;
    const cloud = { ...getDefaultData(), payroll: [{ id: "p2", employeeName: "Ravi" }] } as unknown as AppData;
    const merged = mergeData(local, cloud);
    expect(merged.debitNotes.map((d) => d.id)).toEqual(["dn1"]);
    expect(merged.payroll.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
  });
});

describe("checkBooks: Indian GST rules", () => {
  const today = new Date("2026-09-28T00:00:00");
  const titles = (d: AppData) => checkBooks(d, today).map((i) => i.title);

  it("does not demand HSN on small B2C bills (turnover up to ₹5 crore)", () => {
    const d = books([invoice({ partyGstin: "", items: [{ hsn: "", gstRate: 18 }] as Invoice["items"] })]);
    expect(titles(d).some((t) => t.startsWith("HSN too short"))).toBe(false);
  });

  it("catches a buyer GSTIN with a bad check digit", () => {
    const d = books([invoice({ partyGstin: "27AAPFU0939F1ZX" })]);
    expect(titles(d)).toContain("Buyer GSTIN looks wrong");
  });

  it("asks for buyer details on B2C bills above ₹50,000 (Rule 46(e))", () => {
    const d = books([invoice({ partyGstin: "", partyName: "", grandTotal: 60000 })]);
    expect(titles(d)).toContain("Buyer details missing on a large B2C bill");
  });

  it("flags unpaid supplier bills past 180 days for ITC reversal (Rule 37)", () => {
    const purchase = {
      id: "p", purchaseNumber: "PUR-1", supplierName: "S", supplierGstin: "27AAPFU0939F1ZV",
      supplierInvoiceDate: "2026-01-10", createdAt: "2026-01-10", totalAmount: 1180, totalGstAmount: 180,
      paidAmount: 0, items: [],
    } as unknown as Purchase;
    const d = { ...books([]), purchases: [purchase] } as AppData;
    expect(titles(d)).toContain("Unpaid supplier bill past 180 days");
    const paid = { ...d, purchases: [{ ...purchase, paidAmount: 1180 }] } as AppData;
    expect(titles(paid)).not.toContain("Unpaid supplier bill past 180 days");
  });

  it("rejects credit notes after the Section 34 deadline", () => {
    const original = invoice({ id: "o", invoiceNumber: "INV-9", date: "2024-06-01" });
    const d = {
      ...books([original]),
      creditNotes: [{
        id: "c", creditNoteNumber: "CN-1", invoiceId: "o", customerName: "X", reason: "", items: [],
        subtotal: 100, totalGstAmount: 18, totalAmount: 118, notes: "", status: "active",
        createdAt: "2025-12-15T00:00:00.000Z", updatedAt: "",
      }],
    } as AppData;
    expect(titles(d)).toContain("Credit note after the Section 34 deadline");
  });
});

describe("gstr3b period summary", () => {
  it("only counts the chosen month and computes cash payable", () => {
    const d = books([
      invoice({ id: "a", invoiceNumber: "A", date: "2026-05-10", totalTaxable: 1000, totalCgst: 90, totalSgst: 90, totalIgst: 0 }),
      invoice({ id: "b", invoiceNumber: "B", date: "2026-06-10", totalTaxable: 5000, totalCgst: 450, totalSgst: 450, totalIgst: 0 }),
    ]);
    const may = gstr3b(d, "2026-05-01", "2026-05-31");
    expect(may.taxable).toBe(1000);
    expect(may.cash).toBe(180);
  });
});

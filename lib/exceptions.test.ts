import { describe, expect, it } from "vitest";
import { exceptionReport } from "./exceptions";
import { getDefaultData } from "./storage";
import type { AppData, Invoice, KhataEntry, Purchase, StockItem } from "./types";

const bill = (id: string, due: string, total: number, extra: Partial<Invoice> = {}) =>
  ({ id, invoiceNumber: id, status: "unpaid", date: due, dueDate: due, grandTotal: total, paidAmount: 0, partyName: "Mehta", items: [], ...extra }) as Invoice;

describe("exception report", () => {
  it("finds negative stock, negative cash, late dues, overpayment, old supplier bills and old drafts", () => {
    const d: AppData = {
      ...getDefaultData(),
      stock: [{ id: "s", name: "Sugar", unit: "KG", currentStock: -3 } as StockItem],
      khataEntries: [
        { id: "1", customerId: "", customerName: "Cash", amount: 500, description: "", createdAt: "2026-10-01", isCredit: false, accountType: "cash" },
      ] as KhataEntry[],
      invoices: [
        bill("A", "2026-10-01", 1000),
        bill("B", "2026-06-01", 2000),
        bill("C", "2026-10-10", 500, { paidAmount: 700, status: "paid" }),
        bill("D", "2026-09-01", 100, { status: "draft" }),
        bill("E", "2026-05-01", 100, { status: "paid", paidAmount: 100 }),
      ],
      purchases: [{ id: "p", purchaseNumber: "P1", supplierName: "Wholesaler", supplierInvoiceNumber: "W-9", supplierInvoiceDate: "2026-03-01", totalAmount: 1180, paidAmount: 0, createdAt: "2026-03-01", totalGstAmount: 180, items: [] } as Purchase],
    };
    const titles = exceptionReport(d, "2026-10-15").map((i) => i.title);
    expect(titles).toContain("Sugar: stock below zero (-3 KG)");
    expect(titles.some((t) => t.startsWith("Cash went below zero"))).toBe(true);
    expect(titles).toContain("1 bill 1–30 days late: ₹1000.00");
    expect(titles).toContain("1 bill over 90 days late: ₹2000.00");
    expect(titles).toContain("C: paid ₹200.00 more than the bill");
    expect(titles.some((t) => t.startsWith("Wholesaler (W-9)"))).toBe(true);
    expect(titles).toContain("1 draft bill older than a week");
  });

  it("is empty for tidy books", () => {
    expect(exceptionReport({ ...getDefaultData() }, "2026-10-15")).toEqual([]);
  });
});

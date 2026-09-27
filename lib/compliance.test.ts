import { describe, expect, it } from "vitest";
import { checkBooks } from "./compliance";
import { mergeData } from "./cloud-sync";
import { getDefaultData } from "./storage";
import type { AppData, Invoice } from "./types";

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
    const issues = checkBooks(books([invoice({ items: [{ hsn: "12", gstRate: 12 }] as Invoice["items"] })]));
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

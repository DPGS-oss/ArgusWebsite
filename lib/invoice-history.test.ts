import { describe, expect, it } from "vitest";
import { withHistory } from "./invoice-history";
import type { Invoice } from "./types";

const bill = (over: Partial<Invoice> = {}) =>
  ({ id: "a", invoiceNumber: "INV-2026-0001", status: "unpaid", partyName: "Sharma Traders", date: "2026-10-01",
     placeOfSupply: "07", type: "tax_invoice", items: [], totalTax: 180, grandTotal: 1180, notes: "", ...over }) as unknown as Invoice;

describe("invoice change log (Rule 56)", () => {
  it("logs what changed on an issued bill", () => {
    const after = withHistory(bill(), bill({ grandTotal: 2360, totalTax: 360 }), "2026-10-12T10:00:00Z");
    expect(after.history).toHaveLength(1);
    expect(after.history![0].detail).toMatch(/Total: ₹1,180.00 → ₹2,360.00/);
  });

  it("does not log drafts or unchanged saves", () => {
    expect(withHistory(bill({ status: "draft" }), bill({ status: "draft", grandTotal: 5 })).history).toBeUndefined();
    expect(withHistory(bill(), bill()).history).toBeUndefined();
  });

  it("keeps earlier entries", () => {
    const first = withHistory(bill(), bill({ notes: "x" }), "2026-10-12T10:00:00Z");
    const second = withHistory(first, { ...first, partyName: "Mehta" } as Invoice, "2026-10-12T11:00:00Z");
    expect(second.history).toHaveLength(2);
  });
});

describe("bill numbers (Rule 46)", () => {
  it("one series per financial year, numbered from the bills in it, at most 16 characters", async () => {
    const { generateInvoiceNumber } = await import("./storage");
    const bills = [{ invoiceNumber: "INV/26-27/W0041" }, { invoiceNumber: "INV/26-27/0099" }, { invoiceNumber: "INV/25-26/W0300" }];
    expect(generateInvoiceNumber(bills, "INV", "2026-10-12")).toBe("INV/26-27/W0042");
    // A new financial year starts again at 1 (series change on 1 April).
    expect(generateInvoiceNumber(bills, "INV", "2027-04-01")).toBe("INV/27-28/W0001");
    expect(generateInvoiceNumber(bills, "INV", "2027-03-31")).toBe("INV/26-27/W0042");
    expect(generateInvoiceNumber([], "SHARMAKIRANA", "2026-10-12")).toBe("SHAR/26-27/W0001");
    // Past 9,999 bills the prefix shortens so the number stays within 16 characters, and counting continues.
    expect(generateInvoiceNumber([{ invoiceNumber: "SHAR/26-27/W9999" }], "SHARMAKIRANA", "2026-10-12")).toBe("SHA/26-27/W10000");
    expect(generateInvoiceNumber([{ invoiceNumber: "SHA/26-27/W10000" }], "SHARMAKIRANA", "2026-10-12")).toBe("SHA/26-27/W10001");
  });
});

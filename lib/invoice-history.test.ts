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
  it("never exceed 16 characters", async () => {
    const { generateInvoiceNumber } = await import("./storage");
    expect(generateInvoiceNumber(42, "INV", "")).toMatch(/^INV-\d{4}-0042$/);
    expect(generateInvoiceNumber(42, "SHARMAKIRANA", "DELHI").length).toBeLessThanOrEqual(16);
    expect(generateInvoiceNumber(42, "SK", "D1")).toMatch(/^SK-\d{4}-0042-D1$/);
  });
});

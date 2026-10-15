import { describe, expect, it, afterEach } from "vitest";
import { generateInvoiceNumber, setBillSeries } from "./storage";
import { canOpenView, type TeamBooks } from "./team";

type AppUser = { name: string; email: string; books?: TeamBooks };

describe("each user has their own bill series", () => {
  afterEach(() => setBillSeries(""));

  it("owner and member numbers never collide and stay within 16 characters", () => {
    const bills = [{ invoiceNumber: "INV/26-27/W0007" }, { invoiceNumber: "INV/26-27/WB0002" }, { invoiceNumber: "INV/26-27/0009" }];
    expect(generateInvoiceNumber(bills, "INV", "2026-10-15")).toBe("INV/26-27/W0008");
    setBillSeries("B");
    expect(generateInvoiceNumber(bills, "INV", "2026-10-15")).toBe("INV/26-27/WB0003");
    setBillSeries("C");
    expect(generateInvoiceNumber(bills, "INV", "2026-10-15")).toBe("INV/26-27/WC0001");
    const long = generateInvoiceNumber([{ invoiceNumber: "INVO/26-27/WC9999" }], "INVOICE", "2026-10-15");
    expect(long.length).toBeLessThanOrEqual(16);
  });

  it("billing-only users do not get owner screens", () => {
    const billing = { name: "A", email: "a@x.in", books: { booksUid: "o", role: "member", access: "billing", series: "B" } } as AppUser;
    const full = { ...billing, books: { ...billing.books!, access: "full" } } as AppUser;
    expect(canOpenView("invoices", billing)).toBe(true);
    expect(canOpenView("purchases", billing)).toBe(false);
    expect(canOpenView("gst-returns", billing)).toBe(false);
    expect(canOpenView("purchases", full)).toBe(true);
    expect(canOpenView("purchases", null)).toBe(true);
  });
});

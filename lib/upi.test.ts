import { describe, expect, it } from "vitest";
import { buildUpiPayUri, buildWhatsAppInvoiceText } from "./upi";

describe("UPI collect URI", () => {
  it("builds upi://pay from shop VPA, amount, and invoice number", () => {
    const uri = buildUpiPayUri({
      vpa: "shop@okaxis",
      amount: 1180,
      invoiceNumber: "INV-2026-0001",
    });
    expect(uri).toBe("upi://pay?pa=shop%40okaxis&am=1180.00&tn=INV-2026-0001&cu=INR");
  });

  it("does not emit a pay URI when VPA is missing", () => {
    const base = { amount: 500, invoiceNumber: "INV-1" };
    expect(buildUpiPayUri({ ...base, vpa: "" })).toBeNull();
    expect(buildUpiPayUri({ ...base, vpa: "   " })).toBeNull();
    expect(buildUpiPayUri({ ...base, vpa: undefined })).toBeNull();
    expect(buildUpiPayUri({ ...base, vpa: null })).toBeNull();
  });

  it("encodes amount and invoice number safely", () => {
    const uri = buildUpiPayUri({
      vpa: "my shop@oksbi",
      amount: 99.5,
      invoiceNumber: "INV 2026/0001",
    });
    expect(uri).toMatch(/^upi:\/\/pay\?/);
    expect(uri).toContain("am=99.50");
    expect(uri).toContain("tn=INV%202026%2F0001");
    expect(uri).not.toContain(" ");
    expect(uri).not.toContain("INV 2026/0001");
    expect(uri).toContain("cu=INR");
  });
});

describe("WhatsApp invoice text", () => {
  it("includes the UPI collect URI when the shop has a VPA", () => {
    const text = buildWhatsAppInvoiceText({
      invoiceNumber: "INV-2026-0001",
      businessName: "Demo Shop",
      grandTotalLabel: "₹1,180.00",
      upiUri: "upi://pay?pa=shop%40okaxis&am=1180.00&tn=INV-2026-0001&cu=INR",
    });
    expect(text).toContain("INV-2026-0001");
    expect(text).toContain("upi://pay?pa=shop%40okaxis&am=1180.00&tn=INV-2026-0001&cu=INR");
  });

  it("omits a pay URI when VPA is missing", () => {
    const text = buildWhatsAppInvoiceText({
      invoiceNumber: "INV-2026-0001",
      businessName: "Demo Shop",
      grandTotalLabel: "₹1,180.00",
      upiUri: null,
    });
    expect(text).not.toMatch(/upi:\/\/pay/);
  });
});

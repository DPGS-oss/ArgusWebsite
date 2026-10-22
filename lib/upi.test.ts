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

describe("receipts ask only for what is owed", () => {
  it("no pay link on a paid or cancelled bill; the balance on a part-paid one", async () => {
    const { amountToCollect } = await import("./upi");
    expect(amountToCollect({ status: "paid", grandTotal: 1180, balanceDue: 0, paidAmount: 1180 })).toBe(0);
    expect(amountToCollect({ status: "cancelled", grandTotal: 1180, balanceDue: 1180 })).toBe(0);
    expect(amountToCollect({ status: "unpaid", grandTotal: 1180, balanceDue: 590, paidAmount: 590 })).toBe(590);
    expect(amountToCollect({ status: "unpaid", grandTotal: 1180, balanceDue: 0, paidAmount: 0 })).toBe(1180);
    expect(buildUpiPayUri({ vpa: "shop@upi", amount: 0, invoiceNumber: "INV-1" })).toBeNull();
  });
  it("WhatsApp links carry India's country code for 10-digit numbers", async () => {
    const { buildWhatsAppShareUrl } = await import("./upi");
    expect(buildWhatsAppShareUrl("98200 12345", "hi")).toBe("https://wa.me/919820012345?text=hi");
    expect(buildWhatsAppShareUrl("09820012345", "hi")).toBe("https://wa.me/919820012345?text=hi");
    expect(buildWhatsAppShareUrl("+91 98200 12345", "hi")).toBe("https://wa.me/919820012345?text=hi");
    expect(buildWhatsAppShareUrl("+44 7700 900123", "hi")).toBe("https://wa.me/447700900123?text=hi");
  });
});

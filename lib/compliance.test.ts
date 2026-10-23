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
    expect(titles.some((t) => t.startsWith("Item code (HSN) too short"))).toBe(true);
    expect(titles).toContain("Old GST rate on a new bill");
  });

  it("allows the same invoice number in different financial years", () => {
    const issues = checkBooks(
      books([
        invoice({ id: "a", invoiceNumber: "INV-1", date: "2025-12-01" }),
        invoice({ id: "b", invoiceNumber: "INV-1", date: "2026-04-02" }),
      ])
    );
    expect(issues.find((i) => i.title === "Two bills have the same number")).toBeUndefined();
  });

  it("flags duplicates within one financial year", () => {
    const issues = checkBooks(
      books([
        invoice({ id: "a", invoiceNumber: "INV-1", date: "2026-04-02" }),
        invoice({ id: "b", invoiceNumber: "inv-1", date: "2027-03-30" }),
      ])
    );
    const dup = issues.find((i) => i.title === "Two bills have the same number");
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
    expect(titles(d).some((t) => t.startsWith("Item code (HSN) too short"))).toBe(false);
  });

  it("catches a buyer GSTIN with a bad check digit", () => {
    const d = books([invoice({ partyGstin: "27AAPFU0939F1ZX" })]);
    expect(titles(d)).toContain("Customer's GST number looks wrong");
  });

  it("asks for buyer details on B2C bills above ₹50,000 (Rule 46(e))", () => {
    const d = books([invoice({ partyGstin: "", partyName: "", grandTotal: 60000 })]);
    expect(titles(d)).toContain("Big bill needs the customer's details");
  });

  it("flags unpaid supplier bills past 180 days for ITC reversal (Rule 37)", () => {
    const purchase = {
      id: "p", purchaseNumber: "PUR-1", supplierName: "S", supplierGstin: "27AAPFU0939F1ZV",
      supplierInvoiceDate: "2026-01-10", createdAt: "2026-01-10", totalAmount: 1180, totalGstAmount: 180,
      paidAmount: 0, items: [],
    } as unknown as Purchase;
    const d = { ...books([]), purchases: [purchase] } as AppData;
    expect(titles(d)).toContain("Supplier not paid for over 6 months");
    const paid = { ...d, purchases: [{ ...purchase, paidAmount: 1180 }] } as AppData;
    expect(titles(paid)).not.toContain("Supplier not paid for over 6 months");
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
    expect(titles(d)).toContain("Credit note is too late to lower your GST");
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

describe("legacy double-GST bills", () => {
  const today = new Date("2026-09-29T00:00:00");
  const legacy = {
    isTotalMode: true,
    grandTotal: 1392.4,
    items: [{ hsn: "8471", gstRate: 18, rate: 1180, quantity: 1, discount: 0 }] as Invoice["items"],
  };
  it("flags old total-mode bills with the exact extra amount", () => {
    const issue = checkBooks(books([invoice(legacy)]), today).find((i) => i.title === "This bill may charge GST twice");
    expect(issue?.detail).toContain("₹1180.00");
    expect(issue?.detail).toContain("credit note for ₹212.40");
  });
  it("leaves bills saved after the fix alone", () => {
    const fixed = invoice({
      isTotalMode: true,
      enteredTotal: 1180,
      grandTotal: 1180,
      items: [{ hsn: "8471", gstRate: 18, rate: 1000, quantity: 1, discount: 0 }] as Invoice["items"],
    });
    expect(checkBooks(books([fixed]), today).some((i) => i.title === "This bill may charge GST twice")).toBe(false);
  });
});

describe("checkBooks: maths, numbering and balance", () => {
  const line = (taxable: number, rate: number, cgst: number, sgst: number) =>
    ({ hsn: "9403", gstRate: rate, taxableAmount: taxable, cgst, sgst, igst: 0 }) as Invoice["items"][number];

  it("flags tax that is not the rate on the value, and unequal CGST/SGST", () => {
    const titles = checkBooks(
      books([
        invoice({ invoiceNumber: "INV/26-27/W0001", items: [line(141900, 5, 3550, 3550)] }),
        invoice({ invoiceNumber: "INV/26-27/W0002", items: [line(100, 18, 9.01, 8.99)] }),
      ]),
    ).map((i) => i.title);
    expect(titles).toContain("GST on INV/26-27/W0001 is off by ₹5.00");
    expect(titles).toContain("CGST and SGST differ on INV/26-27/W0002");
    expect(titles.filter((t) => t.startsWith("GST on INV/26-27/W0002"))).toEqual([]);
  });

  it("points out missing bill numbers; cancelled bills fill the gap", () => {
    const gap = checkBooks(books([invoice({ invoiceNumber: "INV/26-27/W0001" }), invoice({ invoiceNumber: "INV/26-27/W0004" })]));
    expect(gap.map((i) => i.title)).toContain("2 bill numbers missing in INV/26-27/W…");
    const filled = checkBooks(
      books([
        invoice({ invoiceNumber: "INV/26-27/W0001" }),
        invoice({ invoiceNumber: "INV/26-27/W0002", status: "cancelled" }),
      ]),
    );
    expect(filled.map((i) => i.title).some((t) => t.includes("missing"))).toBe(false);
  });

  it("flags books that do not balance", () => {
    const d = books([]);
    d.khataEntries = [
      { id: "1", customerId: "", customerName: "Sales", amount: 100, description: "", createdAt: "", isCredit: false, accountType: "sales", sourceType: "invoice", sourceId: "x" },
      { id: "2", customerId: "", customerName: "A", amount: 118, description: "", createdAt: "", isCredit: true, accountType: "party", sourceType: "invoice", sourceId: "x" },
    ];
    expect(checkBooks(d).map((i) => i.title)).toContain("Books don't balance for 1 entry");
  });
});

describe("GST on expenses", () => {
  it("rent with the landlord's GSTIN counts as input credit in GSTR-3B; without it, the GST check asks for it", async () => {
    const { gstr3b, checkBooks } = await import("./compliance");
    const base = {
      businesses: [{ id: "b", name: "Shop", gstin: "27AAPFU0939F1ZV", stateCode: "27" }], activeBusinessId: "b",
      invoices: [], purchases: [], creditNotes: [], debitNotes: [], parties: [], stock: [], settings: {},
    } as any;
    const rent = { id: "r", category: "Rent", description: "May rent", amount: 29500, date: "2025-05-01", paymentMode: "Bank", vendor: "Landlord", gstAmount: 4500, isGstClaimable: true, createdAt: "", updatedAt: "" };
    const withGstin = gstr3b({ ...base, expenses: [{ ...rent, vendorGstin: "27AAPFU0939F1ZV" }] }, "2025-05-01", "2025-05-31");
    expect(withGstin.eligible).toBe(4500);
    const without = { ...base, expenses: [rent] };
    expect(gstr3b(without, "2025-05-01", "2025-05-31").eligible).toBe(0);
    expect(checkBooks(without, new Date("2025-06-05T10:00:00Z"), null).some((i) => /vendor's GST number/.test(i.title))).toBe(true);
  });
});

describe("two GSTINs, one owner", () => {
  it("GSTR-3B counts only the active GSTIN's bills", async () => {
    const { gstr3b } = await import("./compliance");
    const bill = (id: string, businessId: string, tax: number) => ({
      id, invoiceNumber: id, type: "tax_invoice", status: "paid", businessId, date: "2025-11-05", partyGstin: "", placeOfSupply: "27", isInterState: false,
      totalTaxable: 1000, totalCgst: tax / 2, totalSgst: tax / 2, totalIgst: 0, totalTax: tax, grandTotal: 1000 + tax,
      items: [{ description: "x", hsn: "8302", quantity: 1, gstRate: 18, taxableAmount: 1000, cgst: tax / 2, sgst: tax / 2, igst: 0, total: 1000 + tax }],
    });
    const data = {
      businesses: [{ id: "pune", gstin: "27AAPFU0939F1ZV" }, { id: "blr", gstin: "29AAPFU0939F1ZR" }], activeBusinessId: "pune",
      invoices: [bill("a", "pune", 180), bill("b", "blr", 180), bill("c", "", 180)], purchases: [], creditNotes: [], debitNotes: [], expenses: [],
    } as any;
    expect(gstr3b(data, "2025-11-01", "2025-11-30").cgst).toBe(180);
    // a bill with no business (made before one was set) counts with the active one
    expect(gstr3b({ ...data, activeBusinessId: "blr" }, "2025-11-01", "2025-11-30").cgst).toBe(180);
    expect(gstr3b({ ...data, activeBusinessId: "blr", invoices: data.invoices.slice(0, 2) }, "2025-11-01", "2025-11-30").cgst).toBe(90);
  });
});

describe("bill numbers with two GSTINs", () => {
  it("each GSTIN may have INV/26-27/W0001; it is a duplicate only within one GSTIN", async () => {
    const { checkBooks } = await import("./compliance");
    const bill = (id: string, businessId: string, invoiceNumber: string) => ({
      id, invoiceNumber, businessId, type: "tax_invoice", status: "paid", date: "2026-04-02", partyGstin: "", placeOfSupply: "27", isInterState: false,
      totalTaxable: 100, totalCgst: 9, totalSgst: 9, totalIgst: 0, totalTax: 18, grandTotal: 118,
      items: [{ description: "Hinge", hsn: "8302", quantity: 1, gstRate: 18, taxableAmount: 100, cgst: 9, sgst: 9, igst: 0, total: 118 }],
    });
    const base = { businesses: [{ id: "pune", gstin: "27AAPFU0939F1ZV" }, { id: "blr", gstin: "29AAPFU0939F1ZR" }], activeBusinessId: "pune", purchases: [], creditNotes: [], debitNotes: [], expenses: [], settings: {} } as any;
    const dup = (inv: any[]) => checkBooks({ ...base, invoices: inv }, new Date("2026-04-10T10:00:00Z"), null).some((i) => i.title === "Two bills have the same number");
    expect(dup([bill("a", "pune", "INV/26-27/W0001"), bill("b", "blr", "INV/26-27/W0001")])).toBe(false);
    expect(dup([bill("a", "pune", "INV/26-27/W0001"), bill("b", "pune", "INV/26-27/W0001")])).toBe(true);
  });
});

describe("e-way bill warning", () => {
  it("not for jewellery, services or exempt goods; yes for a ₹50,000 almirah order", async () => {
    const { checkBooks } = await import("./compliance");
    const bill = (hsn: string, gstRate: number, total: number) => ({
      id: hsn, invoiceNumber: `INV/25-26/W${hsn}`, type: "tax_invoice", status: "paid", date: "2025-11-05", partyGstin: "", placeOfSupply: "27", isInterState: false,
      totalTaxable: total, totalCgst: 0, totalSgst: 0, totalIgst: 0, totalTax: 0, grandTotal: total,
      items: [{ description: "x", hsn, quantity: 1, gstRate, taxableAmount: total, cgst: 0, sgst: 0, igst: 0, total }],
    });
    const warned = (inv: any) => checkBooks({ businesses: [{ id: "b", gstin: "27AAPFU0939F1ZV" }], activeBusinessId: "b", invoices: [inv], purchases: [], creditNotes: [], debitNotes: [], expenses: [], settings: {} } as any, new Date("2025-11-10T10:00:00Z"), null).some((i) => i.title === "E-way bill number not saved");
    expect(warned(bill("7113", 3, 216000))).toBe(false);
    expect(warned(bill("998713", 18, 60000))).toBe(false);
    expect(warned(bill("0702", 0, 60000))).toBe(false);
    expect(warned(bill("9403", 18, 54000))).toBe(true);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { cancelInvoice, getDefaultData, loadData, saveData, saveInvoice, saveParty } from "./storage";
import { setAuditActor } from "./audit";
import type { Invoice, Party } from "./types";

// Storage keeps the book in memory in a browser; a stand-in window is enough
// here (nothing is written to disk without a signed-in account).
const g = globalThis as unknown as { window?: unknown; document?: unknown };
g.window ??= { addEventListener: () => {} };
g.document ??= { addEventListener: () => {}, visibilityState: "visible" };

describe("edit log", () => {
  beforeEach(() => {
    saveData(getDefaultData());
    setAuditActor({ uid: "u1", name: "Devansh" });
  });

  it("records who added, changed and cancelled a bill, with what changed", () => {
    const bill = { id: "i1", invoiceNumber: "INV/26-27/W0001", status: "unpaid", partyName: "Mehta", grandTotal: 1180, totalTax: 180, date: "2026-10-15", items: [] } as unknown as Invoice;
    saveInvoice(bill);
    saveInvoice({ ...bill, grandTotal: 2360, totalTax: 360 });
    saveInvoice({ ...bill, grandTotal: 2360, totalTax: 360 }); // no change: nothing logged
    cancelInvoice("i1");
    const log = loadData().auditLog || [];
    expect(log.map((e) => e.action)).toEqual(["created", "edited", "cancelled"]);
    expect(log[1].detail).toContain("Total: ₹1,180.00 → ₹2,360.00");
    expect(log.every((e) => e.byName === "Devansh" && e.device === "web" && e.ref === "INV/26-27/W0001")).toBe(true);
  });

  it("records customer changes field by field", () => {
    const p = { id: "p1", name: "Mehta", gstin: "", phone: "", type: "customer" } as unknown as Party;
    saveParty(p);
    saveParty({ ...p, phone: "9811111111" });
    const log = loadData().auditLog || [];
    expect(log[1].detail).toBe("Phone: — → 9811111111");
  });
});

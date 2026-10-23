import { describe, expect, it } from "vitest";
import { mergeData } from "./cloud-sync";
import { getDefaultData } from "./storage";
import type { AppData, Invoice } from "./types";

const inv = (id: string, updatedAt = "2026-09-29T10:00:00Z") => ({ id, invoiceNumber: id, updatedAt }) as unknown as Invoice;

describe("mergeData tombstones", () => {
  it("a bill deleted in this browser is not brought back by the cloud copy", () => {
    const local: AppData = { ...getDefaultData(), invoices: [inv("a")], deleted: { invoices: { b: "2026-09-30T00:00:00Z" } } };
    const cloud: AppData = { ...getDefaultData(), invoices: [inv("a"), inv("b")] };
    const merged = mergeData(local, cloud);
    expect(merged.invoices.map((i) => i.id)).toEqual(["a"]);
    expect(merged.deleted?.invoices?.b).toBeTruthy();
  });

  it("a deletion made elsewhere (phone, other browser) removes the local copy", () => {
    const local: AppData = { ...getDefaultData(), invoices: [inv("a"), inv("b")] };
    const cloud: AppData = { ...getDefaultData(), invoices: [inv("a")], deleted: { invoices: { b: "2026-09-30T00:00:00Z" } } };
    expect(mergeData(local, cloud).invoices.map((i) => i.id)).toEqual(["a"]);
  });
});

describe("bills from the phone made before a business existed", () => {
  it("are attached to the business after merging, so they show in lists and reports", async () => {
    const { mergeData } = await import("./cloud-sync");
    const { getDefaultData } = await import("./storage");
    const local = { ...getDefaultData(), businesses: [{ id: "b1", name: "Shop" }], activeBusinessId: "b1" } as never;
    const cloud = { ...getDefaultData(), invoices: [{ id: "i1", invoiceNumber: "INV/26-27/0001", businessId: "" }] } as never;
    const merged = mergeData(local, cloud);
    expect(merged.invoices[0].businessId).toBe("b1");
  });
});

describe("two browsers, one item", () => {
  it("an older copy in another browser does not undo a change made elsewhere", async () => {
    const { mergeData } = await import("./cloud-sync");
    const { getDefaultData } = await import("./storage");
    const item = { id: "kurta", name: "Designer kurta", hsn: "6211", unit: "NOS", openingStock: 10, currentStock: 10, minStock: 2, rate: 3124, gstRate: 12 };
    // the staff's browser still holds the item as it was in April (no edit time)
    const local = { ...getDefaultData(), stock: [item] } as any;
    // the owner moved it to 18% on 22 September
    const cloud = { ...getDefaultData(), stock: [{ ...item, gstRate: 18, updatedAt: "2025-09-22T05:30:00.000Z" }] } as any;
    expect(mergeData(local, cloud).stock[0].gstRate).toBe(18);
    // neither copy has an edit time (books from before this fix): the shared cloud copy wins
    expect(mergeData(local, { ...cloud, stock: [{ ...item, gstRate: 18 }] }).stock[0].gstRate).toBe(18);
    // a newer edit made in this browser and not yet synced still wins
    const edited = { ...local, stock: [{ ...item, gstRate: 5, updatedAt: "2025-10-01T05:30:00.000Z" }] };
    expect(mergeData(edited, cloud).stock[0].gstRate).toBe(5);
  });
});

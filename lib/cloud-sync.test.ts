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

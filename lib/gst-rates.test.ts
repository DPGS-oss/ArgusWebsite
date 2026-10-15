/**
 * The rate lookup must give, for every code, exactly the options the
 * reference build produced (lib/gst-rate-golden.json, also checked by the
 * Android app), plus the cases a shop meets every day.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { rateOptions, searchCatalog, singleRate, type RateBook } from "./gst-rates";

const book = JSON.parse(readFileSync(join(__dirname, "..", "public", "data", "gst-rates.json"), "utf-8")) as RateBook;
const golden = JSON.parse(readFileSync(join(__dirname, "gst-rate-golden.json"), "utf-8")) as {
  version: string;
  codes: Record<string, { main: [number, boolean][]; special: [number, boolean][] }>;
};

describe("GST rate book", () => {
  it("matches the reference for every code", () => {
    expect(golden.version).toBe(book.version);
    for (const [code, want] of Object.entries(golden.codes)) {
      const got = rateOptions(book, code);
      expect({ main: got.main.map((o) => [o.rate, o.outside]), special: got.special.map((o) => [o.rate, o.outside]) }, code).toEqual(want);
    }
  });

  it.each([
    ["8471", 18], // laptops
    ["8517", 18], // phones
    ["8415", 18], // air conditioners
    ["0401", 0], // fresh milk
    ["3004", 5], // medicines
    ["7108", 3], // gold
    ["2402", 40], // cigarettes (from 1 Feb 2026)
    ["24031921", 18], // biris
    ["9983", 18], // professional services
  ])("%s has one rate: %s%%", (code, rate) => {
    expect(singleRate(book, code)).toBe(rate);
  });

  it("asks when the rate depends on the item, with the condition", () => {
    const shoes = rateOptions(book, "6403").main;
    expect(shoes.map((o) => o.rate)).toEqual([5, 18]);
    expect(shoes[0].notes[0]).toMatch(/not exceeding Rs.?\s?2500/i);
    expect(rateOptions(book, "1006").main.map((o) => o.rate)).toEqual([0, 5]); // loose vs pre-packaged rice
    expect(rateOptions(book, "9963").main.map((o) => o.rate)).toEqual([5, 18]); // restaurants / hotels
    expect(singleRate(book, "6403")).toBeNull();
  });

  it("marks goods outside GST", () => {
    const beer = rateOptions(book, "2203").main;
    expect(beer).toHaveLength(1);
    expect(beer[0].outside).toBe(true);
  });

  it("finds codes by number or words", () => {
    expect(searchCatalog(book, "8471").some((e) => e.c.startsWith("8471"))).toBe(true);
    expect(searchCatalog(book, "sewing machine").length).toBeGreaterThan(0);
  });
});

describe("GST check uses the rate book", () => {
  it("flags a rate the law does not give the code, and asks about special-case rates", async () => {
    const { checkBooks } = await import("./compliance");
    const { getDefaultData } = await import("./storage");
    const bill = (rate: number, date: string) =>
      ({ id: "i", invoiceNumber: "INV/26-27/W0001", status: "unpaid", type: "tax_invoice", date, placeOfSupply: "07", grandTotal: 100, totalTax: 0,
        items: [{ description: "Laptop", hsn: "8471", gstRate: rate, taxableAmount: 100, cgst: rate / 2, sgst: rate / 2, igst: 0 }] }) as never;
    const titles = (rate: number, date = "2026-03-01") => checkBooks({ ...getDefaultData(), invoices: [bill(rate, date)] }, new Date("2026-03-02"), book).map((i) => i.title);
    expect(titles(12)).toContain("Wrong GST rate on INV/26-27/W0001");
    expect(titles(5)).toContain("Check the GST rate on INV/26-27/W0001");
    expect(titles(18).filter((t) => /GST rate on/.test(t))).toEqual([]);
    expect(titles(12, "2025-08-01").filter((t) => /Wrong GST rate/.test(t))).toEqual([]);
  });
});

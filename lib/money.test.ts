/**
 * Money engine: the rules every bill depends on, plus the shared golden
 * vectors. lib/money-golden.json is also checked by the Android app
 * (argus/test/money_golden_test.dart), so both produce the same bill to the
 * paisa. Regenerate with UPDATE_GOLDEN=1 only when a rule deliberately changes.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { linePaise, roundOffPaise, round2, splitTaxPaise, toPaise, type LineInput } from "./money";
import { addDays, addMonths, addPeriod, financialYear, istDate, monthRange } from "./dates";

const RATES = [0, 0.25, 3, 5, 12, 18, 28, 40];
const PRICES = [0.5, 1, 9.99, 45, 99, 118, 149, 499, 1499, 25000];
const QTYS = [1, 3, 7, 0.5, 2.75, 1000];

function cases(): LineInput[] {
  const out: LineInput[] = [];
  for (const gstRate of RATES)
    for (const price of PRICES)
      for (const quantity of QTYS)
        for (const inclusive of [false, true])
          out.push({ quantity, price, gstRate, inclusive, discount: price === 149 ? 10 : 0, interState: price === 45 || price === 1499 });
  return out;
}

describe("rounding", () => {
  it("rounds half away from zero and ignores binary noise", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(-0.025)).toBe(-0.03);
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(toPaise(1234.565)).toBe(123457);
  });

  it("CGST and SGST always add up to the tax", () => {
    for (let tax = -500; tax <= 10000; tax++) {
      const { cgst, sgst } = splitTaxPaise(tax);
      expect(cgst + sgst).toBe(tax);
      expect(Math.abs(cgst - sgst)).toBeLessThanOrEqual(1);
    }
  });

  it("round-off is always under a rupee", () => {
    for (const p of [0, 1, 49, 50, 99, 12345, 12350, 12399, -150]) {
      const r = roundOffPaise(p);
      expect(Math.abs(r)).toBeLessThanOrEqual(50);
      expect(Math.abs((p + r) % 100)).toBe(0);
    }
  });
});

describe("bill lines", () => {
  it("tax is within a paisa of rate × taxable value on every line", () => {
    for (const c of cases()) {
      const l = linePaise(c);
      expect(Math.abs(l.tax - (l.taxable * c.gstRate) / 100)).toBeLessThanOrEqual(1);
      expect(l.cgst + l.sgst + l.igst).toBe(l.tax);
      expect(l.total).toBe(l.taxable + l.tax + l.cess);
      if (c.interState) expect(l.cgst + l.sgst).toBe(0);
      else expect(l.igst).toBe(0);
    }
  });

  it("a price typed with GST is exactly what the customer pays", () => {
    for (const c of cases().filter((x) => x.inclusive)) {
      const l = linePaise(c);
      expect(l.total).toBe(toPaise(c.quantity * c.price * (1 - (c.discount || 0) / 100)));
    }
  });

  it("1,000 × ₹149 at 5% (GST included): GST ₹7,095.24, not ₹7,100 from per-unit rounding", () => {
    const l = linePaise({ quantity: 1000, price: 149, gstRate: 5, inclusive: true, interState: false });
    expect(l.taxable).toBe(14190476);
    expect(l.tax).toBe(709524);
  });

  it("matches the shared golden vectors (also checked by the Android app)", () => {
    const file = join(__dirname, "money-golden.json");
    const computed = cases().map((input) => ({ input, expect: linePaise(input) }));
    if (process.env.UPDATE_GOLDEN) writeFileSync(file, `[\n${computed.map((c) => JSON.stringify(c)).join(",\n")}\n]\n`);
    const golden = JSON.parse(readFileSync(file, "utf-8")) as typeof computed;
    expect(golden.length).toBe(computed.length);
    expect(computed).toEqual(golden);
  });
});

describe("dates are Indian calendar dates", () => {
  it("12:30 am IST on 1 April is 1 April, in the new financial year", () => {
    const d = istDate(new Date("2027-03-31T19:00:00Z"));
    expect(d).toBe("2027-04-01");
    expect(financialYear(d)).toBe("27-28");
    expect(financialYear("2027-03-31")).toBe("26-27");
  });

  it("month ranges include the last day", () => {
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthRange("2026-10")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });

  it("recurring dates do not drift", () => {
    expect(addPeriod("2026-10-12", "monthly")).toBe("2026-11-12");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addPeriod("2026-12-15", "quarterly")).toBe("2027-03-15");
    expect(addPeriod("2026-10-12", "weekly")).toBe("2026-10-19");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    let d = "2026-01-12";
    for (let i = 0; i < 24; i++) d = addPeriod(d, "monthly");
    expect(d).toBe("2028-01-12");
  });
});

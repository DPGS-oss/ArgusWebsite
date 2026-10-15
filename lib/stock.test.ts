import { describe, expect, it } from "vitest";
import { getDefaultData } from "./storage";
import type { AppData, StockItem } from "./types";
import {
  MAIN_GODOWN, ensureOpeningMoves, expiring, godownQty, lots, openingStockValue, pickLots, productionMoves,
  recordMoves, reverseMoves, saleMoves, stockValuation, transferMoves, valueItem, movesFor,
} from "./stock";

const item = (id: string, extra: Partial<StockItem> = {}) =>
  ({ id, name: id, hsn: "1701", unit: "KG", openingStock: 0, currentStock: 0, minStock: 0, rate: 50, gstRate: 5, ...extra }) as StockItem;

function books(...items: StockItem[]): AppData {
  return { ...getDefaultData(), stock: items };
}

describe("stock movements", () => {
  it("keeps currentStock equal to the movements", () => {
    let d = books(item("sugar"));
    d = recordMoves(d, [
      { itemId: "sugar", date: "2026-10-01", kind: "purchase", qty: 100, godown: MAIN_GODOWN, unitCost: 40 },
      { itemId: "sugar", date: "2026-10-02", kind: "sale", qty: -30, godown: MAIN_GODOWN },
    ]);
    expect(d.stock[0].currentStock).toBe(70);
  });

  it("moving average: sales go out at the average cost; value is what is left", () => {
    let d = books(item("sugar"));
    d = recordMoves(d, [
      { itemId: "sugar", date: "2026-10-01", kind: "purchase", qty: 100, godown: MAIN_GODOWN, unitCost: 40 },
      { itemId: "sugar", date: "2026-10-05", kind: "purchase", qty: 100, godown: MAIN_GODOWN, unitCost: 46 },
      { itemId: "sugar", date: "2026-10-06", kind: "sale", qty: -150, godown: MAIN_GODOWN },
    ]);
    const v = valueItem(d.stock[0], movesFor(d, "sugar"));
    expect(v.qty).toBe(50);
    expect(v.unitCost).toBe(43);
    expect(v.value).toBe(2150);
    expect(v.cogs).toBe(6450);
  });

  it("first-in-first-out: sales use the oldest cost first", () => {
    let d = books(item("sugar", { valuation: "fifo" }));
    d = recordMoves(d, [
      { itemId: "sugar", date: "2026-10-01", kind: "purchase", qty: 100, godown: MAIN_GODOWN, unitCost: 40 },
      { itemId: "sugar", date: "2026-10-05", kind: "purchase", qty: 100, godown: MAIN_GODOWN, unitCost: 46 },
      { itemId: "sugar", date: "2026-10-06", kind: "sale", qty: -150, godown: MAIN_GODOWN },
    ]);
    const v = valueItem(d.stock[0], movesFor(d, "sugar"));
    expect(v.value).toBe(50 * 46);
    expect(v.cogs).toBe(100 * 40 + 50 * 46);
  });

  it("sells the earliest-expiring batch first, and cancelling puts it back", () => {
    let d = books(item("syrup", { trackBatches: true }));
    d = recordMoves(d, [
      { itemId: "syrup", date: "2026-09-01", kind: "purchase", qty: 10, godown: MAIN_GODOWN, batch: "B2", expiry: "2027-06-30", unitCost: 80 },
      { itemId: "syrup", date: "2026-09-02", kind: "purchase", qty: 10, godown: MAIN_GODOWN, batch: "B1", expiry: "2026-12-31", unitCost: 80 },
    ]);
    expect(pickLots(d, "syrup", 12).map((p) => [p.batch, p.qty])).toEqual([["B1", 10], ["B2", 2]]);
    const bill = { id: "inv1", invoiceNumber: "INV/26-27/W0001", date: "2026-10-12", items: [{ stockItemId: "syrup", quantity: 12 }] };
    d = recordMoves(d, saleMoves(d, bill));
    expect(lots(d, "syrup").map((l) => [l.batch, l.qty])).toEqual([["B2", 8]]);
    d = recordMoves(d, reverseMoves(d, "inv1", "sale_return"));
    expect(d.stock[0].currentStock).toBe(20);
    expect(lots(d, "syrup").map((l) => [l.batch, l.qty]).sort()).toEqual([["B1", 10], ["B2", 10]]);
  });

  it("transfers move stock between godowns without changing total or value", () => {
    let d = books(item("rice", { costPrice: 30 }));
    d = recordMoves(d, [{ itemId: "rice", date: "2026-10-01", kind: "purchase", qty: 50, godown: MAIN_GODOWN, unitCost: 30 }]);
    const before = stockValuation(d).total;
    d = recordMoves(d, transferMoves("rice", 20, MAIN_GODOWN, "Shop 2"));
    expect(godownQty(d, "rice", MAIN_GODOWN)).toBe(30);
    expect(godownQty(d, "rice", "Shop 2")).toBe(20);
    expect(d.stock[0].currentStock).toBe(50);
    expect(stockValuation(d).total).toBe(before);
    expect(valueItem(d.stock[0], movesFor(d, "rice")).cogs).toBe(0);
  });

  it("making an item uses up its components and carries their cost", () => {
    const flour = item("flour"), oil = item("oil"), biscuits = item("biscuits", { bom: [{ itemId: "flour", qty: 0.5 }, { itemId: "oil", qty: 0.1 }] });
    let d = books(flour, oil, biscuits);
    d = recordMoves(d, [
      { itemId: "flour", date: "2026-10-01", kind: "purchase", qty: 100, godown: MAIN_GODOWN, unitCost: 30 },
      { itemId: "oil", date: "2026-10-01", kind: "purchase", qty: 20, godown: MAIN_GODOWN, unitCost: 150 },
    ]);
    d = recordMoves(d, productionMoves(d, d.stock[2], 40));
    expect(d.stock.map((s) => s.currentStock)).toEqual([80, 16, 40]);
    const made = valueItem(d.stock[2], movesFor(d, "biscuits"));
    expect(made.unitCost).toBe(0.5 * 30 + 0.1 * 150);
    // Value is conserved: components out = product in.
    expect(stockValuation(d).total).toBe(100 * 30 + 20 * 150);
  });

  it("gives older items an opening movement at cost price, and lists what is about to expire", () => {
    let d = books(item("salt", { currentStock: 25, costPrice: 18 }));
    d = ensureOpeningMoves(d);
    expect(openingStockValue(d)).toBe(450);
    d = recordMoves(d, [{ itemId: "salt", date: "2026-10-01", kind: "purchase", qty: 5, godown: MAIN_GODOWN, batch: "S1", expiry: "2026-10-20", unitCost: 18 }]);
    expect(expiring(d, 30, "2026-10-15").map((e) => [e.name, e.batch])).toEqual([["salt", "S1"]]);
    expect(ensureOpeningMoves(d)).toBe(d);
  });
});

/**
 * Stock in depth: every change is a movement (opening, purchase, sale,
 * return, transfer between godowns, adjustment, production). Balances by
 * godown and batch, expiry, and the value of stock all come from the
 * movements. Each item's `currentStock` is kept equal to the sum of its
 * movements, so every screen that reads it stays right.
 *
 * Valuation: moving average cost by default, or first-in-first-out per item.
 * Closing stock feeds profit the standard way:
 *   cost of goods sold = opening stock + purchases − closing stock.
 */
import type { AppData, StockItem } from "./types";
import { toPaise } from "./money";
import { todayIST } from "./dates";

export const MAIN_GODOWN = "Main";

export type StockMoveKind =
  | "opening" | "purchase" | "sale" | "sale_return" | "purchase_return"
  | "transfer" | "adjust" | "produce" | "consume";

export interface StockMove {
  id: string;
  itemId: string;
  /** "YYYY-MM-DD" */
  date: string;
  kind: StockMoveKind;
  /** Signed: + into stock, − out of stock. */
  qty: number;
  godown: string;
  batch?: string;
  /** "YYYY-MM-DD" */
  expiry?: string;
  /** Cost per unit of goods coming in (before GST). */
  unitCost?: number;
  ref?: string;
  refId?: string;
  note?: string;
  createdAt: string;
}

let seq = 0;
const newId = () => `mv-${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function movesFor(data: AppData, itemId: string): StockMove[] {
  return (data.stockMoves || [])
    .filter((m) => m.itemId === itemId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

export function godowns(data: AppData): string[] {
  const set = new Set<string>([MAIN_GODOWN, ...(data.godowns || [])]);
  for (const m of data.stockMoves || []) set.add(m.godown || MAIN_GODOWN);
  return [...set];
}

/** Adds movements and keeps each item's currentStock equal to its movements. */
export function recordMoves(data: AppData, moves: Omit<StockMove, "id" | "createdAt">[]): AppData {
  if (!moves.length) return data;
  const now = new Date().toISOString();
  // Opening stock has a fixed id, so the phone and the website never both add one.
  const have = new Set((data.stockMoves || []).map((m) => m.id));
  const added = moves
    .map((m) => ({ ...m, id: m.kind === "opening" ? `open_${m.itemId}` : newId(), createdAt: now, godown: m.godown || MAIN_GODOWN, qty: round3(m.qty) }))
    .filter((m) => !have.has(m.id));
  if (!added.length) return data;
  const all = [...(data.stockMoves || []), ...added];
  const delta = new Map<string, number>();
  for (const m of added) delta.set(m.itemId, round3((delta.get(m.itemId) || 0) + m.qty));
  // Add the change rather than re-summing, so a count changed elsewhere is not undone.
  const stock = data.stock.map((s) => (delta.has(s.id) ? { ...s, currentStock: round3((s.currentStock || 0) + delta.get(s.id)!) } : s));
  return { ...data, stock, stockMoves: all };
}

/**
 * Items that have stock but no movements yet (from before movements existed)
 * get an opening movement, valued at their cost price.
 */
export function ensureOpeningMoves(data: AppData): AppData {
  const withMoves = new Set((data.stockMoves || []).map((m) => m.itemId));
  const missing = data.stock.filter((s) => !withMoves.has(s.id) && (s.currentStock || 0) !== 0);
  if (!missing.length) return data;
  return recordMoves(
    data,
    missing.map((s) => ({ itemId: s.id, date: todayIST(), kind: "opening" as const, qty: s.currentStock, godown: MAIN_GODOWN, unitCost: s.costPrice || 0, note: "Opening stock" })),
  );
}

export type Lot = { godown: string; batch: string; expiry?: string; qty: number };

/** Stock by godown and batch (batch "" when not tracked). */
export function lots(data: AppData, itemId: string): Lot[] {
  const map = new Map<string, Lot>();
  for (const m of movesFor(data, itemId)) {
    const key = `${m.godown}|${m.batch || ""}`;
    const l = map.get(key) || { godown: m.godown, batch: m.batch || "", expiry: m.expiry, qty: 0 };
    l.qty = round3(l.qty + m.qty);
    if (m.expiry && !l.expiry) l.expiry = m.expiry;
    map.set(key, l);
  }
  return [...map.values()].filter((l) => Math.abs(l.qty) > 1e-9);
}

export function godownQty(data: AppData, itemId: string, godown: string): number {
  return round3(lots(data, itemId).filter((l) => l.godown === godown).reduce((t, l) => t + l.qty, 0));
}

/**
 * Which lots an outward quantity comes from: earliest expiry first, then
 * oldest. Anything not covered comes from the plain (no batch) lot, which may
 * go below zero — the exception report shows that.
 */
export function pickLots(data: AppData, itemId: string, qty: number, godown = MAIN_GODOWN): { batch: string; expiry?: string; qty: number }[] {
  const available = lots(data, itemId)
    .filter((l) => l.godown === godown && l.qty > 0)
    .sort((a, b) => (a.expiry || "9999").localeCompare(b.expiry || "9999"));
  const out: { batch: string; expiry?: string; qty: number }[] = [];
  let left = qty;
  for (const l of available) {
    if (left <= 0) break;
    const take = Math.min(l.qty, left);
    out.push({ batch: l.batch, expiry: l.expiry, qty: round3(take) });
    left = round3(left - take);
  }
  if (left > 0) out.push({ batch: "", qty: left });
  return out;
}

export type ItemValue = { itemId: string; name: string; qty: number; unitCost: number; value: number; cogs: number; method: "average" | "fifo" };

/**
 * Value of an item's stock (and the cost of what went out) by its method.
 * Goods coming in without a cost are valued at the item's cost price.
 */
export function valueItem(item: StockItem, moves: StockMove[], upTo?: string): ItemValue {
  const method = item.valuation === "fifo" ? "fifo" : "average";
  const fallback = item.costPrice || 0;
  let qty = 0;
  let value = 0;
  let cogs = 0;
  const layers: { qty: number; cost: number }[] = [];
  for (const m of moves) {
    if (upTo && m.date > upTo) break;
    if (m.qty > 0) {
      // Returns and transfers come back at the current cost; purchases at their own.
      const cost = m.unitCost ?? (qty > 0 ? value / qty : fallback);
      qty += m.qty;
      value += m.qty * cost;
      if (method === "fifo") layers.push({ qty: m.qty, cost });
    } else if (m.qty < 0) {
      const out = -m.qty;
      if (method === "fifo") {
        let left = out;
        let cost = 0;
        while (left > 1e-9 && layers.length) {
          const l = layers[0];
          const take = Math.min(l.qty, left);
          cost += take * l.cost;
          l.qty -= take;
          left -= take;
          if (l.qty <= 1e-9) layers.shift();
        }
        cost += left * (layers[0]?.cost ?? fallback);
        if (m.kind !== "transfer") cogs += cost;
        value -= cost;
      } else {
        const avg = qty > 0 ? value / qty : fallback;
        if (m.kind !== "transfer") cogs += out * avg;
        value -= out * avg;
      }
      qty -= out;
    }
  }
  if (Math.abs(qty) < 1e-9) value = 0;
  return {
    itemId: item.id, name: item.name, qty: round3(qty), method,
    unitCost: qty > 0 ? Math.round((value / qty) * 100) / 100 : 0,
    value: Math.round(Math.max(0, value) * 100) / 100,
    cogs: Math.round(cogs * 100) / 100,
  };
}

/** Stock value of every item (as on a date, or now). */
export function stockValuation(data: AppData, upTo?: string): { items: ItemValue[]; total: number } {
  const items = data.stock.map((s) => valueItem(s, movesFor(data, s.id), upTo));
  return { items, total: items.reduce((t, i) => t + toPaise(i.value), 0) / 100 };
}

/** Value of the opening stock that was entered (start of the books). */
export function openingStockValue(data: AppData): number {
  const byItem = new Map(data.stock.map((s) => [s.id, s]));
  return (
    (data.stockMoves || [])
      .filter((m) => m.kind === "opening")
      .reduce((t, m) => t + toPaise(m.qty * (m.unitCost ?? byItem.get(m.itemId)?.costPrice ?? 0)), 0) / 100
  );
}

/** Lots expiring within `days` (or already expired), soonest first. */
export function expiring(data: AppData, days = 30, today = todayIST()): (Lot & { itemId: string; name: string })[] {
  const limit = new Date(Date.parse(`${today}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
  const out: (Lot & { itemId: string; name: string })[] = [];
  for (const s of data.stock) {
    for (const l of lots(data, s.id)) if (l.qty > 0 && l.expiry && l.expiry <= limit) out.push({ ...l, itemId: s.id, name: s.name });
  }
  return out.sort((a, b) => (a.expiry || "").localeCompare(b.expiry || ""));
}

// ── Movements for common actions ────────────────────────────────────────────

/** Sale of a bill's stock lines (earliest-expiry batches first). */
export function saleMoves(data: AppData, bill: { id: string; invoiceNumber: string; date: string; items: { stockItemId?: string; quantity: number }[] }, godown = MAIN_GODOWN) {
  const moves: Omit<StockMove, "id" | "createdAt">[] = [];
  for (const line of bill.items) {
    if (!line.stockItemId || !(line.quantity > 0)) continue;
    for (const p of pickLots(data, line.stockItemId, line.quantity, godown)) {
      moves.push({ itemId: line.stockItemId, date: bill.date.slice(0, 10), kind: "sale", qty: -p.qty, godown, batch: p.batch || undefined, expiry: p.expiry, ref: bill.invoiceNumber, refId: bill.id });
    }
  }
  return moves;
}

/** Puts back exactly what a bill took out (on cancellation). */
export function reverseMoves(data: AppData, refId: string, kind: StockMoveKind, date = todayIST(), note = "Cancelled") {
  return (data.stockMoves || [])
    .filter((m) => m.refId === refId && m.kind === "sale")
    .map((m) => ({ itemId: m.itemId, date, kind, qty: -m.qty, godown: m.godown, batch: m.batch, expiry: m.expiry, ref: m.ref, refId, note }));
}

export function transferMoves(itemId: string, qty: number, from: string, to: string, batch?: string, expiry?: string, date = todayIST()) {
  return [
    { itemId, date, kind: "transfer" as const, qty: -qty, godown: from, batch, expiry, note: `To ${to}` },
    { itemId, date, kind: "transfer" as const, qty, godown: to, batch, expiry, note: `From ${from}` },
  ];
}

/**
 * Making `qty` of an item from its bill of materials: components go out,
 * the product comes in at the components' cost.
 */
export function productionMoves(data: AppData, item: StockItem, qty: number, godown = MAIN_GODOWN, batch?: string, expiry?: string, date = todayIST()) {
  const moves: Omit<StockMove, "id" | "createdAt">[] = [];
  let cost = 0;
  for (const c of item.bom || []) {
    const comp = data.stock.find((s) => s.id === c.itemId);
    if (!comp) continue;
    const need = round3(c.qty * qty);
    const v = valueItem(comp, movesFor(data, comp.id));
    cost += need * (v.qty > 0 ? v.value / v.qty : comp.costPrice || 0);
    for (const p of pickLots(data, comp.id, need, godown)) {
      moves.push({ itemId: comp.id, date, kind: "consume", qty: -p.qty, godown, batch: p.batch || undefined, expiry: p.expiry, ref: item.name, note: `Used to make ${qty} ${item.unit || ""}`.trim() });
    }
  }
  moves.push({ itemId: item.id, date, kind: "produce", qty, godown, batch, expiry, unitCost: qty > 0 ? Math.round((cost / qty) * 100) / 100 : 0, note: "Made from components" });
  return moves;
}

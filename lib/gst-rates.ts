/**
 * GST rate book: which rate(s) the law gives each HSN/SAC code.
 *
 * The book (public/data/gst-rates.json) is built from the CBIC notifications
 * (9/2025, 10/2025 and 19/2025-Central Tax (Rate) for goods; 11/2017 as
 * amended by 15/2025 for services). It is served at /data/gst-rates.json, so
 * when rates change the file is updated once and every browser and phone
 * picks it up — no app release needed.
 *
 * Where the law gives a code one rate, it fills in by itself. Where the rate
 * depends on the item (packaged or not, price per piece, engine size…), the
 * options come back with the condition in the notification's words, and the
 * owner picks. Same lookup as the Android app (gst_rate_book.dart); both are
 * checked against lib/gst-rate-golden.json.
 */

export type GoodsRule = { r: number; inc: string[]; exc: string[]; d: string; src: string; x?: 1 };
export type ServiceRule = { inc: string[]; o: { r: number; d: string }[] };
export type RateBook = {
  version: string;
  effectiveFrom: string;
  sources: string[];
  note: string;
  goods: GoodsRule[];
  goodsDefault: { r: number; d: string };
  outside: { inc: string[]; d: string }[];
  services: ServiceRule[];
  servicesDefault: { r: number; d: string };
  catalog: { c: string; d: string }[];
};

export type RateOption = { rate: number; notes: string[]; outside: boolean };
export type RateOptions = { main: RateOption[]; special: RateOption[] };

const digits = (code: string) => (code || "").replace(/\D/g, "");

export function rateOptions(book: RateBook, code: string): RateOptions {
  const c = digits(code);
  if (c.length < 2) return { main: [], special: [] };

  if (c.startsWith("99")) {
    let best: { len: number; rule: ServiceRule } | null = null;
    for (const e of book.services) {
      for (const x of e.inc) if (c.startsWith(x) && (!best || x.length > best.len)) best = { len: x.length, rule: e };
    }
    const opts = best ? best.rule.o : [book.servicesDefault];
    const main = new Map<number, RateOption>();
    for (const o of opts) {
      const m = main.get(o.r) || { rate: o.r, notes: [], outside: false };
      m.notes.push(o.d);
      main.set(o.r, m);
    }
    return { main: [...main.values()].sort((a, b) => a.rate - b.rate), special: [] };
  }

  const groups = { main: new Map<string, RateOption>(), special: new Map<string, RateOption>() };
  const add = (kind: "main" | "special", rate: number, note: string, outside = false) => {
    const key = outside ? "x" : String(rate);
    const o = groups[kind].get(key) || { rate, notes: [], outside };
    if (!o.notes.includes(note)) o.notes.push(note);
    groups[kind].set(key, o);
  };
  const excluded = (g: GoodsRule) => g.exc.some((e) => c.startsWith(e));
  const spec = (g: GoodsRule) => g.inc.reduce((m, x) => (c.startsWith(x) ? Math.max(m, x.length) : m), 0);
  // A main rule naming this code at 6+ digits overrides broader main rules for it.
  const precise = book.goods.reduce((m, g) => (!g.x && !excluded(g) ? Math.max(m, spec(g)) : m), 0);

  let covered = false;
  for (const g of book.goods) {
    if (excluded(g)) continue;
    const covers = g.inc.some((x) => c.startsWith(x));
    const within = !covers && c.length < 8 && g.inc.some((x) => x.startsWith(c));
    if (!covers && !within) continue;
    const kind = g.x ? "special" : "main";
    if (covers && kind === "main" && precise >= 6 && spec(g) < precise) continue;
    if (covers && kind === "main") covered = true;
    add(kind, g.r, g.d);
  }
  let outsideOnly = false;
  for (const e of book.outside) {
    if (e.inc.some((x) => c.startsWith(x) || x.startsWith(c))) {
      add("main", 0, e.d, true);
      if (e.inc.some((x) => c.startsWith(x)) && !covered) outsideOnly = true;
    }
  }
  if (!covered && !outsideOnly) add("main", book.goodsDefault.r, book.goodsDefault.d);

  const sort = (m: Map<string, RateOption>) =>
    [...m.values()]
      .sort((a, b) => Number(a.outside) - Number(b.outside) || a.rate - b.rate)
      .map((o) => ({ ...o, notes: o.notes.slice(0, 4) }));
  return { main: sort(groups.main), special: sort(groups.special) };
}

/** The one rate for a code, when the law gives only one; otherwise null (ask the owner). */
export function singleRate(book: RateBook, code: string): number | null {
  const { main } = rateOptions(book, code);
  return main.length === 1 ? main[0].rate : null;
}

/** Codes and descriptions to search, matching on code start or words. */
export function searchCatalog(book: RateBook, query: string, limit = 20) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const qd = digits(q);
  const words = q.split(/\s+/).filter(Boolean);
  return book.catalog
    .filter((e) => (qd && digits(e.c).startsWith(qd)) || words.every((w) => e.d.toLowerCase().includes(w)))
    .slice(0, limit);
}

// ── Loading, with updates from the server ───────────────────────────────────

const CACHE_KEY = "argus_gst_rates_v1";
let current: RateBook | null = null;

/** The loaded rate book, if any (call loadRateBook first). */
export function getRateBook(): RateBook | null {
  return current;
}

/**
 * Loads the rate book: the cached copy at once, then the latest from the
 * server (rates change by notification; the server copy is updated once).
 */
export async function loadRateBook(fetchImpl: typeof fetch = fetch): Promise<RateBook | null> {
  if (!current) {
    try {
      const cached = typeof localStorage !== "undefined" ? localStorage.getItem(CACHE_KEY) : null;
      if (cached) current = JSON.parse(cached) as RateBook;
    } catch {
      // ignore a bad cache
    }
  }
  try {
    const res = await fetchImpl("/data/gst-rates.json", { cache: "no-cache" });
    if (res.ok) {
      const latest = (await res.json()) as RateBook;
      if (!current || latest.version !== current.version) {
        current = latest;
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(latest));
        } catch {
          // storage full or blocked: the in-memory copy still works
        }
      }
    }
  } catch {
    // offline: keep the cached copy
  }
  return current;
}

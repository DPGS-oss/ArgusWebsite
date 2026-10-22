/**
 * Just enough of a browser for the web app's own storage and sync code
 * (lib/storage.ts, lib/cloud-sync.ts) to run in the simulation: IndexedDB and
 * localStorage kept in memory, one localStorage per person ("browser"), and
 * "/api/..." requests sent to the local emulators the way firebase.json
 * rewrites them on the real site.
 */
import fs from "node:fs";

const FN = "http://127.0.0.1:5001/argus-invocing/us-central1";

// ---- localStorage: one per browser, switched by useBrowser()
const browsers = new Map<string, Map<string, string>>();
let ls = new Map<string, string>();
export function useBrowser(name: string) {
  if (!browsers.has(name)) browsers.set(name, new Map());
  ls = browsers.get(name)!;
}
const localStorageShim = {
  getItem: (k: string) => (ls.has(k) ? ls.get(k)! : null),
  setItem: (k: string, v: string) => void ls.set(k, String(v)),
  removeItem: (k: string) => void ls.delete(k),
  clear: () => ls.clear(),
  key: (i: number) => [...ls.keys()][i] ?? null,
  get length() { return ls.size; },
};

// ---- IndexedDB: keys are already per account ("appData:<uid>"), so one store serves every browser
const idb = new Map<string, unknown>();
const later = (f: () => void) => setTimeout(f, 0);
const indexedDBShim = {
  open() {
    const req: any = {};
    later(() => {
      const db = {
        objectStoreNames: { contains: () => true },
        createObjectStore() {},
        transaction() {
          const tx: any = {};
          const os = {
            get(k: string) { const r: any = {}; later(() => { r.result = idb.has(k) ? structuredClone(idb.get(k)) : undefined; r.onsuccess?.(); }); return r; },
            put(v: unknown, k: string) { idb.set(k, structuredClone(v)); later(() => tx.oncomplete?.()); return {}; },
            delete(k: string) { idb.delete(k); later(() => tx.oncomplete?.()); return {}; },
          };
          tx.objectStore = () => os;
          return tx;
        },
      };
      req.result = db;
      req.onsuccess?.();
    });
    return req;
  },
};

// ---- "/api/..." → the function firebase.json rewrites it to
const hosting = JSON.parse(fs.readFileSync("firebase.json", "utf8")).hosting;
const rewrites: { source: string; function?: string }[] = (Array.isArray(hosting) ? hosting[0] : hosting).rewrites || [];
const realFetch = globalThis.fetch.bind(globalThis);
function route(url: string): string {
  const path = url.split("?")[0];
  for (const r of rewrites) {
    if (!r.function) continue;
    const src = r.source;
    const ok = src.endsWith("/**") ? path.startsWith(src.slice(0, -3)) : path === src;
    if (ok) return `${FN}/${r.function}${url}`;
  }
  throw new Error(`no rewrite for ${url}`);
}

const g = globalThis as any;
g.window = globalThis;
if (typeof g.addEventListener !== "function") { g.addEventListener = () => {}; g.removeEventListener = () => {}; }
g.localStorage = localStorageShim;
g.indexedDB = indexedDBShim;
g.document = { addEventListener() {}, removeEventListener() {}, visibilityState: "visible" };
/** Answers other than 2xx that the web app got, for the report. */
export const webErrors: string[] = [];
g.fetch = async (input: any, init?: any) => {
  const rel = typeof input === "string" && input.startsWith("/api/");
  try {
    const res = await realFetch(rel ? route(input) : input, init);
    if (rel && !res.ok && webErrors.length < 200) webErrors.push(`${input} ${res.status} ${(await res.clone().text()).slice(0, 200)}`);
    return res;
  } catch (e) {
    if (rel && webErrors.length < 200) webErrors.push(`${input} threw ${String(e).slice(0, 200)}`);
    throw e;
  }
};

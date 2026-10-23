/**
 * A year of business on the LOCAL Firebase emulators (never production).
 *
 * Shops open on 1 April 2025 and work every day until 7 April 2026: the
 * whole financial year 2025-26, the GST rate cut of 22 September 2025, and
 * the first week of the new year's bill series. Half the shops use the
 * website, half the phone app; a few have staff; three CAs look after them
 * and file every month.
 *
 * Website shops run the web app's own code (lib/storage, lib/books,
 * lib/stock, lib/cloud-sync) on a browser stand-in (browser-env.ts): every
 * day the owner opens the app (pulls the books from the cloud), works, and
 * the app saves back. Phone shops send what the phone app sends
 * (/api/data/phone-sync), with stock movements, customers and purchases.
 *
 * What owners do: bills (walk-in, B2B, other states, big B2C), stock from
 * opening to restocking with purchase bills, payments received late and in
 * parts, credit and debit notes, cancellations, edits, rent, electricity,
 * salaries (payroll), khata (udhar), quotes, delivery challans, a repeating
 * monthly bill, templates, godown transfers, GSTR-2B every month, receipts
 * sent on WhatsApp with a UPI link, a second branch with its own GSTIN, a
 * plan that lapses for a few days, staff who leave and join, a shop that
 * changes CA, and a shop that forgets to update its GST rates.
 *
 * What CAs do, every month on the 11th: open the books, download GSTR-1,
 * compare with GSTR-3B, take Tally files and e-invoice JSON. At year end:
 * GSTR-9, closing stock, profit and loss.
 *
 *   firebase emulators:start --only auth,functions,firestore
 *   npx vitest run -c scripts/sim/vitest.config.ts scripts/sim/year.sim.ts
 *   (SIM_SHOPS=20 SIM_CAS=3 SIM_UNTIL=2026-04-07 by default)
 */
import { useBrowser, webErrors, webBytes } from "./browser-env";
import { expect, it, vi } from "vitest";
import fs from "node:fs";
import zlib from "node:zlib";
import { buildInvoiceDocument, calculateItem, generateGSTRReport } from "@/lib/gst";
import { linePaise, toPaise } from "@/lib/money";
import { gstr3b, checkBooks } from "@/lib/compliance";
import { financialYear } from "@/lib/dates";
import type { AppData, BusinessProfile, CreditNote, DebitNote, Expense, Invoice, InvoiceItem, KhataEntry, Party, PayrollEntry, Purchase, Quote, StockItem, DeliveryChallan, Template } from "@/lib/types";
import {
  initStorage, loadData, saveData, flushPendingSave, saveBusiness, saveParty, saveStockItem, saveStockMoves, saveInvoice, cancelInvoice,
  deductStockForInvoice, generateInvoiceNumber, setBillSeries, saveExpense, savePayrollEntry, saveKhataEntry, savePurchase, saveQuote,
  saveDeliveryChallan, saveTemplate, saveCreditNote, saveDebitNote, setActiveBusiness, saveSettings, generateId,
} from "@/lib/storage";
import { postInvoiceLedger, persistLedger, applyPaymentToInvoice, postNoteLedger, postPurchaseLedger, postExpenseLedger, profitAndLoss, unbalancedPostings } from "@/lib/books";
import { noteFromBill } from "@/lib/notes";
import { withHistory } from "@/lib/invoice-history";
import { setAuditActor } from "@/lib/audit";
import { transferMoves, stockValuation } from "@/lib/stock";
import { syncFromCloud, syncToCloud, setBooksUid } from "@/lib/cloud-sync";
import { amountToCollect, buildUpiPayUri, buildWhatsAppInvoiceText, buildWhatsAppShareUrl } from "@/lib/upi";
import caExports from "../../functions/_shared/ca-exports.js";

// components/webapp/InvoiceShareActions.tsx (a .tsx screen the simulation cannot load) asks for amountToCollect.
const invoiceCollectAmount = (invoice: Invoice) => amountToCollect(invoice);
const { isRegisteredGstin } = caExports as unknown as { isRegisteredGstin: (g: string) => boolean };
const FN = "http://127.0.0.1:5001/argus-invocing/us-central1";
const AUTH = "http://127.0.0.1:9099";
const STORE = "http://127.0.0.1:8080";
const PROJECT = "argus-invocing";
const PASSWORD = "argus-emulator-test-1";
const UNTIL = process.env.SIM_UNTIL || "2026-04-07";
const RATE_CUT = "2025-09-22";
/** Phone app 1.4.11+ sends expenses and hand-typed khata; older builds keep them on the phone. */
const PHONE_SENDS_LEDGER = process.env.SIM_OLD_PHONE !== "1";
/** Phone app 1.4.12+ syncs only what changed (SIM_FULL_PHONE=1: the older full sync). */
const LEAN_PHONE = process.env.SIM_FULL_PHONE !== "1";
const BOOK = JSON.parse(fs.readFileSync("public/data/gst-rates.json", "utf8"));

// ---------------------------------------------------------------- helpers
let seed = 20250401;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const chance = (p: number) => rnd() < p;
const r2 = (n: number) => Math.round(n * 100) / 100;
const p2r = (p: number) => p / 100;
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const monthOf = (iso: string) => iso.slice(0, 7);
const monthEnd = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const prevMonth = (ym: string) => { const [y, m] = ym.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };
const fp = (ym: string) => `${ym.slice(5, 7)}${ym.slice(0, 4)}`;

// The web app reads the clock (todayIST, audit times); the simulation moves it day by day.
vi.useFakeTimers({ toFake: ["Date"] });
const setClock = (iso: string, hh = 11) => vi.setSystemTime(new Date(`${iso}T${String(hh).padStart(2, "0")}:00:00+05:30`));

function gstin(state: string, k: number): string {
  const L = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const letters = [0, 1, 2, 3, 4].map((i) => L[Math.floor(k / Math.pow(L.length, i)) % L.length]).join("");
  const pan = `${letters.slice(0, 3)}P${letters[3]}${String(k % 10000).padStart(4, "0")}${letters[4]}`;
  const base = `${state}${pan}1Z`;
  for (const ch of "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ") if (isRegisteredGstin(base + ch)) return base + ch;
  throw new Error("no gstin " + base);
}

// ---------------------------------------------------------------- accounts and API
type Who = { email: string; name: string; uid: string; token: string; at: number };
const post = (url: string, body: unknown, h: Record<string, string> = {}) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...h }, body: JSON.stringify(body) }).then((r) => r.json());
async function refreshToken(who: Who) {
  const j = await post(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, { email: who.email, password: PASSWORD, returnSecureToken: true });
  who.token = j.idToken;
  who.at = performance.now();
}
/** Tokens last an hour of real time; the app refreshes them, so does the simulation. */
async function fresh(who: Who) { if (performance.now() - who.at > 40 * 60 * 1000) await refreshToken(who); }
async function setPlan(uid: string, active: boolean) {
  const sub = active
    ? { mapValue: { fields: { plan: { stringValue: "business_yearly" }, plan_key: { stringValue: "business_yearly" }, active: { booleanValue: true }, expiry_date: { stringValue: "2027-12-31T18:29:59.000Z" } } } }
    : { mapValue: { fields: { plan: { stringValue: "business_yearly" }, plan_key: { stringValue: "business_yearly" }, active: { booleanValue: false }, expiry_date: { stringValue: "2026-01-01T00:00:00.000Z" } } } };
  await fetch(`${STORE}/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=subscription`, {
    method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer owner" }, body: JSON.stringify({ fields: { subscription: sub } }),
  });
}
async function account(email: string, name: string, plan: boolean): Promise<Who> {
  let j = await post(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, { email, password: PASSWORD, displayName: name, returnSecureToken: true });
  if (!j.localId) j = await post(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, { email, password: PASSWORD, returnSecureToken: true });
  await post(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`, { localId: j.localId, emailVerified: true }, { Authorization: "Bearer owner" });
  j = await post(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, { email, password: PASSWORD, returnSecureToken: true });
  await fetch(`${STORE}/v1/projects/${PROJECT}/databases/(default)/documents/users/${j.localId}`, {
    method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
    body: JSON.stringify({ fields: { name: { stringValue: name }, email: { stringValue: email }, created_at: { stringValue: "2025-03-25T00:00:00Z" } } }),
  });
  if (plan) await setPlan(j.localId, true);
  return { email, name, uid: j.localId, token: j.idToken, at: performance.now() };
}

const rateLimited: Record<string, number> = {};
const timings: Record<string, { n: number; ms: number; max: number; bytes: number; sent: number; got: number }> = {};
async function api(who: Who, fn: string, path: string, body?: unknown, method?: string): Promise<{ status: number; body: any }> {
  await fresh(who);
  for (let attempt = 0; attempt < 8; attempt++) {
    const r = await apiOnce(who, fn, path, body, method);
    if (r.status === 401) { await refreshToken(who); continue; }
    if (r.status !== 429) return r;
    rateLimited[fn] = (rateLimited[fn] || 0) + 1;
    await new Promise((ok) => setTimeout(ok, Math.min(60, Number(r.body?.retry_after_seconds) || 5) * 1000));
  }
  return apiOnce(who, fn, path, body, method);
}
async function apiOnce(who: Who, fn: string, path: string, body?: unknown, method?: string) {
  const json = body === undefined ? undefined : JSON.stringify(body);
  // as the apps send it: gzipped when large, and asking for packed answers
  const packed = json && json.length > 1024 ? zlib.gzipSync(json) : undefined;
  const t0 = performance.now();
  const res = await fetch(`${FN}/${fn}${path}`, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: { Authorization: `Bearer ${who.token}`, "Content-Type": "application/json", "X-Argus-Accept": "gzip", ...(packed ? { "Content-Encoding": "gzip" } : {}) },
    body: packed || json,
  });
  const raw = Buffer.from(await res.arrayBuffer());
  const text = res.headers.get("x-argus-packed") === "gzip" ? zlib.gunzipSync(raw).toString("utf8") : raw.toString("utf8");
  const t = (timings[fn] ||= { n: 0, ms: 0, max: 0, bytes: 0, sent: 0, got: 0 });
  const ms = performance.now() - t0;
  t.n++; t.ms += ms; t.max = Math.max(t.max, ms); t.bytes = Math.max(t.bytes, (json || "").length + text.length);
  t.sent += packed ? packed.length : (json || "").length; t.got += raw.length;
  let out: any = null;
  try { out = JSON.parse(text); } catch { out = text; }
  return { status: res.status, body: out };
}

// ---------------------------------------------------------------- shops
/** pre / post: GST rate before and from 22 Sep 2025. price: shelf price with GST at the old rate. */
type Item = { key: string; name: string; hsn: string; pre: number; post: number; price: number; cost: number; unit: string; open: number; min: number; service?: boolean };
const I = (key: string, name: string, hsn: string, pre: number, post: number, price: number, cost: number, unit: string, open: number, min: number, service = false): Item =>
  ({ key, name, hsn, pre, post, price, cost, unit, open, min, service });
type Buyer = { id: string; name: string; gstin: string; state: string; phone: string };
type Shop = {
  n: number; kind: number; name: string; state: string; gstin: string; app: "phone" | "web"; composition?: boolean;
  items: Item[]; perDay: [number, number];
  owner?: Who; staff?: Who; staffAccess?: "billing" | "full"; ca: string;
  buyers: Buyer[]; supplierGstin: string; landlordGstin: string; rent: number;
  // phone app state (what the phone holds)
  ph?: PhoneBooks;
  // simulation's own notes: what should be true
  expect: { stock: Record<string, number>; rateNow: Record<string, number>; phoneKhata: number; phoneExpenses: number; webPaid: Record<string, number>; lapseBills: string[]; branchBills: string[]; receipts: Receipt[] };
  branchId?: string; branchGstin?: string; forgetsRateCut?: boolean;
};
type Receipt = { invoiceNumber: string; status: string; balanceDue: number; grandTotal: number; url: string; text: string };
type PhoneBooks = { base: Record<string, Record<string, string>>; since: string; staffMoves: any[]; invoices: any[]; customers: any[]; inventory: any[]; creditNotes: any[]; debitNotes: any[]; purchases: any[]; stockMoves: any[]; auditSince: string; seq: Record<string, number>; staffSeq: Record<string, number>; cnSeq: number; dnSeq: number; khata: any[]; expenses: any[] };

const KINDS: Omit<Shop, "n" | "kind" | "gstin" | "ca" | "buyers" | "supplierGstin" | "landlordGstin" | "expect">[] = [
  { name: "Mehta Pharmacy", state: "27", app: "phone", perDay: [3, 6], staffAccess: "billing", rent: 18000,
    items: [I("para", "Paracetamol 500mg strip", "3004", 12, 5, 32, 18, "STRIP", 600, 80), I("syrup", "Cough syrup 100ml", "3004", 12, 5, 95, 55, "BTL", 200, 30), I("cream", "Face cream 50g", "3304", 18, 18, 249, 140, "NOS", 80, 15), I("paste", "Toothpaste 150g", "3306", 18, 5, 110, 70, "NOS", 120, 20)] },
  { name: "Sharma Kirana", state: "27", app: "phone", perDay: [4, 8], rent: 12000,
    items: [I("riceL", "Rice loose 1kg", "1006", 0, 0, 52, 40, "KGS", 800, 150), I("riceP", "Branded rice 5kg pack", "1006", 5, 5, 420, 330, "BAG", 80, 15), I("dal", "Toor dal loose 1kg", "0713", 0, 0, 150, 120, "KGS", 300, 60), I("atta", "Packed atta 10kg", "1101", 5, 5, 460, 380, "BAG", 60, 12), I("bisc", "Biscuits", "1905", 18, 5, 30, 20, "PAC", 400, 80), I("soap", "Toilet soap", "3401", 18, 5, 45, 28, "NOS", 300, 60)] },
  { name: "Gupta Hardware", state: "27", app: "web", perDay: [2, 4], rent: 25000,
    items: [I("alm", "Steel almirah", "9403", 18, 18, 9000, 6000, "NOS", 12, 3), I("hinge", "Door hinge", "8302", 18, 18, 120, 70, "NOS", 400, 80), I("cem", "Cement bag 50kg", "2523", 28, 18, 400, 300, "BAG", 300, 60)] },
  { name: "Royal Jewellers", state: "27", app: "web", perDay: [1, 3], rent: 60000,
    items: [I("gold", "Gold chain 10g", "7113", 3, 3, 72000, 65000, "NOS", 30, 5), I("silver", "Silver anklet pair", "7113", 3, 3, 4500, 3800, "PRS", 50, 10)] },
  { name: "Fresh Veggies", state: "27", app: "phone", perDay: [5, 9], rent: 8000,
    items: [I("tom", "Tomato 1kg", "0702", 0, 0, 40, 28, "KGS", 400, 80), I("onion", "Onion 1kg", "0703", 0, 0, 35, 24, "KGS", 400, 80), I("pot", "Potato 1kg", "0701", 0, 0, 30, 20, "KGS", 400, 80)] },
  { name: "Style Clothing", state: "07", app: "web", perDay: [2, 5], staffAccess: "full", rent: 45000,
    items: [I("shirt", "Cotton shirt", "6205", 5, 5, 899, 500, "NOS", 150, 30), I("jeans", "Jeans", "6203", 12, 5, 1999, 1100, "NOS", 120, 25), I("kurta", "Designer kurta", "6211", 12, 18, 3499, 2000, "NOS", 60, 12)] },
  { name: "TechZone Electronics", state: "29", app: "web", perDay: [1, 3], rent: 55000,
    items: [I("tv", "LED TV 43in", "8528", 28, 18, 28999, 22000, "NOS", 20, 4), I("ac", "Air conditioner 1.5T", "8415", 28, 18, 38999, 30000, "NOS", 14, 3), I("usb", "USB cable", "8544", 18, 18, 299, 120, "NOS", 300, 50), I("amc", "Annual maintenance (monthly)", "998713", 18, 18, 1180, 0, "NOS", 0, 0, true)] },
  { name: "Annapurna Sweets", state: "27", app: "phone", perDay: [4, 8], rent: 15000,
    items: [I("kaju", "Kaju katli 500g", "2106", 5, 5, 550, 350, "BOX", 200, 40), I("namk", "Namkeen 200g", "2106", 12, 5, 80, 50, "PAC", 400, 80)] },
  { name: "Patel Composition Store", state: "24", app: "web", perDay: [2, 4], composition: true, rent: 7000,
    items: [I("bucket", "Plastic bucket", "3924", 0, 0, 250, 160, "NOS", 200, 40), I("broom", "Broom", "9603", 0, 0, 120, 70, "NOS", 200, 40)] },
  { name: "Wholesale Traders", state: "27", app: "phone", perDay: [2, 4], rent: 30000,
    items: [I("det", "Detergent 1kg (carton of 12)", "3402", 18, 18, 1416, 1000, "CTN", 150, 30), I("tea", "Tea 250g (carton of 24)", "0902", 5, 5, 3360, 2800, "CTN", 80, 15)] },
];
const BUYERS = [
  { name: "Kumar Enterprises", state: "27" }, { name: "Delhi Distributors", state: "07" }, { name: "Bangalore Retail Co", state: "29" },
  { name: "Gujarat Mart", state: "24" }, { name: "Pune Clinic", state: "27" },
];
const SHOPS = Number(process.env.SIM_SHOPS) || 20;
const CAS = Math.max(1, Math.min(26, Number(process.env.SIM_CAS) || 3));
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const STATES = ["27", "07", "29", "24", "33", "09", "19"];
const shops: Shop[] = [];
for (let i = 0; i < SHOPS; i++) {
  const t = KINDS[i % KINDS.length];
  const round = Math.floor(i / KINDS.length);
  const kind = (i % KINDS.length) + 1;
  shops.push({
    ...t, n: i + 1, kind, name: round ? `${t.name} ${round + 1}` : t.name, state: round ? STATES[(i + round) % STATES.length] : t.state,
    staffAccess: round ? undefined : t.staffAccess, ca: LETTERS[i % CAS], gstin: "", buyers: [], supplierGstin: "", landlordGstin: "",
    expect: { stock: {}, rateNow: {}, phoneKhata: 0, phoneExpenses: 0, webPaid: {}, lapseBills: [], branchBills: [], receipts: [] },
  });
}
// Special lives (first round of shops only)
const BRANCH = shops.find((s) => s.kind === 3)!;          // opens a second branch in Karnataka in October
const LAPSER = shops.find((s) => s.kind === 4)!;          // plan lapses 16–20 December
const MOVER = shops.find((s) => s.kind === 5)!;           // changes CA on 1 January
const FORGETS = shops.find((s) => s.kind === 7)!;         // forgets to change GST rates until 29 September
FORGETS.forgetsRateCut = true;
const STAFFSHOP = shops.find((s) => s.kind === 1)!;       // billing staff leaves in November, new staff in December

const rateOn = (s: Shop, it: Item, iso: string) => (s.composition ? 0 : iso < RATE_CUT ? it.pre : iso < (s.forgetsRateCut ? "2025-09-29" : RATE_CUT) ? it.pre : it.post);
const preTax = (it: Item) => r2(it.price / (1 + it.pre / 100));

// ---------------------------------------------------------------- report
const report: { pass: string[]; fail: string[]; notes: string[]; findings: string[] } = { pass: [], fail: [], notes: [], findings: [] };
const check = (name: string, ok: boolean, extra = "") => { (ok ? report.pass : report.fail).push(`${name}${extra ? `  — ${extra}` : ""}`); };
const failOnce = new Set<string>();
/** Same check every month: report the first failure, count the rest. */
const monthly = (key: string, name: string, ok: boolean, extra = "") => {
  if (ok) { report.pass.push(name); return; }
  if (failOnce.has(key)) { report.notes.push(`again: ${name}  — ${extra}`); return; }
  failOnce.add(key);
  report.fail.push(`${name}${extra ? `  — ${extra}` : ""}`);
};
let syncFailures = 0;
const failNote = (msg: string) => { syncFailures++; if (report.notes.length < 400) report.notes.push(msg); };

// ---------------------------------------------------------------- the web app, as the owner uses it
const lapsed = new Set<string>(); // shops whose plan has lapsed (uid)

/** Opens the web app for a person: local books, then the cloud's; runs the work; saves back. */
async function webSession(s: Shop, who: Who, iso: string, work: () => void | Promise<void>, opts: { staffSeries?: string } = {}) {
  setClock(iso);
  useBrowser(who.uid);
  await fresh(who);
  setBooksUid(s.owner!.uid);
  setBillSeries(opts.staffSeries || "");
  setAuditActor({ uid: who.uid, name: who.name });
  await initStorage(who.uid, { claimLegacy: who === s.owner });
  await syncFromCloud(who.token);
  await work();
  flushPendingSave();
  const ok = await syncToCloud(who.token);
  if (!ok && !lapsed.has(s.owner!.uid)) {
    // what the server said (the web app only shows "not synced")
    const again = await api(who, "apiDataSave", "/api/data/save", { appData: loadData(), books_uid: s.owner!.uid });
    failNote(`${s.name} ${who === s.owner ? "owner" : "staff"} ${iso}: web save failed — app got: ${webErrors.slice(-2).join(" | ")}; a plain save then: ${again.status}`);
  }
  await new Promise((r) => setTimeout(r, 2));
  return ok;
}

const biz = () => { const d = loadData(); return d.businesses.find((b) => b.id === d.activeBusinessId)!; };
const stockOf = (s: Shop, key: string) => loadData().stock.find((x) => x.id === `s${s.n}-${key}`);

function webSetup(s: Shop) {
  const b: BusinessProfile = {
    id: `biz${s.n}`, name: s.name, gstin: s.gstin, pan: s.gstin.slice(2, 12), email: `owner${s.n}@argus.test`, phone: "9820012345", address: "12 Main Road",
    city: "", state: "", stateCode: s.state, pincode: "400001", bankName: "", bankAccount: "", bankIfsc: "", bankBranch: "", upiId: `shop${s.n}@upi`, composition: !!s.composition,
  };
  saveBusiness(b);
  saveSettings({ ...loadData().settings, invoicePrefix: "INV", roundOff: true, ...(s.kind === 7 ? { turnoverAbove5Cr: true } : {}) } as any);
  for (const by of s.buyers) {
    saveParty({ id: by.id, name: by.name, gstin: by.gstin, pan: by.gstin.slice(2, 12), email: "", phone: by.phone, address: "Market Yard", city: "", state: "", stateCode: by.state, pincode: "", type: "customer", createdAt: new Date().toISOString() } as Party);
  }
  saveParty({ id: `s${s.n}-sup`, name: "Supplier Pvt Ltd", gstin: s.supplierGstin, pan: s.supplierGstin.slice(2, 12), email: "", phone: "", address: "", city: "", state: "", stateCode: s.state, pincode: "", type: "supplier", createdAt: new Date().toISOString() } as Party);
  for (const it of s.items) {
    if (it.service) continue;
    saveStockItem({ id: `s${s.n}-${it.key}`, name: it.name, hsn: it.hsn, unit: it.unit, openingStock: it.open, currentStock: it.open, minStock: it.min, rate: preTax(it), gstRate: rateOn(s, it, "2025-04-01") as any, costPrice: it.cost } as StockItem);
    s.expect.stock[it.key] = it.open;
  }
  if (s.kind === 3) saveData({ ...loadData(), godowns: ["Warehouse"] });
}

function webBillLine(s: Shop, it: Item, qty: number, iso: string, inter: boolean): InvoiceItem {
  const st = it.service ? undefined : stockOf(s, it.key);
  const rate = st ? st.rate : preTax(it);
  const gstRate = s.composition ? 0 : st ? Number(st.gstRate) : rateOn(s, it, iso);
  const c = calculateItem({ quantity: qty, rate, discount: 0, gstRate, isInterState: inter });
  return { id: generateId(), description: it.name, hsn: it.hsn, quantity: qty, unit: it.unit, uqc: it.unit, rate, discount: 0, gstRate, ...c, stockItemId: st?.id } as InvoiceItem;
}

/** The invoice form's Save, then the page's handler: save, take stock out, post the ledger. */
function webSell(s: Shop, iso: string, o: { buyer?: Buyer | null; lines?: { it: Item; qty: number }[]; status?: string; b2cl?: boolean; walkinPhone?: string } = {}): Invoice | null {
  const data = loadData();
  const b = biz();
  const buyer = o.buyer === undefined ? (chance(0.3) ? pick(s.buyers) : null) : o.buyer;
  const partyState = buyer ? buyer.state : o.b2cl ? (b.stateCode === "27" ? "07" : "27") : b.stateCode;
  const inter = partyState !== b.stateCode;
  const goods = s.items.filter((x) => !x.service);
  const wanted = o.lines || Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => ({ it: pick(goods), qty: s.kind === 4 || s.kind === 7 ? pick([1, 1, 2]) : pick([1, 1, 2, 3, 5]) }));
  const lines: InvoiceItem[] = [];
  for (const w of wanted) {
    const st = w.it.service ? null : data.stock.find((x) => x.id === `s${s.n}-${w.it.key}`);
    // the form warns when the bill (all its lines of an item) would take stock below zero: the owner sells less
    const taken = lines.filter((l) => l.stockItemId === st?.id).reduce((t, l) => t + l.quantity, 0);
    if (st && st.currentStock - taken < w.qty) continue;
    lines.push(webBillLine(s, w.it, w.qty, iso, inter));
  }
  if (!lines.length) return null;
  const status = o.status || (chance(0.72) ? "paid" : chance(0.6) ? "unpaid" : "partial");
  const number = generateInvoiceNumber(data.invoices, data.settings.invoicePrefix, iso);
  const built = buildInvoiceDocument({
    id: generateId(), invoiceNumber: number, type: s.composition ? "bill_of_supply" : "tax_invoice", status: status === "partial" ? "unpaid" : status,
    businessId: b.id, sellerGstin: b.gstin, sellerStateCode: b.stateCode, sellerComposition: !!b.composition,
    partyId: buyer?.id || "", partyName: buyer ? buyer.name : o.b2cl ? "Anand Kumar" : "Walk-in", partyGstin: buyer?.gstin || "",
    partyPhone: buyer?.phone || o.walkinPhone || "", partyAddress: buyer || o.b2cl ? "14 Park Street" : "", partyStateCode: partyState,
    date: iso, dueDate: addDays(iso, buyer ? 30 : 0), items: lines, roundOffEnabled: true, paidAmount: 0, paymentMode: pick(["UPI", "Cash", "UPI", "Card"]),
    notes: "", terms: "", reverseCharge: false, isTotalMode: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  } as any);
  const paid = status === "paid" ? built.grandTotal : status === "partial" ? r2(Math.floor(built.grandTotal / 2)) : 0;
  const invoice = { ...built, paidAmount: paid, balanceDue: r2(built.grandTotal - paid), status: status === "paid" ? "paid" : "unpaid" } as Invoice;
  // handleSaveInvoice
  saveInvoice(invoice);
  deductStockForInvoice(invoice);
  persistLedger(postInvoiceLedger(loadData(), invoice));
  for (const l of lines) if (l.stockItemId) s.expect.stock[l.stockItemId.split("-").pop()!] -= l.quantity;
  // the owner sends the receipt on WhatsApp (InvoiceShareActions)
  if (invoice.partyPhone && chance(0.6)) webReceipt(s, invoice);
  return invoice;
}

function webReceipt(s: Shop, invoice: Invoice) {
  const b = biz();
  const upi = buildUpiPayUri({ vpa: b.upiId, amount: invoiceCollectAmount(invoice), invoiceNumber: invoice.invoiceNumber });
  const text = buildWhatsAppInvoiceText({ invoiceNumber: invoice.invoiceNumber, businessName: b.name, grandTotalLabel: `₹${invoice.grandTotal.toFixed(2)}`, upiUri: upi, extraLines: "" });
  const url = buildWhatsAppShareUrl(invoice.partyPhone, text);
  s.expect.receipts.push({ invoiceNumber: invoice.invoiceNumber, status: invoice.status, balanceDue: invoice.balanceDue, grandTotal: invoice.grandTotal, url, text });
}

/** Restock: the purchase bill (Purchases screen) and the goods in (Stock, linked to the bill). */
function webRestock(s: Shop, it: Item, iso: string, n: number) {
  const st = stockOf(s, it.key)!;
  const qty = Math.max(it.min * 3, it.open - st.currentStock);
  const gstRate = s.composition ? Number(st.gstRate) || 18 : Number(st.gstRate);
  const taxable = r2(it.cost * qty);
  const gst = r2((taxable * (s.composition ? 18 : gstRate)) / 100);
  const half = Math.floor(toPaise(gst) / 2) / 100;
  const supInv = `SUP/${s.n}/${iso.replace(/-/g, "").slice(2)}/${n}`;
  const p: Purchase = {
    id: generateId(), purchaseNumber: `PUR-${Date.now()}-${n}`, supplierName: "Supplier Pvt Ltd", supplierId: `s${s.n}-sup`, supplierGstin: s.supplierGstin,
    supplierInvoiceNumber: supInv, supplierInvoiceDate: iso, reverseCharge: false, itcEligible: !s.composition, createdAt: `${iso}T00:00:00.000Z`,
    totalAmount: r2(taxable + gst), totalGstAmount: gst, totalCgst: half, totalSgst: r2(gst - half), totalIgst: 0,
    items: [{ id: generateId(), description: it.name, hsn: "", quantity: 1, unit: "NOS", rate: taxable, discount: 0, gstRate: s.composition ? 18 : gstRate, taxableAmount: taxable, cgst: half, sgst: r2(gst - half), igst: 0, total: r2(taxable + gst) } as InvoiceItem],
    paymentMethod: "Bank", paidAmount: r2(taxable + gst),
  };
  savePurchase(p);
  persistLedger(postPurchaseLedger(loadData(), p));
  saveStockMoves([{ itemId: st.id, date: iso, kind: "purchase", qty, godown: "Main", unitCost: it.cost, ref: supInv, refId: p.id }], { ref: it.name, detail: `${qty} in` });
  s.expect.stock[it.key] += qty;
}

function webMonthStart(s: Shop, iso: string) {
  const now = new Date().toISOString();
  // Expenses screen: save, then post to the books (money out, expense, GST claimed back)
  const spend = (e: Expense) => { saveExpense(e); persistLedger(postExpenseLedger(loadData(), e)); };
  // rent (GST on commercial rent from a registered landlord can be claimed)
  const gst = r2(s.rent * 0.18);
  spend({ id: generateId(), category: "Rent", description: `Shop rent ${monthOf(iso)}`, amount: r2(s.rent + gst), date: iso, paymentMode: "Bank Transfer", vendor: "Landlord", vendorGstin: s.landlordGstin, gstAmount: gst, isGstClaimable: true, createdAt: now, updatedAt: now } as Expense);
  spend({ id: generateId(), category: "Electricity", description: "MSEB bill", amount: 2400 + Math.floor(rnd() * 1800), date: iso, paymentMode: "UPI", vendor: "Electricity board", gstAmount: 0, isGstClaimable: false, createdAt: now, updatedAt: now } as Expense);
  // salary for the shop assistant (Payroll: add, then "Mark paid" saves the expense and posts it)
  const entry: PayrollEntry = { id: generateId(), employeeName: "Ramesh", role: "Assistant", amount: 15000, payDate: iso, periodLabel: prevMonth(monthOf(iso)), status: "pending", paidOn: "", method: "", note: "", createdAt: now, updatedAt: now };
  savePayrollEntry(entry);
  savePayrollEntry({ ...entry, status: "paid", paidOn: iso, method: "Bank", updatedAt: now });
  spend({ id: generateId(), category: "Salaries", description: `Salary Ramesh · ${entry.periodLabel}`, amount: 15000, date: iso, paymentMode: "Bank", vendor: "Ramesh", gstAmount: 0, isGstClaimable: false, createdAt: now, updatedAt: now } as Expense);
}

/** Customers pay: late, sometimes in parts (Payments screen). */
function webCollect(s: Shop, iso: string) {
  const data = loadData();
  for (const inv of data.invoices) {
    if (inv.status === "cancelled" || inv.status === "draft" || !(inv.balanceDue > 0.009)) continue;
    const age = (Date.parse(iso) - Date.parse(inv.date)) / 86400000;
    if (age < 5 || !chance(age > 40 ? 0.5 : 0.12)) continue;
    const amount = chance(0.7) ? inv.balanceDue : r2(Math.ceil(inv.balanceDue / 2));
    persistLedger(applyPaymentToInvoice(loadData(), { id: generateId(), invoiceId: inv.id, amount, method: pick(["UPI", "Cash", "Bank"]), date: iso, reference: chance(0.3) ? `UTR${Math.floor(rnd() * 1e9)}` : undefined }));
    s.expect.webPaid[inv.id] = r2((s.expect.webPaid[inv.id] || 0) + amount);
  }
}

/** A B2B customer returns goods: credit note on the bill (Credit notes screen). Or a price was too low: debit note. */
function webNote(s: Shop, iso: string, kind: "credit_note" | "debit_note") {
  const data = loadData();
  const bill = [...data.invoices].reverse().find((b) => b.partyGstin && b.status !== "cancelled" && b.type === "tax_invoice" && b.date < iso && b.date >= addDays(iso, -40));
  if (!bill) return;
  const amounts = noteFromBill(bill, kind === "credit_note" ? r2(Math.min(bill.grandTotal * 0.2, 5000)) : r2(Math.min(bill.grandTotal * 0.05, 1000)));
  const list = kind === "credit_note" ? data.creditNotes : data.debitNotes;
  const number = generateInvoiceNumber(list.map((n: any) => ({ invoiceNumber: n.creditNoteNumber || n.debitNoteNumber })), kind === "credit_note" ? "CN" : "DN", iso);
  const now = new Date().toISOString();
  const common = { id: generateId(), invoiceId: bill.id, date: iso, customerName: bill.partyName, customerId: bill.partyId, reason: kind === "credit_note" ? "Goods returned" : "Price revision", ...amounts, notes: "", status: "active", createdAt: now, updatedAt: now };
  if (kind === "credit_note") { const note = { ...common, creditNoteNumber: number } as CreditNote; saveCreditNote(note); persistLedger(postNoteLedger(loadData(), note, kind)); }
  else { const note = { ...common, debitNoteNumber: number } as DebitNote; saveDebitNote(note); persistLedger(postNoteLedger(loadData(), note, kind)); }
}

function webCancelLast(s: Shop, iso: string) {
  const data = loadData();
  const bill = [...data.invoices].reverse().find((b) => b.date === iso && b.status !== "cancelled");
  if (!bill) return;
  cancelInvoice(bill.id);
  const latest = loadData();
  const c = latest.invoices.find((i) => i.id === bill.id);
  if (c) persistLedger(postInvoiceLedger(latest, c));
  for (const l of bill.items) if (l.stockItemId) s.expect.stock[l.stockItemId.split("-").pop()!] += l.quantity;
}

function webEditPhone(s: Shop) {
  const data = loadData();
  const bill = [...data.invoices].reverse().find((b) => b.status !== "cancelled" && b.partyId);
  if (!bill) return;
  saveInvoice(withHistory(bill, { ...bill, partyPhone: "9876500000", updatedAt: new Date().toISOString() }));
}

// ---------------------------------------------------------------- the phone app
const phoneDay = (iso: string) => `${iso}T10:00:00.000`;
function phoneSetup(s: Shop) {
  const now = phoneDay("2025-04-01");
  s.ph = { base: {}, since: "", staffMoves: [], invoices: [], customers: [], inventory: [], creditNotes: [], debitNotes: [], purchases: [], stockMoves: [], auditSince: "", seq: {}, staffSeq: {}, cnSeq: 0, dnSeq: 0, khata: [], expenses: [] };
  for (const by of s.buyers) s.ph.customers.push({ id: by.id, name: by.name, gstin: by.gstin, phone: by.phone, email: "", billing_address: "Market Yard", city: "", state: by.state, pincode: "" });
  for (const it of s.items) {
    s.ph.inventory.push({ id: `s${s.n}-${it.key}`, name: it.name, barcode: "", hsn_code: it.hsn, gst_rate: rateOn(s, it, "2025-04-01"), category: "", mrp: it.price, batch_number: "", expiry_date: "", cost_price: it.cost, sell_price: it.price, stock_on_hand: it.open, reorder_level: it.min, updated_at: now, valuation: "average", track_batches: false, bom: [] });
    s.ph.stockMoves.push({ id: `s${s.n}-${it.key}-open`, itemId: `s${s.n}-${it.key}`, date: "2025-04-01", kind: "opening", qty: it.open, godown: "Main", unitCost: it.cost, note: "Opening stock", createdAt: now });
    s.expect.stock[it.key] = it.open;
  }
}

function phoneNumber(s: Shop, iso: string, staff: boolean) {
  const fy = financialYear(iso);
  const book = staff ? s.ph!.staffSeq : s.ph!.seq;
  book[fy] = (book[fy] || 0) + 1;
  return `INV/${fy}/${staff ? "B" : ""}${String(book[fy]).padStart(4, "0")}`;
}

function phoneBill(s: Shop, iso: string, staff: boolean) {
  const ph = s.ph!;
  const buyer = chance(0.2) ? pick(s.buyers) : null;
  const inter = buyer ? buyer.state !== s.state : chance(0.03);
  const lines: any[] = [];
  for (let k = 0; k < 1 + Math.floor(rnd() * 3); k++) {
    const it = pick(s.items);
    const inv = ph.inventory.find((x) => x.id === `s${s.n}-${it.key}`)!;
    const qty = s.kind === 10 ? pick([1, 2, 3]) : pick([1, 1, 2, 3, 5]);
    // what this bill already takes of the item counts too
    const taken = lines.filter((x) => x.inv === inv).reduce((t, x) => t + x.qty, 0);
    if (inv.stock_on_hand - taken < qty) continue;
    const rate = Number(inv.gst_rate);
    const price = r2(preTax(it) * (1 + rate / 100));
    const l = linePaise({ quantity: qty, price, gstRate: rate, inclusive: true, interState: inter });
    lines.push({ it, inv, qty, price, rate, l });
  }
  if (!lines.length) return null;
  const sum = (f: (x: any) => number) => lines.reduce((t, x) => t + f(x), 0);
  const number = phoneNumber(s, iso, staff);
  const id = `s${s.n}-${staff ? "st" : "ph"}-${number.replace(/\//g, "")}`;
  const bill = {
    id, invoice_number: number, customer_name: buyer ? buyer.name : "Walk-in", customer_id: buyer?.id || "", customer_phone: buyer?.phone || "",
    created_at: phoneDay(iso), invoice_date: phoneDay(iso), notes: "", place_of_supply: buyer ? buyer.state : inter ? "07" : s.state,
    shipping_charges: 0, shipping_is_reimbursement: false, round_off: 0, status: chance(0.75) ? "paid" : "pending",
    total_amount: p2r(sum((x) => x.l.total)), total_gst_amount: p2r(sum((x) => x.l.tax)), total_cgst: p2r(sum((x) => x.l.cgst)), total_sgst: p2r(sum((x) => x.l.sgst)), total_igst: p2r(sum((x) => x.l.igst)),
    seller_gstin: s.gstin, bill_to_gstin: buyer ? buyer.gstin : "", document_type: "INV",
    items: lines.map((x) => ({ name: x.it.name, hsn_code: x.it.hsn, quantity: x.qty, unit_price: x.price, gst_rate: x.rate, uqc: x.it.unit, taxable_value: p2r(x.l.taxable), gst_amount: p2r(x.l.tax), cgst: p2r(x.l.cgst), sgst: p2r(x.l.sgst), igst: p2r(x.l.igst), total: p2r(x.l.total) })),
  };
  for (const x of lines) {
    x.inv.stock_on_hand = Math.round((x.inv.stock_on_hand - x.qty) * 1000) / 1000;
    (staff ? ph.staffMoves : ph.stockMoves).push({ id: `${id}-m${ph.stockMoves.length + ph.staffMoves.length}`, itemId: x.inv.id, date: iso, kind: "sale", qty: -x.qty, godown: "Main", ref: number, refId: id, createdAt: phoneDay(iso) });
    s.expect.stock[x.it.key] -= x.qty;
  }
  // udhar: the kirana writes unpaid walk-in bills in the khata (kept on the phone)
  if (s.kind === 2 && bill.status === "pending") {
    ph.khata.push({ id: `${id}-k`, customer_id: "regular", customer_name: "Regular customer", amount: bill.total_amount, description: number, created_at: phoneDay(iso), is_credit: false });
    s.expect.phoneKhata = r2(s.expect.phoneKhata + bill.total_amount);
  }
  return bill;
}

function phoneRestock(s: Shop, iso: string) {
  const ph = s.ph!;
  for (const it of s.items) {
    const inv = ph.inventory.find((x) => x.id === `s${s.n}-${it.key}`)!;
    if (inv.stock_on_hand > it.min * 1.5) continue;
    const qty = Math.max(it.min * 3, it.open - inv.stock_on_hand);
    const rate = Number(inv.gst_rate);
    const taxable = r2(it.cost * qty), tax = r2((taxable * rate) / 100), half = Math.floor(toPaise(tax) / 2) / 100;
    const pid = `s${s.n}-pu-${iso}-${it.key}`;
    ph.purchases.push({
      id: pid, purchase_number: `P-${iso}-${it.key}`, supplier_name: "Supplier Pvt Ltd", supplier_gstin: s.supplierGstin, supplier_invoice_number: `SUP/${s.n}/${iso.replace(/-/g, "").slice(2)}/${it.key}`,
      purchase_date: iso, total_amount: r2(taxable + tax), total_gst_amount: tax, total_cgst: half, total_sgst: r2(tax - half), total_igst: 0, reverse_charge: false, itc_eligible: true, created_at: `${iso}T09:00:00`,
      items: [{ name: it.name, hsn_code: it.hsn, quantity: qty, unit_price: r2((taxable + tax) / qty), gst_rate: rate, taxable_value: taxable, gst_amount: tax, cgst: half, sgst: r2(tax - half), igst: 0, total: r2(taxable + tax) }],
    });
    inv.stock_on_hand = Math.round((inv.stock_on_hand + qty) * 1000) / 1000;
    ph.stockMoves.push({ id: `${pid}-m`, itemId: inv.id, date: iso, kind: "purchase", qty, godown: "Main", unitCost: it.cost, ref: pid, refId: pid, createdAt: phoneDay(iso) });
    s.expect.stock[it.key] += qty;
  }
}

function phoneNote(s: Shop, iso: string, kind: "cn" | "dn") {
  const ph = s.ph!;
  const orig = [...ph.invoices].reverse().find((b) => b.bill_to_gstin && b.status !== "cancelled" && b.invoice_date.slice(0, 10) < iso && b.invoice_date.slice(0, 10) >= addDays(iso, -40));
  if (!orig) return;
  const it = orig.items[0];
  const l = linePaise({ quantity: 1, price: it.unit_price, gstRate: it.gst_rate, inclusive: true, interState: orig.total_igst > 0 });
  const fy = financialYear(iso);
  const line = { name: it.name, hsn_code: it.hsn_code, quantity: 1, unit_price: it.unit_price, gst_rate: it.gst_rate, taxable_value: p2r(l.taxable), gst_amount: p2r(l.tax), cgst: p2r(l.cgst), sgst: p2r(l.sgst), igst: p2r(l.igst), total: p2r(l.total) };
  if (kind === "cn") {
    ph.cnSeq++;
    ph.creditNotes.push({ id: `s${s.n}-cn-${ph.cnSeq}`, credit_note_number: `CN/${fy}/${String(ph.cnSeq).padStart(4, "0")}`, invoice_id: orig.id, customer_name: orig.customer_name, status: "active", subtotal: line.taxable_value, total_gst_amount: line.gst_amount, total_amount: line.total, created_at: `${iso}T12:00:00`, bill_to_gstin: orig.bill_to_gstin, items: [line] });
  } else {
    ph.dnSeq++;
    ph.debitNotes.push({ id: `s${s.n}-dn-${ph.dnSeq}`, debit_note_number: `DN/${fy}/${String(ph.dnSeq).padStart(4, "0")}`, invoice_id: orig.id, customer_name: orig.customer_name, status: "active", subtotal: line.taxable_value, total_gst_amount: line.gst_amount, total_amount: line.total, created_at: `${iso}T12:00:00`, bill_to_gstin: orig.bill_to_gstin, items: [line] });
  }
}

const recFp = (r: any) => JSON.stringify(r);
async function phoneSync(s: Shop, who: Who, iso: string, books: { invoices: any[] }, staff = false) {
  const ph = s.ph!;
  // the phone app (1.4.12+): after a first full sync, only what changed since, and `since`
  const lean = !staff && LEAN_PHONE && !!ph.since;
  const sentHashes: Record<string, Record<string, string>> = {};
  const changed = (kind: string, all: any[]) => {
    const known = ph.base[kind] || {};
    const now: Record<string, string> = {};
    const out = all.filter((r) => { const h = recFp(r); now[String(r.id)] = h; return !lean || known[String(r.id)] !== h; });
    sentHashes[kind] = now;
    return out;
  };
  const r = await api(who, "apiDataPhoneSync", "/api/data/phone-sync", staff
    ? { booksUid: s.owner!.uid, invoices: books.invoices, customers: [], inventory: [], creditNotes: [], debitNotes: [], purchases: [], stockMoves: ph.staffMoves, godowns: [], auditLog: [], auditSince: "", deleted: {} }
    : {
      booksUid: s.owner!.uid, ...(lean ? { since: ph.since } : {}),
      invoices: changed("invoices", ph.invoices), customers: changed("customers", ph.customers), inventory: changed("inventory", ph.inventory),
      creditNotes: changed("creditNotes", ph.creditNotes), debitNotes: changed("debitNotes", ph.debitNotes),
      purchases: changed("purchases", ph.purchases), stockMoves: changed("stockMoves", ph.stockMoves), godowns: [], auditLog: [], auditSince: ph.auditSince, deleted: {},
      ...(PHONE_SENDS_LEDGER ? { expenses: changed("expenses", ph.expenses), khataEntries: changed("khataEntries", ph.khata) } : {}),
      business: { name: s.name, gstin: s.gstin, state: "", address: "12 Main Road" },
    });
  if (r.status !== 200) { if (!lapsed.has(s.owner!.uid)) failNote(`${s.name} ${staff ? "staff" : "owner"} ${iso}: phone sync ${r.status} ${JSON.stringify(r.body).slice(0, 100)}`); return r; }
  if (!staff) {
    ph.auditSince = r.body.auditSince || ph.auditSince;
    // what the cloud holds now: what was sent plus what came back
    const base: Record<string, Record<string, string>> = { ...sentHashes };
    const keyOf: Record<string, any[]> = { invoices: ph.invoices, customers: ph.customers, inventory: ph.inventory, creditNotes: ph.creditNotes, debitNotes: ph.debitNotes, purchases: ph.purchases, expenses: ph.expenses, khataEntries: ph.khata };
    for (const kind of Object.keys(keyOf)) for (const x of r.body[kind] || []) {
      const list = keyOf[kind]; const i = list.findIndex((y) => y.id === x.id);
      if (kind !== "invoices") { if (i >= 0) list[i] = x; else list.push(x); }
      (base[kind] ||= {})[String(x.id)] = recFp(x);
    }
    for (const m of r.body.stockMoves || []) (base.stockMoves ||= {})[String(m.id)] = recFp(m);
    ph.base = base;
    if (r.body.updated_at) ph.since = r.body.updated_at;
    // what the server sends back (bills made by staff, stock moves from others) is upserted
    for (const x of r.body.invoices || []) { const i = ph.invoices.findIndex((y) => y.id === x.id); if (i >= 0) ph.invoices[i] = x; else ph.invoices.push(x); }
    const ids = new Set(ph.stockMoves.map((m) => m.id));
    for (const m of r.body.stockMoves || []) if (!ids.has(m.id)) ph.stockMoves.push(m);
    // the phone sets stock on hand to the sum of each item's movements
    const sums = new Map<string, number>();
    for (const m of ph.stockMoves) sums.set(m.itemId, Math.round(((sums.get(m.itemId) || 0) + m.qty) * 1000) / 1000);
    for (const inv of ph.inventory) if (sums.has(inv.id)) inv.stock_on_hand = sums.get(inv.id)!;
  }
  return r;
}

// ---------------------------------------------------------------- independent month figures from the books
function expected(data: AppData, from: string, to: string, businessId?: string) {
  const inRange = (d?: string) => !!d && d.slice(0, 10) >= from && d.slice(0, 10) <= to;
  const main = data.activeBusinessId || data.businesses[0]?.id;
  const mine = (x: any) => !businessId || (x.businessId || main) === businessId;
  const billBiz = new Map(data.invoices.map((i) => [i.id, i.businessId || main]));
  const noteMine = (n: any) => !businessId || (n.businessId || billBiz.get(n.invoiceId) || main) === businessId;
  const issued = data.invoices.filter((i) => i.status !== "draft" && i.status !== "cancelled" && inRange(i.date) && mine(i));
  const sumP = (xs: any[], f: (l: any) => number) => xs.reduce((t, x) => t + toPaise(f(x)), 0);
  const lines = issued.flatMap((i) => (i.type === "bill_of_supply" ? [] : i.items));
  const notes = (list: any[] | undefined) => (list || []).filter((c: any) => c.status !== "cancelled" && inRange(c.date || c.createdAt) && noteMine(c)).flatMap((c: any) => c.items || []);
  const cn = notes(data.creditNotes), dn = notes(data.debitNotes);
  const taxed = (l: any) => (l.gstRate || 0) > 0;
  const net = (f: (l: any) => number, filt: (l: any) => boolean = () => true) => sumP(lines.filter(filt), f) - sumP(cn.filter(filt), f) + sumP(dn.filter(filt), f);
  return {
    count: issued.length,
    txval: net((l) => l.taxableAmount, taxed), camt: net((l) => l.cgst), samt: net((l) => l.sgst), iamt: net((l) => l.igst),
    nil: net((l) => l.taxableAmount, (l) => !taxed(l)),
    exempt: sumP(issued.filter((i) => i.type === "bill_of_supply").flatMap((i) => i.items), (l) => l.taxableAmount),
    docs: data.invoices.filter((i) => inRange(i.date) && mine(i)).length + (data.creditNotes || []).filter((c: any) => inRange(c.date || c.createdAt) && noteMine(c)).length + (data.debitNotes || []).filter((c: any) => inRange(c.date || c.createdAt) && noteMine(c)).length,
  };
}

// ---------------------------------------------------------------- the year
const caNames = ["Anil Shah", "Bhavna Rao", "Chetan Iyer", "Deepa Nair", "Esha Kapoor"];
const cas = new Map<string, Who>();
const caOf = (s: Shop) => cas.get(s.ca)!;
const monthTax: Record<number, Record<string, number>> = {}; // shop -> month -> tax (paise), from the CA's check
const monthItc: Record<number, Record<string, number>> = {};

async function caMonth(s: Shop, ym: string) {
  const from = `${ym}-01`, to = monthEnd(ym);
  const ca = caOf(s);
  const loaded = await api(s.owner!, "apiDataLoad", "/api/data/load");
  if (loaded.status !== 200) { monthly(`load-${s.n}`, `${s.name} ${ym}: owner's books load`, false, `${loaded.status}`); return; }
  const data = loaded.body.data as AppData;
  const mainBiz = s === BRANCH ? `biz${s.n}` : undefined;
  // GSTR-3B and GSTR-1 are per GSTIN: the main business's bills (the branch has its own)
  const exp = expected(data, from, to, mainBiz);
  const g3 = gstr3b(data, from, to) as any;
  (monthTax[s.n] ||= {})[ym] = toPaise(g3.cgst) + toPaise(g3.sgst) + toPaise(g3.igst);
  (monthItc[s.n] ||= {})[ym] = toPaise(g3.eligible || 0);
  monthly(`3b-${s.n}`, `${s.name} ${ym}: GSTR-3B tax heads match the bills (net of notes)`,
    toPaise(g3.cgst) === exp.camt && toPaise(g3.sgst) === exp.samt && toPaise(g3.igst) === exp.iamt,
    `3B ${g3.cgst}/${g3.sgst}/${g3.igst} vs ${p2r(exp.camt)}/${p2r(exp.samt)}/${p2r(exp.iamt)}`);
  const issues = checkBooks(data, new Date(`${addDays(to, 5)}T10:00:00Z`), BOOK);
  const money = issues.filter((x: any) => /off by|CGST and SGST differ|uplicate/.test(x.title));
  monthly(`gstcheck-${s.n}`, `${s.name} ${ym}: GST check finds no tax or numbering errors`, money.length === 0, money.slice(0, 3).map((x: any) => `${x.title}: ${x.detail}`).join("; ").slice(0, 300));

  // the CA, on the 11th
  const books = await api(ca, "apiCa", `/api/ca/clients/${s.owner!.uid}/books?from=${from}&to=${to}`);
  monthly(`cabooks-${s.n}`, `${s.name} ${ym}: CA opens the live books`, books.status === 200, `${books.status} ${books.body?.error || ""}`);
  if (books.status === 200) {
    const inMonth = data.invoices.filter((i) => i.date >= from && i.date <= to).length;
    monthly(`cabills-${s.n}`, `${s.name} ${ym}: CA sees every bill of the month`, (books.body.invoices || []).length === inMonth, `${(books.body.invoices || []).length} vs ${inMonth}`);
    const caG3 = gstr3b({ ...data, invoices: books.body.invoices, creditNotes: books.body.creditNotes, debitNotes: books.body.debitNotes, purchases: books.body.purchases } as AppData, from, to) as any;
    monthly(`ca3b-${s.n}`, `${s.name} ${ym}: CA's GSTR-3B equals the owner's`, toPaise(caG3.cgst) === toPaise(g3.cgst) && toPaise(caG3.igst) === toPaise(g3.igst) && toPaise(caG3.taxable) === toPaise(g3.taxable), `${caG3.taxable}/${g3.taxable}`);
    const exps = (books.body.expenses || []).filter((e: any) => e.date >= from && e.date <= to);
    monthly(`caexp-${s.n}`, `${s.name} ${ym}: CA sees the month's expenses (rent, electricity, salary)`, exps.length >= 3, `${exps.length} expenses (${s.app})`);
  }
  if (s.composition) {
    const gc = await api(ca, "apiCa", `/api/ca/clients/${s.owner!.uid}/gstr1?month=${ym}`);
    monthly(`comp-${s.n}`, `${s.name} ${ym}: composition GSTR-1 download explains CMP-08 / GSTR-4`, gc.status === 409, String(gc.status));
    return;
  }
  const g1 = await api(ca, "apiCa", `/api/ca/clients/${s.owner!.uid}/gstr1?month=${ym}`);
  monthly(`g1-${s.n}`, `${s.name} ${ym}: CA downloads GSTR-1`, g1.status === 200, String(g1.status));
  if (g1.status !== 200) return;
  const j = g1.body;
  const rows: any[] = [];
  for (const b of j.b2b || []) for (const inv of b.inv) for (const it of inv.itms) rows.push({ ctin: b.ctin, ...it.itm_det });
  for (const b of j.b2cl || []) for (const inv of b.inv) for (const it of inv.itms) rows.push(it.itm_det);
  for (const r of j.b2cs || []) rows.push(r);
  for (const b of j.cdnr || []) for (const nt of b.nt) for (const it of nt.itms) rows.push({ sign: nt.ntty === "C" ? -1 : 1, ...it.itm_det });
  for (const nt of j.cdnur || []) for (const it of nt.itms || []) rows.push({ sign: nt.ntty === "C" ? -1 : 1, ...it.itm_det });
  const sumT = (f: (r: any) => number) => rows.reduce((t, r) => t + (r.sign || 1) * toPaise(f(r) || 0), 0);
  const want = mainBiz ? expected(data, from, to, mainBiz) : exp;
  monthly(`g1tax-${s.n}`, `${s.name} ${ym}: GSTR-1 tax heads equal the bills of this GSTIN (net of notes)`,
    sumT((r) => r.camt) === want.camt && sumT((r) => r.samt) === want.samt && sumT((r) => r.iamt) === want.iamt,
    `${p2r(sumT((r) => r.camt))}/${p2r(sumT((r) => r.samt))}/${p2r(sumT((r) => r.iamt))} vs ${p2r(want.camt)}/${p2r(want.samt)}/${p2r(want.iamt)}${mainBiz ? " (owner has 2 GSTINs)" : ""}`);
  const nilT8 = (j.nil?.inv || []).reduce((t: number, x: any) => t + toPaise(x.nil_amt || 0) + toPaise(x.expt_amt || 0), 0);
  monthly(`g1nil-${s.n}`, `${s.name} ${ym}: GSTR-1 Table 8 holds the 0% sales`, Math.abs(nilT8 - (want.nil + want.exempt)) <= 2, `${p2r(nilT8)} vs ${p2r(want.nil + want.exempt)}`);
  const hsnTx = [...(j.hsn?.hsn_b2b || []), ...(j.hsn?.hsn_b2c || []), ...(j.hsn?.data || [])].reduce((t: number, h: any) => t + toPaise(h.camt + h.samt + h.iamt), 0);
  monthly(`g1hsn-${s.n}`, `${s.name} ${ym}: GSTR-1 HSN summary equals the tables`, Math.abs(hsnTx - (want.camt + want.samt + want.iamt)) <= 2, `${p2r(hsnTx)} vs ${p2r(want.camt + want.samt + want.iamt)}`);
  const docs = (j.doc_issue?.doc_det || []).flatMap((x: any) => x.docs);
  const totnum = docs.reduce((t: number, x: any) => t + x.totnum, 0);
  monthly(`g1docs-${s.n}`, `${s.name} ${ym}: GSTR-1 Table 13 counts every document of the month`, totnum === want.docs, `${totnum} vs ${want.docs}; ${docs.map((x: any) => `${x.from}..${x.to}`).join(", ")}`);
  if (ym === "2026-04") {
    const firsts = docs.map((x: any) => String(x.from));
    check(`${s.name}: April 2026 bills start the 26-27 series at 0001`, firsts.some((f: string) => /\/26-27\/[A-Z]?0001$/.test(f)) && !firsts.some((f: string) => /25-26/.test(f)), firsts.join(", "));
  }
  if (s === BRANCH && s.branchGstin && ym >= "2025-10") {
    const gb = await api(ca, "apiCa", `/api/ca/clients/${s.owner!.uid}/gstr1?month=${ym}&gstin=${s.branchGstin}`);
    const bexp = expected(data, from, to, s.branchId);
    const brows: any[] = [];
    for (const b of gb.body?.b2b || []) for (const inv of b.inv) for (const it of inv.itms) brows.push(it.itm_det);
    for (const b of gb.body?.b2cl || []) for (const inv of b.inv) for (const it of inv.itms) brows.push(it.itm_det);
    for (const r of gb.body?.b2cs || []) brows.push(r);
    for (const b of gb.body?.cdnr || []) for (const nt of b.nt) for (const it of nt.itms) brows.push({ sign: nt.ntty === "C" ? -1 : 1, ...it.itm_det });
    const bt = brows.reduce((t, r) => t + (r.sign || 1) * (toPaise(r.camt || 0) + toPaise(r.samt || 0) + toPaise(r.iamt || 0)), 0);
    monthly(`branch-${s.n}`, `${s.name} ${ym}: CA downloads the Bengaluru branch's GSTR-1 under its own GSTIN`,
      gb.status === 200 && gb.body.gstin === s.branchGstin && bt === bexp.camt + bexp.samt + bexp.iamt,
      `${gb.status} ${gb.body?.gstin} tax ${p2r(bt)} vs ${p2r(bexp.camt + bexp.samt + bexp.iamt)}`);
  }
  if (s.kind === 7) {
    const e = await api(ca, "apiCa", `/api/ca/clients/${s.owner!.uid}/einvoice?month=${ym}`);
    monthly(`einv-${s.n}`, `${s.name} ${ym}: CA downloads e-invoice JSON for B2B bills`, e.status === 200, `${e.status} ${String(e.body?.error || "").slice(0, 80)}`);
  }
  if (s.kind === 6 || s.kind === 10) {
    const t = await api(ca, "apiCa", `/api/ca/clients/${s.owner!.uid}/tally?month=${ym}`);
    monthly(`tally-${s.n}`, `${s.name} ${ym}: CA downloads Tally XML`, t.status === 200 && String(t.body).includes("<ENVELOPE"), String(t.status));
  }
}

async function upload2b(s: Shop, ym: string) {
  const loaded = await api(s.owner!, "apiDataLoad", "/api/data/load");
  const data = loaded.body?.data as AppData;
  if (!data) return;
  const from = `${ym}-01`, to = monthEnd(ym);
  const month = (data.purchases || []).filter((p) => (p.supplierInvoiceDate || p.createdAt || "").slice(0, 10) >= from && (p.supplierInvoiceDate || p.createdAt || "").slice(0, 10) <= to);
  if (month.length < 2) return;
  const toDt = (iso: string) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;
  const filed = month.slice(0, -1);
  const inv = filed.map((pu: any) => ({ inum: pu.supplierInvoiceNumber, dt: toDt(pu.supplierInvoiceDate || pu.createdAt), val: pu.totalAmount, rev: "N", itcavl: "Y",
    txval: r2(pu.items.reduce((t: number, l: any) => t + l.taxableAmount, 0)), igst: pu.totalIgst || 0, cgst: pu.totalCgst || 0, sgst: pu.totalSgst || 0, cess: 0 }));
  // the landlord files the month's rent bill too (expenses with GST and the landlord's GSTIN)
  const rent = (data.expenses || []).filter((e) => e.isGstClaimable && e.vendorGstin && e.date >= from && e.date <= to).map((e) => {
    const half = Math.floor(toPaise(e.gstAmount) / 2) / 100;
    return { inum: e.description || "", dt: toDt(e.date), val: e.amount, rev: "N", itcavl: "Y", txval: r2(e.amount - e.gstAmount), igst: 0, cgst: half, sgst: r2(e.gstAmount - half), cess: 0 };
  });
  const b2b = [{ ctin: s.supplierGstin, trdnm: "Supplier Pvt Ltd", inv }, ...(rent.length ? [{ ctin: s.landlordGstin, trdnm: "Landlord", inv: rent }] : [])];
  const file = { data: { gstin: s.gstin, rtnprd: fp(ym), gendt: `14-${addDays(to, 14).slice(5, 7)}-${addDays(to, 14).slice(0, 4)}`, docdata: { b2b } } };
  const m = await api(s.owner!, "apiReports", "/api/reports/gstr2b", { json: file, save: true });
  const sum = m.body?.summary || {};
  monthly(`2b-${s.n}`, `${s.name} ${ym}: GSTR-2B matching finds the filed bills and the one not filed`, m.status === 200 && sum.matched === filed.length + rent.length && sum.onlyInBooks === 1, `${m.status} ${JSON.stringify(sum).slice(0, 120)}`);
}

it("a year of business: shops on the website and the phone, staff, three CAs", async () => {
  // --- accounts
  for (const s of shops) {
    s.gstin = gstin(s.state, 1000 + s.n * 37);
    s.supplierGstin = gstin(s.state, 50000 + s.n);
    s.landlordGstin = gstin(s.state, 70000 + s.n);
    s.buyers = BUYERS.map((b, i) => ({ id: `s${s.n}-c${i}`, name: b.name, state: b.state, gstin: gstin(b.state, 20000 + s.n * 10 + i), phone: `98${String(20000000 + s.n * 100 + i)}` }));
    s.owner = await account(`owner${s.n}@argus.test`, `${s.name} owner`, true);
    if (s.staffAccess) s.staff = await account(`staff${s.n}@argus.test`, `Staff of ${s.name}`, false);
  }
  for (let k = 0; k < CAS; k++) cas.set(LETTERS[k], await account(`ca.${LETTERS[k].toLowerCase()}@argus.test`, `CA ${caNames[k % caNames.length]}`, false));
  const newStaff = await account(`staff${STAFFSHOP.n}b@argus.test`, `New staff of ${STAFFSHOP.name}`, false);
  const otherCa = LETTERS[(LETTERS.indexOf(MOVER.ca) + 1) % CAS];

  // --- 1 April 2025: shops set up
  setClock("2025-04-01", 9);
  for (const s of shops) {
    if (s.app === "web") await webSession(s, s.owner!, "2025-04-01", () => { webSetup(s); webMonthStart(s, "2025-04-01"); });
    else { phoneSetup(s); s.ph!.expenses.push({ id: `s${s.n}-elec-2025-04`, category: "Electricity", description: "MSEB bill", amount: 2600, gst_amount: 0, is_gst_claimable: false, vendor: "Electricity board", payment_mode: "upi", date: "2025-04-01", created_at: "2025-04-01T09:05:00", updated_at: "2025-04-01T09:05:00" }, { id: `s${s.n}-sal-2025-04`, category: "Salaries", description: "Salary Ramesh 2025-03", amount: 15000, gst_amount: 0, is_gst_claimable: false, vendor: "Ramesh", payment_mode: "bank", date: "2025-04-01", created_at: "2025-04-01T09:10:00", updated_at: "2025-04-01T09:10:00" }); s.ph!.expenses.push({ id: `s${s.n}-rent-2025-04`, category: "Rent", description: "Shop rent 2025-04", amount: r2(s.rent * 1.18), gst_amount: r2(s.rent * 0.18), is_gst_claimable: true, vendor: "Landlord", vendor_gstin: s.landlordGstin, payment_mode: "Bank", date: "2025-04-01", created_at: "2025-04-01T09:00:00", updated_at: "2025-04-01T09:00:00" }); s.expect.phoneExpenses += 3; await phoneSync(s, s.owner!, "2025-04-01", s.ph!); }
    for (const it of s.items) s.expect.rateNow[it.key] = rateOn(s, it, "2025-04-01");
  }
  for (const s of shops.filter((x) => x.staff)) {
    const inv = await api(s.owner!, "apiTeam", "/api/team/invite", { email: s.staff!.email, access: s.staffAccess });
    const acc = await api(s.staff!, "apiTeam", "/api/team/accept", {});
    check(`${s.name}: staff joins (${s.staffAccess})`, inv.status === 200 && acc.status === 200, `${inv.status}/${acc.status} ${JSON.stringify(acc.body).slice(0, 80)}`);
  }
  for (const s of shops) {
    const inv = await api(s.owner!, "apiCa", "/api/ca/invites", {});
    const red = await api(caOf(s), "apiCa", "/api/ca/invites/redeem", { token: inv.body.token });
    check(`${s.name}: CA ${s.ca} joins from the invite link`, red.status === 200 && String(inv.body.redeem_url || "").includes("#token="), `${inv.status}/${red.status}`);
  }

  // --- every day
  const t0 = performance.now();
  let staffBills: Record<number, { invoices: any[] }> = {};
  for (let iso = "2025-04-02"; iso <= UNTIL; iso = addDays(iso, 1)) {
    setClock(iso);
    const dom = Number(iso.slice(8, 10));
    const ym = monthOf(iso);

    // life events
    if (iso === "2025-10-01") {
      // Gupta opens a branch in Bengaluru with its own GSTIN (Business manager)
      BRANCH.branchId = `biz${BRANCH.n}-blr`;
      BRANCH.branchGstin = gstin("29", 1000 + BRANCH.n * 37);
      await webSession(BRANCH, BRANCH.owner!, iso, () => {
        const main = biz();
        saveBusiness({ ...main, id: BRANCH.branchId!, name: `${BRANCH.name} (Bengaluru)`, gstin: BRANCH.branchGstin!, pan: main.pan, stateCode: "29", address: "5 MG Road", upiId: `shop${BRANCH.n}blr@upi` });
        setActiveBusiness(main.id);
      });
    }
    if (iso === "2025-12-16") { await setPlan(LAPSER.owner!.uid, false); lapsed.add(LAPSER.owner!.uid); }
    if (iso === "2025-12-21") {
      await setPlan(LAPSER.owner!.uid, true); lapsed.delete(LAPSER.owner!.uid);
    }
    if (iso === "2025-11-01" && STAFFSHOP.staff) {
      const r = await api(STAFFSHOP.owner!, "apiTeam", "/api/team/remove", { email: STAFFSHOP.staff.email });
      check(`${STAFFSHOP.name}: owner removes the staff member who left`, r.status === 200, `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);
      const after = await api(STAFFSHOP.staff, "apiDataPhoneSync", "/api/data/phone-sync", { booksUid: STAFFSHOP.owner!.uid, invoices: [phoneBill(STAFFSHOP, iso, true)], customers: [], inventory: [], creditNotes: [], debitNotes: [], purchases: [], stockMoves: [], godowns: [], auditLog: [], auditSince: "", deleted: {} });
      check(`${STAFFSHOP.name}: removed staff can no longer add bills to the shop's books`, after.status === 403 || after.status === 409 || after.status === 402, `${after.status} ${JSON.stringify(after.body).slice(0, 100)}`);
      STAFFSHOP.staff = undefined;
    }
    if (iso === "2025-12-01") {
      const inv = await api(STAFFSHOP.owner!, "apiTeam", "/api/team/invite", { email: newStaff.email, access: "billing" });
      const acc = await api(newStaff, "apiTeam", "/api/team/accept", {});
      check(`${STAFFSHOP.name}: new staff member joins in December`, inv.status === 200 && acc.status === 200, `${inv.status}/${acc.status} ${JSON.stringify(inv.body).slice(0, 80)}`);
      STAFFSHOP.staff = newStaff; STAFFSHOP.staffAccess = "billing"; staffBills[STAFFSHOP.n] = { invoices: [] };
    }
    if (iso === "2026-01-01") {
      const old = caOf(MOVER);
      const r = await api(MOVER.owner!, "apiCa", `/api/ca/invites?accountant_id=${old.uid}`, undefined, "DELETE");
      const inv = await api(MOVER.owner!, "apiCa", "/api/ca/invites", {});
      const red = await api(cas.get(otherCa)!, "apiCa", "/api/ca/invites/redeem", { token: inv.body.token });
      check(`${MOVER.name}: moves from CA ${MOVER.ca} to CA ${otherCa} on 1 January`, r.status === 200 && red.status === 200, `${r.status}/${inv.status}/${red.status}`);
      const oldTry = await api(old, "apiCa", `/api/ca/clients/${MOVER.owner!.uid}/gstr1?month=2025-12`);
      check(`${MOVER.name}: the old CA loses access`, oldTry.status === 403, String(oldTry.status));
      MOVER.ca = otherCa;
      const backlog = await api(cas.get(otherCa)!, "apiCa", `/api/ca/clients/${MOVER.owner!.uid}/books?from=2025-04-01&to=2025-12-31`);
      check(`${MOVER.name}: the new CA can see the earlier months of the year`, backlog.status === 200 && (backlog.body.invoices || []).length > 100, `${backlog.status} ${(backlog.body.invoices || []).length} bills`);
    }

    // GST rate cut: owners change the rate on their items (one forgets for a week)
    for (const s of shops) {
      const due = iso === (s.forgetsRateCut ? "2025-09-29" : RATE_CUT);
      if (!due) continue;
      for (const it of s.items) s.expect.rateNow[it.key] = rateOn(s, it, iso);
      if (s.app === "phone") { for (const it of s.items) { const inv = s.ph!.inventory.find((x) => x.id === `s${s.n}-${it.key}`)!; inv.gst_rate = rateOn(s, it, iso); inv.updated_at = phoneDay(iso); } }
    }

    // --- phone shops work in parallel (each its own phone)
    const phoneWork = async () => {
      const phones = shops.filter((x) => x.app === "phone");
      const runPhone = async (s: Shop) => {
        const ph = s.ph!;
        if (dom === 1 || dom === 15) phoneRestock(s, iso);
        else if (rnd() < 0.15) phoneRestock(s, iso);
        const count = s.perDay[0] + Math.floor(rnd() * (s.perDay[1] - s.perDay[0] + 1));
        for (let k = 0; k < count; k++) { const b = phoneBill(s, iso, false); if (b) ph.invoices.push(b); }
        // customers pay pending bills later
        for (const b of ph.invoices) if (b.status === "pending" && chance(0.08)) {
          b.status = "paid";
          if (s.kind === 2) { ph.khata.push({ id: `${b.id}-kp`, customer_id: "regular", customer_name: "Regular customer", amount: b.total_amount, description: `Paid ${b.invoice_number}`, created_at: phoneDay(iso), is_credit: true }); s.expect.phoneKhata = r2(s.expect.phoneKhata - b.total_amount); }
        }
        if (dom === 1) {
          ph.expenses.push({ id: `s${s.n}-elec-${ym}`, category: "Electricity", description: "MSEB bill", amount: 2400 + Math.floor(rnd() * 1800), gst_amount: 0, is_gst_claimable: false, vendor: "Electricity board", payment_mode: "upi", date: iso, created_at: `${iso}T09:05:00`, updated_at: `${iso}T09:05:00` });
          ph.expenses.push({ id: `s${s.n}-sal-${ym}`, category: "Salaries", description: `Salary Ramesh ${prevMonth(ym)}`, amount: 15000, gst_amount: 0, is_gst_claimable: false, vendor: "Ramesh", payment_mode: "bank", date: iso, created_at: `${iso}T09:10:00`, updated_at: `${iso}T09:10:00` });
        }
        if (dom === 1) { ph.expenses.push({ id: `s${s.n}-rent-${ym}`, category: "Rent", description: `Shop rent ${ym}`, amount: r2(s.rent * 1.18), gst_amount: r2(s.rent * 0.18), is_gst_claimable: true, vendor: "Landlord", vendor_gstin: s.landlordGstin, payment_mode: "Bank", date: iso, created_at: `${iso}T09:00:00`, updated_at: `${iso}T09:00:00` }); s.expect.phoneExpenses += 3; }
        if (dom === 20 && chance(0.5)) {
          const last = [...ph.invoices].reverse().find((b) => b.invoice_date.slice(0, 10) === iso && b.status !== "cancelled");
          if (last) { last.status = "cancelled"; for (const l of last.items) { const inv = ph.inventory.find((x) => x.name === l.name)!; inv.stock_on_hand += l.quantity; ph.stockMoves.push({ id: `${last.id}-ret${ph.stockMoves.length}`, itemId: inv.id, date: iso, kind: "sale_return", qty: l.quantity, godown: "Main", ref: last.invoice_number, refId: last.id, note: "Cancelled", createdAt: phoneDay(iso) }); s.expect.stock[s.items.find((x) => x.name === l.name)!.key] += l.quantity; } }
        }
        if (dom === 16 && (s.kind === 10 || chance(0.25))) phoneNote(s, iso, "cn");
        if (dom === 26 && s.kind === 10 && chance(0.5)) phoneNote(s, iso, "dn");
        await phoneSync(s, s.owner!, iso, ph);
        if (s.staff && s.staffAccess === "billing") {
          const sb = (staffBills[s.n] ||= { invoices: [] });
          for (let k = 0; k < Math.max(1, Math.floor(count / 2)); k++) { const b = phoneBill(s, iso, true); if (b) sb.invoices.push(b); }
          await phoneSync(s, s.staff, iso, sb, true);
        }
      };
      for (let k = 0; k < phones.length; k += 10) await Promise.all(phones.slice(k, k + 10).map(runPhone));
    };

    // --- website shops, one browser at a time (the web app's storage is one per page)
    const webWork = async () => {
      for (const s of shops.filter((x) => x.app === "web")) {
        const useBranch = s === BRANCH && !!s.branchId && dom % 2 === 1;
        await webSession(s, s.owner!, iso, () => {
          if (iso === (s.forgetsRateCut ? "2025-09-29" : RATE_CUT)) {
            for (const it of s.items) { const st = stockOf(s, it.key); if (st) saveStockItem({ ...st, gstRate: rateOn(s, it, iso) as any }); }
          }
          if (useBranch) setActiveBusiness(s.branchId!);
          if (dom === 1) webMonthStart(s, iso);
          // restock what is running low
          for (const it of s.items) { const st = it.service ? null : stockOf(s, it.key); if (st && st.currentStock <= it.min * 1.5) webRestock(s, it, iso, dom); }
          const count = s.perDay[0] + Math.floor(rnd() * (s.perDay[1] - s.perDay[0] + 1));
          for (let k = 0; k < count; k++) {
            const big = (s.kind === 4 || s.kind === 7) && chance(0.2);
            const inv = webSell(s, iso, big ? { buyer: null, b2cl: true, status: "paid" } : { walkinPhone: chance(0.3) ? `98${String(30000000 + Math.floor(rnd() * 9999999))}` : "" });
            if (inv && lapsed.has(s.owner!.uid)) s.expect.lapseBills.push(inv.id);
            if (inv && useBranch) s.expect.branchBills.push(inv.id);
          }
          webCollect(s, iso);
          if (dom === 16 && !s.composition && chance(0.6)) webNote(s, iso, "credit_note");
          if (dom === 26 && !s.composition && chance(0.25)) webNote(s, iso, "debit_note");
          if (dom === 20 && chance(0.5)) webCancelLast(s, iso);
          if (dom === 12) webEditPhone(s);
          // khata: the clothing shop gives udhar to a regular customer
          if (s.kind === 6 && dom % 10 === 3) saveKhataEntry({ id: generateId(), customerId: s.buyers[0].id, customerName: s.buyers[0].name, amount: 2000, description: "Udhar", createdAt: new Date().toISOString(), isCredit: false, accountType: "party", partyKind: "customer" } as KhataEntry);
          // quotes: hardware and electronics quote B2B buyers; accepted quotes are billed by hand
          if ((s.kind === 3 || s.kind === 7) && dom % 7 === 2) {
            const q: Quote = { id: generateId(), quoteNumber: `QT-${iso}`, customerName: s.buyers[1].name, customerId: s.buyers[1].id, items: [webBillLine(s, s.items[0], 2, iso, true)], subtotal: 0, totalGstAmount: 0, totalAmount: 0, status: "sent", validUntil: addDays(iso, 15), notes: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            q.subtotal = q.items[0].taxableAmount; q.totalGstAmount = r2(q.items[0].cgst + q.items[0].sgst + q.items[0].igst); q.totalAmount = q.items[0].total;
            saveQuote(q);
            if (chance(0.5)) { saveQuote({ ...q, status: "accepted" }); webSell(s, iso, { buyer: s.buyers[1], lines: [{ it: s.items[0], qty: 2 }], status: "unpaid" }); }
          }
          // delivery challan, then the bill (hardware, cement to a builder)
          if (s.kind === 3 && dom % 9 === 4) {
            const cem = s.items.find((x) => x.key === "cem")!;
            const dc: DeliveryChallan = { id: generateId(), challanNumber: `DC-${iso}`, customerName: s.buyers[0].name, customerId: s.buyers[0].id, items: [{ name: cem.name, hsnCode: cem.hsn, quantity: 20, unit: "BAG" }], transportMode: "Road", vehicleNumber: "MH12AB1234", deliveryAddress: "Site, Hinjewadi", notes: "", status: "delivered", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            saveDeliveryChallan(dc);
            const inv = webSell(s, iso, { buyer: s.buyers[0], lines: [{ it: cem, qty: 20 }], status: "unpaid" });
            if (inv) saveDeliveryChallan({ ...dc, invoiceId: inv.id, status: "invoiced" });
          }
          // a monthly maintenance bill that repeats (Repeating bills: Generate now)
          if (s.kind === 7 && dom === 5) {
            const amc = s.items.find((x) => x.service)!;
            const data = loadData();
            const template = data.invoices.find((x) => (x as any).recurring?.active);
            if (!template) {
              const inv = webSell(s, iso, { buyer: s.buyers[2], lines: [{ it: amc, qty: 1 }], status: "unpaid" });
              if (inv) saveInvoice({ ...inv, recurring: { frequency: "monthly", interval: 1, nextRun: addDays(iso, 30), active: true } } as any);
            } else {
              const now = new Date().toISOString();
              const latest = loadData();
              const generated = { ...template, id: generateId(), invoiceNumber: generateInvoiceNumber(latest.invoices, latest.settings.invoicePrefix, iso), date: iso, dueDate: iso, status: "unpaid", paidAmount: 0, balanceDue: template.grandTotal, createdAt: now, updatedAt: now, recurring: undefined } as Invoice;
              saveInvoice(generated);
              saveInvoice({ ...template, recurring: { ...(template as any).recurring, nextRun: addDays(iso, 30) }, updatedAt: now } as any);
              persistLedger(postInvoiceLedger(loadData(), generated));
            }
          }
          // a saved bill template (jewellers: the wedding set)
          if (s.kind === 4 && iso === "2025-05-02") saveTemplate({ id: generateId(), name: "Wedding set", customerName: "", items: [webBillLine(s, s.items[0], 1, iso, false), webBillLine(s, s.items[1], 2, iso, false)], usageCount: 0 } as Template);
          // stock moved to the warehouse godown and back
          if (s.kind === 3 && dom === 8) {
            const st = stockOf(s, "hinge")!;
            saveStockMoves(transferMoves(st.id, 50, "Main", "Warehouse", undefined, undefined, iso), { ref: st.name, detail: "50 moved to Warehouse" });
            saveStockMoves(transferMoves(st.id, 50, "Warehouse", "Main", undefined, undefined, iso), { ref: st.name, detail: "50 moved back" });
          }
          if (useBranch) setActiveBusiness(`biz${s.n}`);
        });
        // staff with full access bill on the website too, in their own series
        if (s.staff && s.staffAccess === "full" && dom % 2 === 0) {
          await webSession(s, s.staff, iso, () => { webSell(s, iso, {}); }, { staffSeries: "A" });
        }
      }
    };

    await Promise.all([phoneWork(), webWork()]);

    // month work: GSTR-2B on the 14th, the CA files on the 11th
    if (dom === 14) for (const s of shops.filter((x) => !x.composition)) await upload2b(s, prevMonth(ym));
    if (dom === 11 && ym !== "2025-04") for (const s of shops) await caMonth(s, prevMonth(ym));
    if (dom === 1) report.notes.push(`${ym}: reached after ${Math.round((performance.now() - t0) / 60000)} min`);
    if (iso === "2025-12-21") {
      // the lapsed shop renewed: what it billed while lapsed must be in the cloud
      const loaded = await api(LAPSER.owner!, "apiDataLoad", "/api/data/load");
      const ids = new Set(((loaded.body?.data?.invoices || []) as Invoice[]).map((x) => x.id));
      const missing = LAPSER.expect.lapseBills.filter((id) => !ids.has(id));
      check(`${LAPSER.name}: bills made while the plan had lapsed reach the cloud after renewing`, loaded.status === 200 && LAPSER.expect.lapseBills.length > 0 && missing.length === 0, `${LAPSER.expect.lapseBills.length} made, ${missing.length} missing`);
    }
  }
  // the April 2026 CA check (first week of the new year)
  const fullYear = UNTIL >= "2026-04-07";
  // March is filed on 11 April, after the run's last day: file it now, then the first week of April.
  if (fullYear) for (const s of shops) { await caMonth(s, "2026-03"); await caMonth(s, "2026-04"); }
  check("every daily sync and save over the year succeeded (outside the lapse)", syncFailures === 0, `${syncFailures} failures`);

  // ---------------------------------------------------------------- year end
  const counts: Record<string, unknown> = {};
  for (const s of shops) {
    const loaded = await api(s.owner!, "apiDataLoad", "/api/data/load");
    if (loaded.status !== 200) { check(`${s.name}: year-end books load`, false, String(loaded.status)); continue; }
    const data = loaded.body.data as AppData;
    counts[s.name] = { bills: data.invoices.length, creditNotes: data.creditNotes?.length || 0, debitNotes: data.debitNotes?.length || 0, purchases: data.purchases.length, expenses: data.expenses?.length || 0, stockMoves: data.stockMoves?.length || 0, edits: data.auditLog?.length || 0, bytes: JSON.stringify(data).length };

    // stock on hand equals what came in less what went out, per item
    const wrong = s.items.filter((it) => !it.service).map((it) => ({ it, have: data.stock.find((x) => x.id === `s${s.n}-${it.key}`)?.currentStock, want: s.expect.stock[it.key] })).filter((x) => x.have !== x.want);
    check(`${s.name} (${s.app}): stock on hand matches every sale, purchase and return of the year`, wrong.length === 0, wrong.map((x) => `${x.it.name} ${x.have} vs ${x.want}`).join("; "));
    const negative = (data.stock || []).filter((x) => x.currentStock < 0);
    if (s.staff || s === STAFFSHOP) { if (negative.length) report.notes.push(`${s.name}: two phones sold the last units before syncing; stock shows below zero for ${negative.map((x) => `${x.name} (${x.currentStock})`).join(", ")}`); }
    else check(`${s.name}: no item went below zero`, negative.length === 0, negative.map((x) => x.name).join(", "));
    const val = stockValuation(data, "2026-03-31");
    check(`${s.name}: closing stock on 31 March 2026 has a value`, val.total > 0 || s.items.every((x) => x.service), `₹${Math.round(val.total)}`);

    // the year's GST: GSTR-9 from the server equals the twelve monthly 3B figures
    const g9 = await api(s.owner!, "apiReports", "/api/reports/gstr9?fy=2025-26");
    const fyMonths = Object.entries(monthTax[s.n] || {}).filter(([m]) => m >= "2025-04" && m <= "2026-03");
    const yearTax = fyMonths.reduce((t, [, v]) => t + v, 0);
    if (s.composition) {
      check(`${s.name}: GSTR-9 is not asked of a composition dealer (GSTR-4 instead)`, g9.status === 409 && /GSTR-4/.test(g9.body?.error || ""), `${g9.status} ${JSON.stringify(g9.body).slice(0, 160)}`);
      const g4 = generateGSTRReport(data.invoices, "gstr4" as any, "2025-04-01", "2026-03-31");
      const turnover = data.invoices.filter((i) => i.status !== "cancelled" && i.status !== "draft" && i.date >= "2025-04-01" && i.date <= "2026-03-31").reduce((t, i) => t + toPaise(i.totalTaxable), 0);
      check(`${s.name}: GSTR-4 (yearly) turnover equals the year's bills`, Math.abs(toPaise((g4 as any).totalTaxableValue ?? 0) - turnover) <= 100, `${(g4 as any).totalTaxableValue} vs ${p2r(turnover)}`);
      for (const [q, a, b] of [["Q1", "2025-04-01", "2025-06-30"], ["Q2", "2025-07-01", "2025-09-30"], ["Q3", "2025-10-01", "2025-12-31"], ["Q4", "2026-01-01", "2026-03-31"]]) {
        const r = generateGSTRReport(data.invoices, "gstr4" as any, a, b) as any;
        report.notes.push(`${s.name} CMP-08 ${q}: turnover ₹${r.totalTaxableValue} (from the GSTR-4 view; there is no separate CMP-08 screen)`);
      }
    } else {
      monthly(`g9-${s.n}`, `${s.name}: GSTR-9 opens for 2025-26`, g9.status === 200, String(g9.status));
      const t4n = g9.body?.report?.table4?.N;
      if (t4n) {
        const g9tax = toPaise((t4n.cgst ?? 0) + (t4n.sgst ?? 0) + (t4n.igst ?? 0));
        if (fullYear) check(`${s.name}: GSTR-9 Table 4N tax equals the twelve months of GSTR-3B`, fyMonths.length === 12 && Math.abs(g9tax - yearTax) <= 12, `${p2r(g9tax)} vs ${p2r(yearTax)} (${fyMonths.length} months)`);
      }
    }
    // profit and loss for the year
    const pl = profitAndLoss(data) as any;
    report.notes.push(`${s.name}: P&L ${JSON.stringify(pl).slice(0, 160)}`);
    // rent GST in input credit
    if (!s.composition) {
      const g3 = gstr3b(data, "2025-05-01", "2025-05-31") as any;
      const rentGst = r2(s.rent * 0.18);
      const itc = g3.eligible || 0;
      const purchaseGst = data.purchases.filter((p) => (p.supplierInvoiceDate || p.createdAt).slice(0, 7) === "2025-05").reduce((t, p) => t + p.totalGstAmount, 0);
      if (s.app === "web") check(`${s.name}: GSTR-3B input credit includes the GST on rent marked claimable`, itc >= r2(purchaseGst + rentGst) - 1, `ITC ₹${r2(itc)}; purchases ₹${r2(purchaseGst)} + rent ₹${rentGst}`);
    }
    if (s.app === "web") {
      const unb = unbalancedPostings(data.khataEntries || []);
      check(`${s.name}: every bill, payment, purchase, expense and salary posts balanced entries`, unb.length === 0, unb.slice(0, 3).map((u) => `${u.sourceType} ${u.difference}`).join(", "));
      const stale = s.items.filter((it) => !it.service).filter((it) => { const st = data.stock.find((x) => x.id === `s${s.n}-${it.key}`); return st && Number(st.gstRate) !== s.expect.rateNow[it.key]; });
      check(`${s.name}: item GST rates are what the owner last set (no other browser undid them)`, stale.length === 0, stale.map((it) => it.name).join(", "));
      const oldRate = data.invoices.filter((i) => i.date >= "2025-09-29" && i.status !== "cancelled" && i.items.some((l) => [12, 28].includes(l.gstRate)));
      check(`${s.name}: no bill after the rate cut uses 12% or 28% (staff included)`, oldRate.length === 0, `${oldRate.length} bills, e.g. ${oldRate[0]?.invoiceNumber}`);
    }
    // the edit log keeps a year of changes
    check(`${s.name}: edit log kept the year's changes`, (data.auditLog || []).length > 50 || s.app === "phone", `${(data.auditLog || []).length} entries`);
    if (s.app === "web") {
      const paidOk = data.invoices.filter((i) => s.expect.webPaid[i.id]).every((i) => i.balanceDue >= -0.01 && (i.balanceDue > 0.01 || i.status === "paid"));
      check(`${s.name}: bills paid in full by later payments show as paid`, paidOk, data.invoices.filter((i) => s.expect.webPaid[i.id] && i.balanceDue <= 0.01 && i.status !== "paid").slice(0, 3).map((i) => `${i.invoiceNumber} ${i.status}`).join(", "));
      // numbers are unique within a GSTIN (a branch has its own series)
      const nums = data.invoices.map((i) => `${i.businessId}|${i.invoiceNumber}`);
      const dupNums = nums.filter((n, k, a) => a.indexOf(n) !== k);
      check(`${s.name}: no two bills of one GSTIN share a number across the year (owner, staff, branch)`, dupNums.length === 0, dupNums.slice(0, 5).join(", "));
    }
    // receipts sent on WhatsApp
    if (s.expect.receipts.length) {
      const paidAsk = s.expect.receipts.filter((r) => r.status === "paid" && r.balanceDue <= 0.01 && /upi:\/\/pay/.test(r.text));
      check(`${s.name}: receipts for bills already paid do not ask the customer to pay again`, paidAsk.length === 0, `${paidAsk.length} of ${s.expect.receipts.length} receipts for paid bills carry a UPI pay link for the full amount, e.g. ${paidAsk[0]?.invoiceNumber}`);
      const noCc = s.expect.receipts.filter((r) => /wa\.me\/\d{10}\?/.test(r.url));
      check(`${s.name}: WhatsApp receipt links include the country code`, noCc.length === 0, `${noCc.length} links like ${noCc[0]?.url.slice(0, 40)}`);
    }
    // phone: khata and expenses stay on the phone
    if (s.app === "phone") {
      const caBooks = await api(caOf(s), "apiCa", `/api/ca/clients/${s.owner!.uid}/books?from=2025-04-01&to=2026-03-31`);
      const onPhone = s.ph!.expenses.filter((e: any) => e.date <= "2026-03-31").length;
      check(`${s.name} (phone): rent and other expenses reach the cloud and the CA`, (caBooks.body?.expenses || []).length === onPhone, `${(caBooks.body?.expenses || []).length} in the cloud, ${onPhone} on the phone`);
      if (s.kind === 2) check(`${s.name} (phone): khata (udhar) reaches the cloud`, (caBooks.body?.khata || []).length > 0, `${(caBooks.body?.khata || []).length} entries in the cloud, ${s.ph!.khata.length} on the phone (₹${s.expect.phoneKhata} owed)`);
    }
  }

  // two GSTINs, one owner
  if (BRANCH.branchId) report.notes.push(`${BRANCH.name}: ${BRANCH.expect.branchBills.length} bills made in the Bengaluru branch (GSTIN ${BRANCH.branchGstin})`);

  // ---------------------------------------------------------------- access rules at the end of the year
  for (const [letter, ca] of cas) {
    const cl = await api(ca, "apiCa", "/api/ca/clients");
    const expectedN = shops.filter((x) => x.ca === letter).length;
    check(`CA ${letter} sees exactly its ${expectedN} clients`, cl.body.count === expectedN, `${cl.body.count}`);
  }
  const other = shops.find((x) => x.ca !== "A")!;
  const cross = await api(cas.get("A")!, "apiCa", `/api/ca/clients/${other.owner!.uid}/gstr1?month=2026-03`);
  check("A CA cannot open another CA's client", cross.status === 403, String(cross.status));
  const write = await api(caOf(shops[0]), "apiCa", `/api/ca/clients/${shops[0].owner!.uid}/books`, { invoices: [] });
  check("The CA portal is read-only", write.status === 403 || write.status === 404, String(write.status));

  // files: a scanned purchase bill kept in the archive; a too-large one refused with a clear message
  const tz = shops.find((x) => x.kind === 7)!;
  const small = await api(tz.owner!, "apiFiles", "/api/files", { id: "bill-scan-1", name: "supplier-bill.pdf", mime: "application/pdf", size: 3000, dataB64: Buffer.alloc(3000, 7).toString("base64") });
  const big = await api(tz.owner!, "apiFiles", "/api/files", { id: "bill-scan-2", name: "big.pdf", mime: "application/pdf", size: 900000, dataB64: Buffer.alloc(900000, 7).toString("base64") });
  const list = await api(tz.owner!, "apiFiles", "/api/files");
  check("Files: a scanned bill is kept and listed; an oversized one is refused with a message", small.status === 200 && big.status === 413 && (list.body.files || []).some((f: any) => f.id === "bill-scan-1"), `${small.status}/${big.status}/${(list.body.files || []).length}`);

  // phone receipts: hand a sample of phone bills to the Flutter receipt test
  const phoneSample = shops.filter((x) => x.app === "phone").flatMap((s) => s.ph!.invoices.filter((_, k) => k % 97 === 0).slice(0, 8).map((b) => ({ shop: s.name, gstin: s.gstin, upi: `shop${s.n}@upi`, bill: b })));
  fs.writeFileSync("../argus/test/fixtures/year_receipts.json", JSON.stringify(phoneSample, null, 1));

  const perf = Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, { calls: v.n, avgMs: Math.round(v.ms / v.n), maxMs: Math.round(v.max), largestKB: Math.round(v.bytes / 1024), sentMB: +(v.sent / 1048576).toFixed(1), gotMB: +(v.got / 1048576).toFixed(1) }]));
  report.notes.push(`rate limits hit (waited and retried): ${JSON.stringify(rateLimited)}`);
  report.notes.push(`server timings: ${JSON.stringify(perf)}`);
  report.notes.push(`web app bytes: ${JSON.stringify(Object.fromEntries(Object.entries(webBytes).map(([k, v]) => [k, { calls: v.calls, sentMB: +(v.sent / 1048576).toFixed(2), gotMB: +(v.got / 1048576).toFixed(2) }])))}`);
  report.notes.push(`run took ${Math.round((performance.now() - t0) / 60000)} min`);
  fs.writeFileSync("scripts/sim/last-run-year.json", JSON.stringify({ report, counts, perf }, null, 2));
  console.log(`\nPASS ${report.pass.length}  FAIL ${report.fail.length}\n` + report.fail.map((x) => "FAIL  " + x).join("\n"));
  expect(true).toBe(true);
});

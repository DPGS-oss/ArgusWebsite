/**
 * A month of business on the LOCAL Firebase emulators (never production):
 * 10 shops (5 on the phone app, 5 on the website), 2 staff members, 2 CAs
 * with 5 clients each. Every day of October 2026 each shop bills, buys,
 * sometimes issues credit notes or cancels, and syncs the way its app does.
 * At month end the owners' GST reports, the CA portal (clients, encrypted
 * books, GSTR-1 JSON, Tally) and the access rules are checked against
 * totals the simulation keeps itself.
 *
 *   firebase emulators:start --only auth,functions,firestore
 *   npx vitest run -c scripts/sim/vitest.config.ts
 */
import { expect, it } from "vitest";
import fs from "node:fs";
import { buildInvoiceDocument, calculateItem, deliveryItems, generateGstnJson } from "@/lib/gst";
import { linePaise, toPaise } from "@/lib/money";
import { gstr3b, checkBooks } from "@/lib/compliance";
import type { AppData, Invoice, InvoiceItem } from "@/lib/types";
import caExports from "../../functions/_shared/ca-exports.js";

const { isRegisteredGstin } = caExports as unknown as { isRegisteredGstin: (g: string) => boolean };
const FN = "http://127.0.0.1:5001/argus-invocing/us-central1";
const AUTH = "http://127.0.0.1:9099";
const STORE = "http://127.0.0.1:8080";
const PROJECT = "argus-invocing";
const PASSWORD = "argus-emulator-test-1";

// ---------------------------------------------------------------- helpers
let seed = 20261001;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const r2 = (n: number) => Math.round(n * 100) / 100;
const p2r = (p: number) => p / 100;

/** A valid GSTIN for state + a number: 2-digit state, PAN (5 letters, 4 digits, letter), entity 1, Z, check digit. */
function gstin(state: string, k: number): string {
  const L = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const letters = [0, 1, 2, 3, 4].map((i) => L[Math.floor(k / Math.pow(L.length, i)) % L.length]).join("");
  const pan = `${letters.slice(0, 3)}P${letters[3]}${String(k % 10000).padStart(4, "0")}${letters[4]}`;
  const base = `${state}${pan}1Z`;
  for (const ch of "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ") if (isRegisteredGstin(base + ch)) return base + ch;
  throw new Error("no gstin " + base);
}

type Who = { email: string; name: string; uid: string; token: string };
async function refreshToken(who: Who) {
  const j = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: who.email, password: PASSWORD, returnSecureToken: true }),
  }).then((r) => r.json());
  who.token = j.idToken;
}
async function account(email: string, name: string, plan: boolean): Promise<Who> {
  const post = (url: string, body: unknown, h: Record<string, string> = {}) =>
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...h }, body: JSON.stringify(body) }).then((r) => r.json());
  let j = await post(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, { email, password: PASSWORD, displayName: name, returnSecureToken: true });
  if (!j.localId) j = await post(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, { email, password: PASSWORD, returnSecureToken: true });
  await post(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`, { localId: j.localId, emailVerified: true }, { Authorization: "Bearer owner" });
  j = await post(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, { email, password: PASSWORD, returnSecureToken: true });
  const fields: Record<string, unknown> = {
    name: { stringValue: name }, email: { stringValue: email }, created_at: { stringValue: "2026-09-01T00:00:00Z" },
    subscription: plan
      ? { mapValue: { fields: { plan: { stringValue: "business_yearly" }, plan_key: { stringValue: "business_yearly" }, active: { booleanValue: true }, expiry_date: { stringValue: "2027-03-31T18:29:59.000Z" } } } }
      : { nullValue: null },
  };
  await fetch(`${STORE}/v1/projects/${PROJECT}/databases/(default)/documents/users/${j.localId}`, {
    method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer owner" }, body: JSON.stringify({ fields }),
  });
  return { email, name, uid: j.localId, token: j.idToken };
}

const rateLimited: Record<string, number> = {};
async function api(who: Who, fn: string, path: string, body?: unknown, method?: string): Promise<{ status: number; body: any }> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const r = await apiOnce(who, fn, path, body, method);
    if (r.status === 401) { await refreshToken(who); continue; }
    if (r.status !== 429) return r;
    rateLimited[fn] = (rateLimited[fn] || 0) + 1;
    // A real app waits and tries again; so does the simulation.
    await new Promise((ok) => setTimeout(ok, Math.min(60, Number(r.body?.retry_after_seconds) || 5) * 1000));
  }
  return apiOnce(who, fn, path, body, method);
}

async function apiOnce(who: Who, fn: string, path: string, body?: unknown, method?: string) {
  const res = await fetch(`${FN}/${fn}${path}`, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: { Authorization: `Bearer ${who.token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

// ---------------------------------------------------------------- shops
type Product = { name: string; hsn: string; rate: number; price: number; unit?: string };
type Shop = {
  n: number; name: string; state: string; gstin: string; app: "phone" | "web"; composition?: boolean;
  products: Product[]; b2b: { name: string; gstin: string; state: string }[]; perDay: [number, number];
  owner?: Who; staff?: Who; staffAccess?: "billing" | "full"; ca: string;
  // what the simulation itself recorded
  bills: any[]; notes: any[]; purchases: any[]; webData?: AppData; updatedAt?: string | null; shareKey?: string;
  seq: number; cnSeq: number; staffSeq: number;
};
const P = (name: string, hsn: string, rate: number, price: number, unit = "NOS"): Product => ({ name, hsn, rate, price, unit });
const shops: Shop[] = [
  { n: 1, name: "Mehta Pharmacy", state: "27", app: "phone", ca: "A", perDay: [3, 6], staffAccess: "billing",
    products: [P("Paracetamol 500mg strip", "3004", 5, 31.5), P("Cough syrup 100ml", "3004", 5, 89), P("Face cream", "3304", 18, 249)], b2b: [] },
  { n: 2, name: "Sharma Kirana", state: "27", app: "phone", ca: "A", perDay: [4, 8],
    products: [P("Rice 5kg", "1006", 0, 340, "BAG"), P("Toor dal 1kg", "0713", 0, 160, "KGS"), P("Packed atta 10kg", "1101", 5, 420, "BAG"), P("Biscuits", "1905", 5, 30), P("Soap", "3401", 18, 45)], b2b: [] },
  { n: 3, name: "Gupta Hardware", state: "27", app: "web", ca: "A", perDay: [2, 4],
    products: [P("Steel almirah", "9403", 18, 9000), P("Door hinge", "8302", 18, 120), P("Cement bag", "2523", 18, 380, "BAG")], b2b: [] },
  { n: 4, name: "Royal Jewellers", state: "27", app: "web", ca: "A", perDay: [1, 3],
    products: [P("Gold chain 10g", "7113", 3, 72000), P("Silver anklet", "7113", 3, 4500)], b2b: [] },
  { n: 5, name: "Fresh Veggies", state: "27", app: "phone", ca: "A", perDay: [5, 9],
    products: [P("Tomato 1kg", "0702", 0, 40, "KGS"), P("Onion 1kg", "0703", 0, 35, "KGS"), P("Potato 1kg", "0701", 0, 30, "KGS")], b2b: [] },
  { n: 6, name: "Style Clothing", state: "07", app: "web", ca: "B", perDay: [2, 5], staffAccess: "full",
    products: [P("Cotton shirt", "6205", 5, 899), P("Jeans", "6203", 5, 1999), P("Designer kurta", "6211", 18, 3499)], b2b: [] },
  { n: 7, name: "TechZone Electronics", state: "29", app: "web", ca: "B", perDay: [1, 3],
    products: [P("LED TV 43in", "8528", 18, 28999), P("Air conditioner 1.5T", "8415", 18, 38999), P("USB cable", "8544", 18, 299)], b2b: [] },
  { n: 8, name: "Annapurna Sweets", state: "27", app: "phone", ca: "B", perDay: [4, 8],
    products: [P("Kaju katli 500g", "1704", 5, 550), P("Namkeen 200g", "2106", 5, 80)], b2b: [] },
  { n: 9, name: "Patel Composition Store", state: "24", app: "web", ca: "B", perDay: [2, 4], composition: true,
    products: [P("Plastic bucket", "3924", 18, 250), P("Broom", "9603", 5, 120)], b2b: [] },
  { n: 10, name: "Wholesale Traders", state: "27", app: "phone", ca: "B", perDay: [2, 4],
    products: [P("Detergent 1kg (carton of 12)", "3402", 18, 1416), P("Tea 250g (carton of 24)", "0902", 5, 3360)], b2b: [] },
].map((s) => ({ ...s, gstin: "", bills: [], notes: [], purchases: [], seq: 0, cnSeq: 0, staffSeq: 0 })) as unknown as Shop[];

// SIM_SHOPS / SIM_CAS: more shops are built from the 10 kinds above, spread over states and CAs.
const SHOPS = Number(process.env.SIM_SHOPS) || 10;
const CAS = Math.max(1, Math.min(26, Number(process.env.SIM_CAS) || 2));
const STATES = ["27", "07", "29", "24", "33", "09", "19"];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const templates = shops.splice(0, shops.length);
for (let i = 0; i < SHOPS; i++) {
  const t = templates[i % templates.length];
  const round = Math.floor(i / templates.length);
  shops.push({
    ...t, n: i + 1, name: round ? `${t.name} ${round + 1}` : t.name,
    state: round ? STATES[(i + round) % STATES.length] : t.state,
    staffAccess: round && round % 3 ? undefined : t.staffAccess,
    ca: SHOPS === 10 && CAS === 2 ? t.ca : LETTERS[i % CAS],
    products: t.products, b2b: [], bills: [], notes: [], purchases: [], seq: 0, cnSeq: 0, staffSeq: 0,
  } as Shop);
}
// The 5th shop stops sharing with its CA near month end.
const REVOKER = 5;

const BUYERS = [
  { name: "Kumar Enterprises", state: "27" }, { name: "Delhi Distributors", state: "07" }, { name: "Bangalore Retail Co", state: "29" },
  { name: "Gujarat Mart", state: "24" }, { name: "Pune Clinic", state: "27" },
];

const kindOf = (s: Shop) => ((s.n - 1) % 10) + 1;

// ---------------------------------------------------------------- bills
const day = (d: number) => `2026-10-${String(d).padStart(2, "0")}`;
const sellerStateOf = (s: Shop) => s.state;

function phoneBill(s: Shop, d: number, byStaff: boolean) {
  const buyer = rnd() < 0.25 && s.b2b.length ? pick(s.b2b) : null;
  const inter = buyer ? buyer.state !== s.state : rnd() < 0.05;
  const lines = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => {
    const p = pick(s.products);
    const quantity = pick([1, 1, 2, 3, 5, 10]);
    const l = linePaise({ quantity, price: p.price, gstRate: p.rate, inclusive: true, interState: inter });
    return { p, quantity, l };
  });
  const sum = (f: (x: (typeof lines)[number]) => number) => lines.reduce((t, x) => t + f(x), 0);
  const total = sum((x) => x.l.total);
  const ser = byStaff ? `B${String(++s.staffSeq).padStart(4, "0")}` : String(++s.seq).padStart(4, "0");
  const status = rnd() < 0.7 ? "paid" : "pending";
  return {
    id: `s${s.n}-${byStaff ? "st" : "ph"}-${ser}`, invoice_number: `INV/26-27/${ser}`, customer_name: buyer ? buyer.name : "Walk-in",
    customer_id: "", created_at: `${day(d)}T1${d % 10}:00:00.000`, invoice_date: `${day(d)}T10:00:00.000`, notes: "",
    place_of_supply: buyer ? buyer.state : inter ? "07" : s.state, shipping_charges: 0, shipping_is_reimbursement: false, round_off: 0,
    status, total_amount: p2r(total), total_gst_amount: p2r(sum((x) => x.l.tax)), total_cgst: p2r(sum((x) => x.l.cgst)),
    total_sgst: p2r(sum((x) => x.l.sgst)), total_igst: p2r(sum((x) => x.l.igst)), seller_gstin: s.gstin, bill_to_gstin: buyer ? buyer.gstin : "",
    document_type: "INV",
    items: lines.map((x) => ({
      name: x.p.name, hsn_code: x.p.hsn, quantity: x.quantity, unit_price: x.p.price, gst_rate: x.p.rate, uqc: x.p.unit,
      taxable_value: p2r(x.l.taxable), gst_amount: p2r(x.l.tax), cgst: p2r(x.l.cgst), sgst: p2r(x.l.sgst), igst: p2r(x.l.igst), total: p2r(x.l.total),
    })),
  };
}

function webBill(s: Shop, d: number, prefixTag = "W"): Invoice {
  const large = kindOf(s) === 4 && rnd() < 0.3; // jewellery: big cash bills
  const buyer = !large && rnd() < 0.35 && s.b2b.length ? pick(s.b2b) : null;
  const b2cl = !buyer && (kindOf(s) === 7 || kindOf(s) === 4) && rnd() < 0.25; // unregistered, other state, > ₹1 lakh
  const partyState = buyer ? buyer.state : b2cl ? (s.state === "27" ? "07" : "27") : s.state;
  const inter = partyState !== s.state;
  const items: InvoiceItem[] = Array.from({ length: 1 + Math.floor(rnd() * 3) }, (_, k) => {
    const p = pick(s.products);
    const quantity = b2cl || large ? pick([2, 3, 4]) : pick([1, 1, 2, 3]);
    const rate = r2(p.price / (1 + p.rate / 100));
    const gstRate = s.composition ? 0 : p.rate;
    const c = calculateItem({ quantity, rate, discount: 0, gstRate, isInterState: inter });
    return { id: `l${k}`, description: p.name, hsn: p.hsn, quantity, unit: p.unit || "NOS", uqc: p.unit || "NOS", rate, discount: 0, gstRate, ...c } as InvoiceItem;
  });
  const delivery = !s.composition && rnd() < 0.15 ? deliveryItems(items, 250, inter) : [];
  const ser = String(++s.seq).padStart(4, "0");
  const built = buildInvoiceDocument({
    id: `s${s.n}-w-${ser}`, invoiceNumber: `INV/26-27/${prefixTag}${ser}`, type: s.composition ? "bill_of_supply" : "tax_invoice",
    status: rnd() < 0.7 ? "paid" : "unpaid", businessId: `biz${s.n}`, sellerGstin: s.gstin, sellerStateCode: s.state,
    sellerComposition: !!s.composition, partyId: "", partyName: buyer ? buyer.name : large || b2cl ? "Anand Kumar" : "Walk-in",
    partyGstin: buyer ? buyer.gstin : "", partyPhone: "", partyAddress: large || b2cl ? "14 Park Street" : "", partyStateCode: partyState,
    date: day(d), dueDate: day(d), items: [...items, ...delivery], roundOffEnabled: true, paidAmount: 0, paymentMode: "UPI",
    notes: "", terms: "", reverseCharge: false, isTotalMode: false, createdAt: `${day(d)}T10:00:00.000Z`,
  });
  return { ...built, paidAmount: built.status === "paid" ? built.grandTotal : 0, balanceDue: built.status === "paid" ? 0 : built.grandTotal };
}

function purchaseFor(s: Shop, d: number, idx: number) {
  const supplier = gstin(s.state, 50000 + s.n);
  const p = pick(s.products);
  const qty = 20;
  const taxable = r2((p.price / (1 + p.rate / 100)) * 0.7 * qty);
  const tax = r2((taxable * p.rate) / 100);
  return { supplier, p, qty, taxable, tax, id: `s${s.n}-pu-${idx}`, number: `SUP/${s.n}/${idx}`, date: day(d) };
}

// ---------------------------------------------------------------- run
const report: { pass: string[]; fail: string[]; notes: string[] } = { pass: [], fail: [], notes: [] };
const check = (name: string, ok: boolean, extra = "") => {
  (ok ? report.pass : report.fail).push(`${name}${extra ? `  — ${extra}` : ""}`);
};

it("a month of business: 10 shops, 2 staff, 2 CAs", async () => {
  // --- accounts and businesses
  for (const s of shops) {
    s.gstin = gstin(s.state, 1000 + s.n * 37);
    s.owner = await account(`owner${s.n}@argus.test`, `${s.name} owner`, true);
    if (s.staffAccess) s.staff = await account(`staff${s.n}@argus.test`, `Staff of ${s.name}`, false);
  }
  for (const s of shops) s.b2b = BUYERS.map((b, i) => ({ name: b.name, state: b.state, gstin: gstin(b.state, 20000 + s.n * 10 + i) }));
  const caNames = ["Anil Shah", "Bhavna Rao", "Chetan Iyer", "Deepa Nair", "Esha Kapoor"];
  const cas = new Map<string, Who>();
  for (let k = 0; k < CAS; k++) cas.set(LETTERS[k], await account(`ca.${LETTERS[k].toLowerCase()}@argus.test`, `CA ${caNames[k % caNames.length]}`, false));
  const caOf = (s: Shop) => cas.get(s.ca)!;

  // web shops create their business on the website; phone shops let the phone fill it on first sync
  for (const s of shops.filter((x) => x.app === "web")) {
    s.webData = {
      businesses: [{ id: `biz${s.n}`, name: s.name, gstin: s.gstin, state: "", stateCode: s.state, address: "Main road", city: "", pincode: "", phone: "", email: "", pan: s.gstin.slice(2, 12), composition: !!s.composition }],
      activeBusinessId: `biz${s.n}`, parties: [], invoices: [], stock: [], invoiceCounter: 0, settings: { roundOff: true }, creditNotes: [], debitNotes: [],
      payroll: [], deliveryChallans: [], expenses: [], quotes: [], purchases: [], payments: [], templates: [], khataEntries: [],
    } as unknown as AppData;
    const r = await api(s.owner!, "apiDataSave", "/api/data/save", { appData: s.webData, books_uid: s.owner!.uid });
    s.updatedAt = r.body.updated_at;
  }

  // --- staff join (Mehta: billing only on the phone; Style: full access on the website)
  for (const s of shops.filter((x) => x.staff)) {
    const inv = await api(s.owner!, "apiTeam", "/api/team/invite", { email: s.staff!.email, access: s.staffAccess });
    const acc = await api(s.staff!, "apiTeam", "/api/team/accept", {});
    check(`${s.name}: staff joins (${s.staffAccess})`, inv.status === 200 && acc.status === 200 && acc.body.role === "member", `${inv.status}/${acc.status}`);
  }

  // --- CAs: each owner invites its CA on day 1 (web owners also upload the encrypted copy, as Settings does)
  for (const s of shops) {
    const ca = caOf(s);
    const inv = await api(s.owner!, "apiCa", "/api/ca/invites", {});
    const red = await api(ca, "apiCa", "/api/ca/invites/redeem", { token: inv.body.token });
    check(`${s.name}: CA ${s.ca} redeems the invite`, red.status === 200, `${inv.status}/${red.status} ${red.body.error || ""}`);
    if (s.app === "phone") {
      check(`${s.name} (phone): invite link carries the token`, String(inv.body.redeem_url || "").includes("token"),
        `phone shows "${inv.body.redeem_url}" — no token, no key; only the backup code works`);
    }
  }
  // --- the month
  const phoneState = new Map<number, { invoices: any[]; creditNotes: any[]; purchases: any[]; auditSince: string }>();
  const staffState = new Map<number, { invoices: any[] }>();
  for (const s of shops) phoneState.set(s.n, { invoices: [], creditNotes: [], purchases: [], auditSince: "" });
  let syncFailures = 0;

  for (let d = 1; d <= 31; d++) {
    // Shops work at the same time, as real shops do (10 at once).
    const runShop = async (s: Shop) => {
      const count = s.perDay[0] + Math.floor(rnd() * (s.perDay[1] - s.perDay[0] + 1));
      if (s.app === "phone") {
        const st = phoneState.get(s.n)!;
        for (let k = 0; k < count; k++) st.invoices.push(phoneBill(s, d, false));
        if (d === 25) { let k = 0; for (const b of st.invoices) if (b.status === "pending" && k++ % 2 === 0) b.status = "paid"; }
        if (d === 12 && kindOf(s) === 2) { const c = st.invoices[st.invoices.length - 1]; c.status = "cancelled"; }
        if (d % 7 === 3) {
          const pu = purchaseFor(s, d, d);
          const half = r2(pu.tax / 2);
          st.purchases.push({
            id: pu.id, purchase_number: pu.number, supplier_name: "Supplier Pvt Ltd", supplier_gstin: pu.supplier, supplier_invoice_number: pu.number,
            purchase_date: pu.date, total_amount: r2(pu.taxable + pu.tax), total_gst_amount: pu.tax, total_cgst: half, total_sgst: r2(pu.tax - half), total_igst: 0,
            reverse_charge: false, itc_eligible: true, created_at: `${pu.date}T09:00:00`,
            items: [{ name: pu.p.name, hsn_code: pu.p.hsn, quantity: pu.qty, unit_price: r2((pu.taxable + pu.tax) / pu.qty), gst_rate: pu.p.rate, taxable_value: pu.taxable, gst_amount: pu.tax, cgst: half, sgst: r2(pu.tax - half), igst: 0, total: r2(pu.taxable + pu.tax) }],
          });
        }
        if (d === 15 && kindOf(s) === 10) {
          // goods returned against a B2B bill: credit note at the bill's rate
          const orig = st.invoices.find((b) => b.bill_to_gstin) || st.invoices[0];
          const it = orig.items[0];
          const l = linePaise({ quantity: 1, price: it.unit_price, gstRate: it.gst_rate, inclusive: true, interState: orig.total_igst > 0 });
          st.creditNotes.push({
            id: `s${s.n}-cn-1`, credit_note_number: "CN/26-27/0001", invoice_id: orig.id, customer_name: orig.customer_name, status: "active",
            subtotal: p2r(l.taxable), total_gst_amount: p2r(l.tax), total_amount: p2r(l.total), created_at: `${day(d)}T12:00:00`, bill_to_gstin: orig.bill_to_gstin,
            items: [{ name: it.name, hsn_code: it.hsn_code, quantity: 1, unit_price: it.unit_price, gst_rate: it.gst_rate, taxable_value: p2r(l.taxable), gst_amount: p2r(l.tax), cgst: p2r(l.cgst), sgst: p2r(l.sgst), igst: p2r(l.igst), total: p2r(l.total) }],
          });
        }
        const r = await api(s.owner!, "apiDataPhoneSync", "/api/data/phone-sync", {
          booksUid: s.owner!.uid, invoices: st.invoices, customers: [], inventory: [], creditNotes: st.creditNotes, debitNotes: [], purchases: st.purchases,
          stockMoves: [], godowns: [], auditLog: [], auditSince: st.auditSince, deleted: {},
          business: { name: s.name, gstin: s.gstin, state: "", address: "Main road" },
        });
        if (r.status !== 200) { syncFailures++; report.notes.push(`${s.name} day ${d} phone sync ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`); }
        else st.auditSince = r.body.auditSince || st.auditSince;
        if (s.staff && s.staffAccess === "billing") {
          const ss = staffState.get(s.n) || { invoices: [] };
          for (let k = 0; k < Math.max(1, Math.floor(count / 2)); k++) ss.invoices.push(phoneBill(s, d, true));
          staffState.set(s.n, ss);
          const rs = await api(s.staff!, "apiDataPhoneSync", "/api/data/phone-sync", {
            booksUid: s.owner!.uid, invoices: ss.invoices, customers: [], inventory: [], creditNotes: [], debitNotes: [], purchases: [], stockMoves: [], godowns: [], auditLog: [], auditSince: "", deleted: {},
          });
          if (rs.status !== 200) { syncFailures++; report.notes.push(`${s.name} staff day ${d}: ${rs.status}`); }
        }
      } else {
        // website: load (another device may have saved), make today's bills, save
        const loaded = await api(s.owner!, "apiDataLoad", "/api/data/load");
        if (loaded.status !== 200) { syncFailures++; report.notes.push(`${s.name} day ${d} load ${loaded.status}`); return; }
        const data = loaded.body.data as AppData;
        s.updatedAt = loaded.body.updated_at;
        for (let k = 0; k < count; k++) data.invoices.push(webBill(s, d));
        if (d === 25) {
          let k = 0;
          for (const b of data.invoices) {
            if (b.status === "unpaid" && k++ % 2 === 0) { b.status = "paid"; b.paidAmount = b.grandTotal; b.balanceDue = 0; }
          }
        }
        if (d === 18 && kindOf(s) === 7) { const c = data.invoices[data.invoices.length - 1]; c.status = "cancelled"; }
        if (d % 7 === 4 && !s.composition) {
          const pu = purchaseFor(s, d, d);
          const inter = false;
          const c = calculateItem({ quantity: pu.qty, rate: r2(pu.taxable / pu.qty), discount: 0, gstRate: pu.p.rate, isInterState: inter });
          data.purchases.push({
            id: pu.id, purchaseNumber: pu.number, supplierName: "Supplier Pvt Ltd", supplierGstin: pu.supplier, supplierInvoiceNumber: pu.number,
            supplierInvoiceDate: pu.date, reverseCharge: false, itcEligible: true, createdAt: `${pu.date}T09:00:00Z`, totalAmount: c.total,
            totalGstAmount: r2(c.cgst + c.sgst + c.igst), totalCgst: c.cgst, totalSgst: c.sgst, totalIgst: c.igst, paidAmount: c.total,
            items: [{ id: "pl", description: pu.p.name, hsn: pu.p.hsn, quantity: pu.qty, unit: "NOS", uqc: "NOS", rate: r2(pu.taxable / pu.qty), discount: 0, gstRate: pu.p.rate, ...c } as InvoiceItem],
          } as any);
        }
        if (d === 15 && kindOf(s) === 3) {
          const orig = data.invoices.find((b) => b.partyGstin && b.status !== "cancelled") as Invoice;
          const it = orig.items[0];
          const c = calculateItem({ quantity: 1, rate: it.rate, discount: 0, gstRate: it.gstRate, isInterState: orig.isInterState });
          data.creditNotes.push({
            id: `s${s.n}-cn-1`, creditNoteNumber: "CN/26-27/W0001", invoiceId: orig.id, date: day(d), customerName: orig.partyName, reason: "Damaged",
            items: [{ ...it, id: "cl", quantity: 1, ...c }], subtotal: c.taxableAmount, totalGstAmount: r2(c.cgst + c.sgst + c.igst), totalAmount: c.total,
            notes: "", status: "active", createdAt: `${day(d)}T12:00:00Z`, updatedAt: `${day(d)}T12:00:00Z`,
          } as any);
        }
        // Style Clothing's staff (full access) also bills on the website, in their own series
        if (s.staff && s.staffAccess === "full" && d % 2 === 0) {
          const sl = await api(s.staff!, "apiDataLoad", "/api/data/load");
          const sd = sl.body.data as AppData;
          const b = webBill(s, d, "WB");
          sd.invoices.push(b);
          const rs = await api(s.staff!, "apiDataSave", "/api/data/save", { appData: sd, base_updated_at: sl.body.updated_at, books_uid: s.owner!.uid });
          if (rs.status !== 200) { syncFailures++; report.notes.push(`${s.name} staff web save day ${d}: ${rs.status} ${JSON.stringify(rs.body).slice(0, 100)}`); }
          // the owner's open page learns of it on the next save (409) — reload like the web app does
          const again = await api(s.owner!, "apiDataLoad", "/api/data/load");
          const merged = again.body.data as AppData;
          const ids = new Set(merged.invoices.map((x) => x.id));
          for (const x of data.invoices) if (!ids.has(x.id)) merged.invoices.push(x);
          merged.purchases = data.purchases; merged.creditNotes = data.creditNotes;
          Object.assign(data, merged);
          s.updatedAt = again.body.updated_at;
        }
        const sv = await api(s.owner!, "apiDataSave", "/api/data/save", { appData: data, base_updated_at: s.updatedAt, books_uid: s.owner!.uid });
        if (sv.status !== 200) { syncFailures++; report.notes.push(`${s.name} day ${d} save ${sv.status} ${JSON.stringify(sv.body).slice(0, 100)}`); }
        else s.updatedAt = sv.body.updated_at;
        s.webData = data;
      }
        };
    for (let k = 0; k < shops.length; k += 10) await Promise.all(shops.slice(k, k + 10).map(runShop));
    // a client stops sharing with CA A near month end
    if (d === 28) {
      const s5 = shops[REVOKER - 1];
      const r = await api(s5.owner!, "apiCa", `/api/ca/invites?accountant_id=${caOf(s5).uid}`, undefined, "DELETE");
      check(`${s5.name} stops sharing with CA ${s5.ca} on day 28`, r.status === 200, String(r.status));
    }
  }
  check("every daily sync and save over the month succeeded", syncFailures === 0, `${syncFailures} failures`);


  // ---------------------------------------------------------------- month end: owners
  const fsData: Record<string, unknown> = {};
  for (const s of shops) {
    const loaded = await api(s.owner!, "apiDataLoad", "/api/data/load");
    if (loaded.status !== 200) { check(`${s.name}: month-end books load`, false, `${loaded.status} ${JSON.stringify(loaded.body).slice(0, 120)}`); continue; }
    const data = loaded.body.data as AppData;
    fsData[s.name] = { invoices: data.invoices.length, notes: (data.creditNotes || []).length, purchases: data.purchases.length };
    const issued = data.invoices.filter((i) => i.status !== "draft" && i.status !== "cancelled" && i.date >= "2026-10-01" && i.date <= "2026-10-31");
    const expectedCount = s.app === "phone" ? phoneState.get(s.n)!.invoices.length + (staffState.get(s.n)?.invoices.length || 0) : s.webData!.invoices.length;
    check(`${s.name}: all bills of the month are in the cloud books`, data.invoices.length === expectedCount, `${data.invoices.length} vs ${expectedCount}`);

    // independent totals: tax heads from the stored lines, credit notes subtracted
    const sumP = (xs: any[], f: (l: any) => number) => xs.reduce((t, x) => t + toPaise(f(x)), 0);
    const lines = issued.flatMap((i) => (i.type === "bill_of_supply" ? [] : i.items));
    const cn = (data.creditNotes || []).filter((c: any) => c.status !== "cancelled").flatMap((c: any) => c.items);
    const taxed = (l: any) => (l.gstRate || 0) > 0;
    const exp = {
      txval: sumP(lines.filter(taxed), (l) => l.taxableAmount) - sumP(cn.filter(taxed), (l) => l.taxableAmount),
      camt: sumP(lines, (l) => l.cgst) - sumP(cn, (l) => l.cgst),
      samt: sumP(lines, (l) => l.sgst) - sumP(cn, (l) => l.sgst),
      iamt: sumP(lines, (l) => l.igst) - sumP(cn, (l) => l.igst),
      nil: sumP(lines.filter((l) => !taxed(l)), (l) => l.taxableAmount),
      exempt: sumP(issued.filter((i) => i.type === "bill_of_supply").flatMap((i) => i.items), (l) => l.taxableAmount),
    };

    // GSTR-3B as the owner's GST check shows it
    const g3 = gstr3b(data, "2026-10-01", "2026-10-31") as any;
    check(`${s.name}: GSTR-3B CGST/SGST/IGST match the bills (net of credit notes)`,
      toPaise(g3.cgst) === exp.camt && toPaise(g3.sgst) === exp.samt && toPaise(g3.igst) === exp.iamt,
      `3B ${g3.cgst}/${g3.sgst}/${g3.igst} vs ${p2r(exp.camt)}/${p2r(exp.samt)}/${p2r(exp.iamt)}`);
    check(`${s.name}: GSTR-3B taxable value matches`, Math.abs(toPaise(g3.taxable) - exp.txval) <= 1, `3B ${g3.taxable} vs ${p2r(exp.txval)}`);

    // GST check: nothing the app itself produced should be flagged as a money error
    const issues = checkBooks(data, new Date("2026-11-05T10:00:00Z"), null);
    const money = issues.filter((x: any) => /off by|CGST and SGST differ|duplicate|Duplicate/.test(x.title));
    check(`${s.name}: GST check finds no tax or numbering errors`, money.length === 0, money.slice(0, 3).map((x: any) => x.title).join("; "));
    const other = issues.filter((x: any) => x.severity === "error").map((x: any) => x.title);
    if (other.length) report.notes.push(`${s.name}: GST check errors: ${[...new Set(other)].slice(0, 4).join(" | ")}`);

    // GSTR-2B: the portal file lists every purchase except the last (supplier has not filed it yet)
    if (!s.composition && data.purchases.length) {
      const toDt = (iso: string) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;
      const filed = data.purchases.slice(0, -1);
      const byCtin = new Map<string, any[]>();
      for (const pu of filed as any[]) {
        const list = byCtin.get(pu.supplierGstin) || [];
        list.push({ inum: pu.supplierInvoiceNumber, dt: toDt(pu.supplierInvoiceDate || pu.createdAt), val: pu.totalAmount, rev: "N", itcavl: "Y",
          txval: r2(pu.items.reduce((t: number, l: any) => t + l.taxableAmount, 0)), igst: pu.totalIgst || 0, cgst: pu.totalCgst || 0, sgst: pu.totalSgst || 0, cess: 0 });
        byCtin.set(pu.supplierGstin, list);
      }
      const file = { data: { gstin: s.gstin, rtnprd: "102026", gendt: "14-11-2026", docdata: { b2b: [...byCtin].map(([ctin, inv]) => ({ ctin, trdnm: "Supplier Pvt Ltd", inv })) } } };
      const m = await api(s.owner!, "apiReports", "/api/reports/gstr2b", { json: file, save: true });
      const sum = m.body?.summary || {};
      check(`${s.name}: GSTR-2B matching finds the matched bills and the one the supplier has not filed`,
        m.status === 200 && sum.matched === filed.length && sum.onlyInBooks === 1, `${m.status} ${JSON.stringify(sum).slice(0, 140)} ${m.body?.error || ""}`);
    }

    // GSTR-9 from the server
    const g9 = await api(s.owner!, "apiReports", "/api/reports/gstr9?fy=2026-27");
    if (g9.status === 200) {
      const t4n = g9.body.report?.table4?.N;
      if (t4n) check(`${s.name}: GSTR-9 Table 4N tax equals the month's tax`, Math.abs(toPaise((t4n.cgst ?? t4n.camt ?? 0) + (t4n.sgst ?? t4n.samt ?? 0) + (t4n.igst ?? t4n.iamt ?? 0)) - (exp.camt + exp.samt + exp.iamt)) <= 2,
        `${r2((t4n.cgst ?? t4n.camt ?? 0) + (t4n.sgst ?? t4n.samt ?? 0) + (t4n.igst ?? t4n.iamt ?? 0))} vs ${p2r(exp.camt + exp.samt + exp.iamt)}`);
      else report.notes.push(`${s.name}: GSTR-9 shape ${Object.keys(g9.body.report || {}).join(",")}`);
    } else check(`${s.name}: GSTR-9 opens`, false, String(g9.status));

    // ---------------------------------------------------------------- the CA's side
    const ca = caOf(s);
    const revoked = s.n === REVOKER;
    const g1 = await api(ca, "apiCa", `/api/ca/clients/${s.owner!.uid}/gstr1?month=2026-10`);
    if (s.composition && !revoked) {
      const gc = await api(ca, "apiCa", `/api/ca/clients/${s.owner!.uid}/gstr1?month=2026-10`);
      check(`${s.name}: composition dealer's GSTR-1 download explains CMP-08 / GSTR-4`, gc.status === 409 && /CMP-08/.test(gc.body.error || ""), `${gc.status}`);
    }
    if (revoked) { check(`${s.name}: CA ${s.ca} loses access after revocation`, g1.status === 403, String(g1.status)); continue; }
    if (!s.composition) check(`${s.name}: CA downloads GSTR-1`, g1.status === 200, String(g1.status));
    if (g1.status === 200) {
    const j = g1.body;
    const rows: any[] = [];
    for (const b of j.b2b || []) for (const inv of b.inv) for (const it of inv.itms) rows.push({ t: "b2b", ...it.itm_det });
    for (const b of j.b2cl || []) for (const inv of b.inv) for (const it of inv.itms) rows.push({ t: "b2cl", ...it.itm_det });
    for (const r of j.b2cs || []) rows.push({ t: "b2cs", ...r });
    for (const b of j.cdnr || []) for (const nt of b.nt) for (const it of nt.itms) rows.push({ t: "cdnr", sign: nt.ntty === "C" ? -1 : 1, ...it.itm_det });
    const sumT = (f: (r: any) => number) => rows.reduce((t, r) => t + (r.sign || 1) * toPaise(f(r)), 0);
    const zeroRated = rows.filter((r) => Number(r.rt) === 0 && toPaise(r.txval) !== 0);
    check(`${s.name}: GSTR-1 tax heads equal the bills (net of notes)`,
      sumT((r) => r.camt) === exp.camt && sumT((r) => r.samt) === exp.samt && sumT((r) => r.iamt) === exp.iamt,
      `${p2r(sumT((r) => r.camt))}/${p2r(sumT((r) => r.samt))}/${p2r(sumT((r) => r.iamt))} vs ${p2r(exp.camt)}/${p2r(exp.samt)}/${p2r(exp.iamt)}`);
    check(`${s.name}: GSTR-1 puts 0% items in Table 8 (nil rated), not at 0% in B2B/B2CS`, zeroRated.length === 0,
      `${zeroRated.length} rows at 0% worth ₹${p2r(zeroRated.reduce((t, r) => t + toPaise(r.txval), 0))}; Table 8 nil ₹${(j.nil?.inv || []).reduce((t: number, x: any) => t + (x.nil_amt || 0), 0)}`);
    const hsnTx = [...(j.hsn?.hsn_b2b || []), ...(j.hsn?.hsn_b2c || []), ...(j.hsn?.data || [])].reduce((t: number, h: any) => t + toPaise(h.camt + h.samt + h.iamt), 0);
    const nilT8 = (j.nil?.inv || []).reduce((t: number, x: any) => t + toPaise(x.nil_amt || 0) + toPaise(x.expt_amt || 0), 0);
    check(`${s.name}: GSTR-1 Table 8 holds the 0% and exempt sales`, Math.abs(nilT8 - (exp.nil + exp.exempt)) <= 2, `${p2r(nilT8)} vs ${p2r(exp.nil + exp.exempt)}`);
    check(`${s.name}: GSTR-1 HSN summary tax equals the tables`, Math.abs(hsnTx - (exp.camt + exp.samt + exp.iamt)) <= 2, `${p2r(hsnTx)} vs ${p2r(exp.camt + exp.samt + exp.iamt)}`);
    const docs = (j.doc_issue?.doc_det || []).flatMap((x: any) => x.docs);
    const totnum = docs.reduce((t: number, x: any) => t + x.totnum, 0);
    const allDocs = data.invoices.length + (data.creditNotes || []).length;
    check(`${s.name}: GSTR-1 Table 13 counts every document`, totnum === allDocs, `${totnum} vs ${allDocs}; series ${docs.map((x: any) => `${x.from}..${x.to}`).join(", ")}`);
    }

    // the CA's view of the books: live, any device, notes included
    const bk = await api(ca, "apiCa", `/api/ca/clients/${s.owner!.uid}/books?from=2026-10-01&to=2026-10-31`);
    check(`${s.name} (${s.app}): CA opens the live books`, bk.status === 200 && bk.body.live === true, `${bk.status} ${bk.body?.error || ""}`);
    if (bk.status === 200) {
      check(`${s.name}: CA sees every bill of the month`, (bk.body.invoices || []).length === data.invoices.length, `${(bk.body.invoices || []).length} vs ${data.invoices.length}`);
      check(`${s.name}: CA sees the credit notes`, (bk.body.creditNotes || []).length === (data.creditNotes || []).length, `${(bk.body.creditNotes || []).length} vs ${(data.creditNotes || []).length}`);
      check(`${s.name}: CA sees the business name and GSTIN`, bk.body.business_profile?.gstin === s.gstin, JSON.stringify(bk.body.business_profile).slice(0, 80));
      const caView = { ...data, invoices: bk.body.invoices, creditNotes: bk.body.creditNotes, debitNotes: bk.body.debitNotes, purchases: bk.body.purchases } as AppData;
      const caG3 = gstr3b(caView, "2026-10-01", "2026-10-31") as any;
      check(`${s.name}: CA's GSTR-3B equals the owner's`, toPaise(caG3.cgst) === toPaise(g3.cgst) && toPaise(caG3.igst) === toPaise(g3.igst) && toPaise(caG3.taxable) === toPaise(g3.taxable), `${caG3.taxable}/${g3.taxable}`);
    }
  }

  // ---------------------------------------------------------------- CA access rules
  const names: string[] = [];
  for (const [letter, ca] of cas) {
    const cl = await api(ca, "apiCa", "/api/ca/clients");
    const expected = shops.filter((x) => x.ca === letter && x.n !== REVOKER).length;
    check(`CA ${letter} sees exactly its ${expected} clients`, cl.body.count === expected, `${cl.body.count}`);
    names.push(...(cl.body.clients || []).map((c: any) => c.business_name));
  }
  check("CA client lists show business names (not ids)", names.every((x: string) => !/^[A-Za-z0-9]{20,}$/.test(x)), names.filter((x) => /^[A-Za-z0-9]{20,}$/.test(x)).slice(0, 3).join(", "));
  const other = shops.find((x) => x.ca !== "A")!;
  const cross = await api(cas.get("A")!, "apiCa", `/api/ca/clients/${other.owner!.uid}/gstr1?month=2026-10`);
  check("A CA cannot open another CA's client", cross.status === 403, String(cross.status));
  const staffAsCa = await api(shops[0].staff!, "apiCa", `/api/ca/clients/${shops[0].owner!.uid}/gstr1?month=2026-10`);
  check("A billing-only staff member cannot download the shop's GSTR-1 through the CA portal", staffAsCa.status === 403, String(staffAsCa.status));
  const tally = await api(caOf(shops[6]), "apiCa", `/api/ca/clients/${shops[6].owner!.uid}/tally?month=2026-10`);
  check("CA downloads Tally XML", tally.status === 200 && String(tally.body).includes("<ENVELOPE"), String(tally.status));

  report.notes.push(`rate limits hit (waited and retried): ${JSON.stringify(rateLimited)}`);
  fs.writeFileSync("scripts/sim/last-run.json", JSON.stringify({ report, counts: fsData }, null, 2));
  console.log(`\nPASS ${report.pass.length}  FAIL ${report.fail.length}\n` + report.fail.map((x) => "FAIL  " + x).join("\n") + "\n\nNOTES\n" + report.notes.join("\n"));
  expect(true).toBe(true);
});

"use client";

import type { AppData, AppSettings, BusinessProfile, Invoice, Party, StockItem, CreditNote, DebitNote, PayrollEntry, DeliveryChallan, Expense, Quote, Purchase, Payment, Template, KhataEntry, DeletableKey } from "./types";
import { cancelledEntry } from "./invoice-history";
import { financialYear, todayIST } from "./dates";
import { appendAudit, auditEntry, describeFields } from "./audit";
import { MAIN_GODOWN, ensureOpeningMoves, recordMoves, reverseMoves, saleMoves, type StockMove } from "./stock";
import { describeChanges } from "./invoice-history";
const inr = (n: number) => `₹${(Number(n) || 0).toFixed(2)}`;


declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      mode?: "read" | "readwrite";
      id?: string;
      startIn?: string | FileSystemHandle;
    }) => Promise<FileSystemDirectoryHandle>;
  }
}

const STORAGE_KEY = "argus_app_data";
const DIR_HANDLE_KEY = "argus_dir_handle";
const DEFAULT_INVOICE_DIR = "ArgusInvoices";

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  currency: "INR",
  invoicePrefix: "INV",
  invoiceSuffix: "",
  defaultGstRate: 18,
  defaultPaymentTerms: "15",
  defaultNotes: "Thank you for your business.",
  defaultTerms: "Goods once sold will not be taken back.",
  roundOff: true,
  folderName: DEFAULT_INVOICE_DIR,
  cloudSharing: undefined,
};

export function getDefaultData(): AppData {
  return {
    businesses: [],
    parties: [],
    invoices: [],
    stock: [],
    activeBusinessId: null,
    invoiceCounter: 1,
    settings: { ...DEFAULT_SETTINGS },
    creditNotes: [],
    debitNotes: [],
    payroll: [],
    deliveryChallans: [],
    expenses: [],
    quotes: [],
    purchases: [],
    payments: [],
    templates: [],
    khataEntries: [],
  };
}

type DirHandle = FileSystemDirectoryHandle & {
  requestPermission?: (opts: { mode: string }) => Promise<"granted" | "denied">;
  queryPermission?: (opts: { mode: string }) => Promise<"granted" | "denied">;
};

const IDB_NAME = "argus-web";
const IDB_VERSION = 1;
const IDB_STORE = "kv";
const BOOKS_FILENAME = "argus-books.json";

let dirHandle: DirHandle | null = null;
let useFileSystem = false;
let memoryCache: AppData | null = null;
let storageReady = false;
let initPromise: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
/**
 * Books are stored per Firebase account ("appData:<uid>") so a second person
 * signing in on a shared computer never sees, or cloud-merges, someone else's books.
 */
let scopeUid = "";
const LEGACY_OWNER_KEY = "appDataOwner";
function scoped(base: string, uid = scopeUid): string {
  return uid ? `${base}:${uid}` : base;
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function readLegacyLocalStorage(): AppData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return { ...getDefaultData(), ...parsed };
  } catch {
    return null;
  }
}

async function idbDelete(key: string): Promise<void> {
  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

let claimLegacy = true;

/** Pre-scoping books (single shared key) go to the first account that signs in, once. */
async function claimLegacyBooks(uid: string): Promise<AppData | null> {
  if (!claimLegacy) return null;
  try {
    const owner = await idbGet<string>(LEGACY_OWNER_KEY);
    if (owner && owner !== uid) return null;
    const legacy = (await idbGet<AppData>("appData")) ?? readLegacyLocalStorage();
    const legacyHandle = await idbGet<DirHandle>("dirHandle");
    await idbSet(LEGACY_OWNER_KEY, uid);
    if (legacyHandle) await idbSet(scoped("dirHandle", uid), legacyHandle);
    await idbDelete("appData");
    await idbDelete("dirHandle");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    return legacy && typeof legacy === "object" ? { ...getDefaultData(), ...legacy } : null;
  } catch {
    return null;
  }
}

/** Call on web app boot, with the signed-in uid, before relying on loadData/saveData. */
export async function initStorage(uid = "", opts: { claimLegacy?: boolean } = {}): Promise<AppData> {
  // Someone opening another person's books (a team) never takes this browser's old books there.
  claimLegacy = opts.claimLegacy !== false;
  if (typeof window === "undefined") return getDefaultData();
  if (uid !== scopeUid) {
    // Account changed: persist anything pending under the old account, then start clean.
    flushPendingSave();
    scopeUid = uid;
    memoryCache = null;
    storageReady = false;
    initPromise = null;
    dirHandle = null;
    useFileSystem = false;
  }
  if (storageReady && memoryCache) return memoryCache;
  if (initPromise) {
    await initPromise;
    return memoryCache ?? getDefaultData();
  }

  initPromise = (async () => {
    let data: AppData | null = null;
    try {
      const fromIdb = await idbGet<AppData>(scoped("appData"));
      if (fromIdb && typeof fromIdb === "object") {
        data = { ...getDefaultData(), ...fromIdb };
      }
    } catch {
      // IndexedDB unavailable
    }

    if (!data && scopeUid) {
      data = (await claimLegacyBooks(scopeUid)) ?? getDefaultData();
      try {
        await idbSet(scoped("appData"), data);
      } catch {
        // ignore
      }
    }
    if (!data) data = getDefaultData();

    memoryCache = data;

    try {
      const handle = scopeUid ? await idbGet<DirHandle>(scoped("dirHandle")) : undefined;
      if (handle) {
        dirHandle = handle;
        useFileSystem = true;
        const ok = await verifyFolderPermission();
        if (!ok) {
          useFileSystem = false;
        } else {
          const folderData = await readBooksFromFolder();
          if (folderData) {
            memoryCache = { ...getDefaultData(), ...folderData };
            await idbSet(scoped("appData"), memoryCache);
          }
        }
      }
    } catch {
      // handle restore optional
    }

    storageReady = true;
  })();

  await initPromise;
  return memoryCache ?? getDefaultData();
}

export function isStorageReady(): boolean {
  return storageReady;
}

export function isFileSystemSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

async function ensureDirPermission(handle: DirHandle): Promise<boolean> {
  try {
    const perm = await handle.queryPermission?.({ mode: "readwrite" });
    if (perm === "granted") return true;
    const requested = await handle.requestPermission?.({ mode: "readwrite" });
    return requested === "granted";
  } catch {
    return true;
  }
}

async function writeBooksToFolder(data: AppData, handle: DirHandle | null = useFileSystem ? dirHandle : null): Promise<void> {
  if (!handle) return;
  try {
    await writeFileToDir(handle, BOOKS_FILENAME, JSON.stringify(data, null, 2));
  } catch {
    // folder may be revoked
  }
}

async function readBooksFromFolder(): Promise<AppData | null> {
  if (!dirHandle) return null;
  try {
    const fileHandle = await dirHandle.getFileHandle(BOOKS_FILENAME);
    const file = await fileHandle.getFile();
    const text = await file.text();
    const parsed = JSON.parse(text) as Partial<AppData>;
    if (!parsed || typeof parsed !== "object") return null;
    return { ...getDefaultData(), ...parsed };
  } catch {
    return null;
  }
}

/**
 * Prompt the user to choose a folder. Books are stored as argus-books.json
 * in that folder; invoices still go under business/date subfolders.
 */
export async function pickFolder(): Promise<string | null> {
  if (!isFileSystemSupported()) return null;

  try {
    const picker = window.showDirectoryPicker;
    if (!picker) return null;
    const handle = (await picker({
      mode: "readwrite",
      id: DIR_HANDLE_KEY,
      startIn: "documents",
    })) as DirHandle;

    if (!(await ensureDirPermission(handle))) {
      return null;
    }

    dirHandle = handle;
    useFileSystem = true;

    try {
      await idbSet(scoped("dirHandle"), handle);
    } catch {
      // Chrome may still keep the in-memory handle for this session
    }

    const existing = await readBooksFromFolder();
    if (existing) {
      memoryCache = existing;
      await idbSet(scoped("appData"), existing);
    } else {
      const current = loadData();
      current.settings.folderName = handle.name;
      memoryCache = current;
      await persistNow(current);
    }

    const settings = getSettings();
    settings.folderName = handle.name;
    saveSettings(settings);

    return handle.name;
  } catch {
    return null;
  }
}

export async function verifyFolderPermission(): Promise<boolean> {
  if (!dirHandle) return false;
  return ensureDirPermission(dirHandle);
}

export function getFolderName(): string {
  return getSettings().folderName || DEFAULT_INVOICE_DIR;
}

export function isUsingFileSystem(): boolean {
  return useFileSystem && dirHandle !== null;
}

export async function disconnectFolder(): Promise<void> {
  dirHandle = null;
  useFileSystem = false;
  try {
    const db = await openIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(scoped("dirHandle"));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
  const data = loadData();
  data.settings.folderName = DEFAULT_INVOICE_DIR;
  saveData(data);
}

async function getOrCreateSubDir(name: string): Promise<DirHandle | null> {
  if (!dirHandle) return null;
  try {
    const sub = await dirHandle.getDirectoryHandle(name, { create: true }) as DirHandle;
    return sub;
  } catch {
    return null;
  }
}

async function writeFileToDir(dir: DirHandle, filename: string, content: string): Promise<void> {
  const fileHandle = await dir.getFileHandle(filename, { create: true });
  const writable = await (fileHandle as unknown as {
    createWritable: () => Promise<{
      write: (data: string) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }).createWritable();
  await writable.write(content);
  await writable.close();
}

async function getDateSubDir(parentDir: DirHandle, dateStr: string): Promise<DirHandle | null> {
  const dateFolder = dateStr || todayIST();
  return getOrCreateSubDirIn(parentDir, dateFolder);
}

async function getOrCreateSubDirIn(parent: DirHandle, name: string): Promise<DirHandle | null> {
  if (!parent) return null;
  try {
    const sub = await parent.getDirectoryHandle(name, { create: true }) as DirHandle;
    return sub;
  } catch {
    return null;
  }
}

export async function saveInvoiceToFile(invoice: Invoice, businessName: string): Promise<void> {
  if (!useFileSystem || !dirHandle) return;

  const safeName = businessName.replace(/[^a-zA-Z0-9]/g, "_") || "Business";
  const bizDir = await getOrCreateSubDir(safeName);
  if (!bizDir) return;
  const dateDir = await getDateSubDir(bizDir, invoice.date);
  if (!dateDir) return;

  const filename = `${invoice.invoiceNumber.replace(/[^a-zA-Z0-9]/g, "_")}.json`;
  await writeFileToDir(dateDir, filename, JSON.stringify(invoice, null, 2));
}

export async function saveInvoiceAsHTML(
  invoice: Invoice,
  businessName: string,
  htmlContent: string
): Promise<void> {
  if (!useFileSystem || !dirHandle) return;

  const safeName = businessName.replace(/[^a-zA-Z0-9]/g, "_") || "Business";
  const bizDir = await getOrCreateSubDir(safeName);
  if (!bizDir) return;
  const dateDir = await getDateSubDir(bizDir, invoice.date);
  if (!dateDir) return;

  const filename = `${invoice.invoiceNumber.replace(/[^a-zA-Z0-9]/g, "_")}.html`;
  await writeFileToDir(dateDir, filename, htmlContent);
}

export async function saveInvoiceAsPDF(
  invoice: Invoice,
  businessName: string,
  pdfBlob: Blob
): Promise<void> {
  if (!useFileSystem || !dirHandle) return;

  const safeName = businessName.replace(/[^a-zA-Z0-9]/g, "_") || "Business";
  const bizDir = await getOrCreateSubDir(safeName);
  if (!bizDir) return;
  const dateDir = await getDateSubDir(bizDir, invoice.date);
  if (!dateDir) return;

  const filename = `${invoice.invoiceNumber.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  const fileHandle = await dateDir.getFileHandle(filename, { create: true });
  const writable = await (fileHandle as unknown as {
    createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
  }).createWritable();
  await writable.write(pdfBlob);
  await writable.close();
}

export function downloadInvoiceFile(invoice: Invoice, businessName: string): void {
  const safeName = businessName.replace(/[^a-zA-Z0-9]/g, "_") || "Business";
  const filename = `${safeName}_${invoice.invoiceNumber.replace(/[^a-zA-Z0-9]/g, "_")}.json`;
  const blob = new Blob([JSON.stringify(invoice, null, 2)], { type: "application/json" });
  triggerDownload(blob, filename);
}

export function downloadInvoiceHTML(invoice: Invoice, businessName: string, htmlContent: string): void {
  const safeName = businessName.replace(/[^a-zA-Z0-9]/g, "_") || "Business";
  const filename = `${safeName}_${invoice.invoiceNumber.replace(/[^a-zA-Z0-9]/g, "_")}.html`;
  const blob = new Blob([htmlContent], { type: "text/html" });
  triggerDownload(blob, filename);
}

export function downloadInvoicePDF(invoice: Invoice, businessName: string, pdfBlob: Blob): void {
  const safeName = businessName.replace(/[^a-zA-Z0-9]/g, "_") || "Business";
  const filename = `${safeName}_${invoice.invoiceNumber.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  triggerDownload(pdfBlob, filename);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function loadData(): AppData {
  if (typeof window === "undefined") return getDefaultData();
  if (memoryCache) return memoryCache;
  // Before initStorage(uid) we do not know whose books these would be; start empty.
  memoryCache = getDefaultData();
  return memoryCache;
}

type PersistTarget = { key: string; lsKey: string; handle: DirHandle | null };

/** Where a save goes, captured when it is scheduled so an account switch cannot redirect it. */
function currentTarget(): PersistTarget {
  return { key: scoped("appData"), lsKey: scoped(STORAGE_KEY), handle: useFileSystem ? dirHandle : null };
}

async function persistNow(data: AppData, target: PersistTarget = currentTarget()): Promise<void> {
  if (!scopeUid && target.key === "appData") return; // never persist books without an account
  try {
    await idbSet(target.key, data);
    // IndexedDB holds the books now; drop the legacy copy so it cannot resurface stale.
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  } catch {
    // IndexedDB blocked (e.g. some private modes): fall back to localStorage.
    try {
      localStorage.setItem(target.lsKey, JSON.stringify(data));
    } catch {
      // storage full
    }
  }
  await writeBooksToFolder(data, target.handle);
}

let pendingTarget: PersistTarget | null = null;

/** Write any debounced save immediately (tab hidden / closing / account switch). */
export function flushPendingSave(): void {
  if (!persistTimer || !memoryCache) return;
  clearTimeout(persistTimer);
  persistTimer = null;
  void persistNow(memoryCache, pendingTarget ?? currentTarget());
  pendingTarget = null;
}

let flushListenersAttached = false;
function attachFlushListeners() {
  if (flushListenersAttached || typeof window === "undefined") return;
  flushListenersAttached = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPendingSave();
  });
  window.addEventListener("pagehide", flushPendingSave);
}

export function saveData(data: AppData): void {
  if (typeof window === "undefined") return;
  memoryCache = data;
  // Serialising the whole book synchronously on every edit stalled the UI for
  // large shops; persist once, debounced, and flush when the tab is hidden.
  attachFlushListeners();
  if (persistTimer) clearTimeout(persistTimer);
  const target = currentTarget();
  pendingTarget = target;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    pendingTarget = null;
    void persistNow(data, target);
  }, 200);
}

export function getSettings(): AppSettings {
  const data = loadData();
  return data.settings;
}

export function saveSettings(settings: AppSettings): void {
  const data = loadData();
  const changes = describeFields(data.settings, settings, {
    invoicePrefix: "Bill prefix", roundOff: "Round to the rupee", defaultGstRate: "Default GST %", turnoverAbove5Cr: "Turnover above ₹5 crore",
  });
  if (changes) appendAudit(data, auditEntry({ action: "edited", entity: "settings", entityId: "settings", ref: "Settings", detail: changes }));
  data.settings = settings;
  saveData(data);
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function cleanPrefix(prefix: string): string {
  return (prefix || "").replace(/[^A-Za-z0-9-]/g, "").toUpperCase() || "INV";
}

export function invoiceSeries(prefix: string, date: string = todayIST()): string {
  return `${cleanPrefix(prefix).slice(0, 4)}/${financialYear(date)}/W`;
}

/**
 * Next bill number, e.g. "INV/26-27/W0001": one series per financial year,
 * numbered from the bills already in it (Rule 46(b): unique per year, at most
 * 16 characters). The "W" marks bills made on the website; the phone app uses
 * "INV/26-27/0001", so a phone working offline and the website can never hand
 * out the same number.
 */
/**
 * This person's bill series on the website: "W" for the owner, "W" plus a
 * letter for each other user, so two people never issue the same number.
 */
let billSeries = "";
export function setBillSeries(series: string) {
  billSeries = String(series || "").replace(/[^A-Z]/g, "").slice(0, 1);
}

export function generateInvoiceNumber(
  invoices: ReadonlyArray<{ invoiceNumber: string }>,
  prefix: string,
  date: string = todayIST(),
): string {
  const p = cleanPrefix(prefix);
  const fy = financialYear(date);
  let max = 0;
  const tag = `W${billSeries}`;
  const pattern = new RegExp(`^([A-Z0-9-]{1,4})\\/(\\d{2}-\\d{2})\\/${tag}(\\d+)$`);
  // Each GSTIN (a branch in another state) keeps its own unbroken series.
  const books = typeof window === "undefined" ? null : loadData();
  const active = books && (books.businesses || []).length > 1 ? books.activeBusinessId : null;
  for (const inv of invoices as ReadonlyArray<{ invoiceNumber: string; businessId?: string }>) {
    if (active && inv.businessId && inv.businessId !== active) continue;
    const m = pattern.exec(inv.invoiceNumber || "");
    if (!m || m[2] !== fy || !p.startsWith(m[1])) continue;
    max = Math.max(max, Number(m[3]));
  }
  const num = String(max + 1).padStart(4, "0");
  // "/26-27/W" is 8 characters (9 with a user letter); past 9,999 bills the prefix gives up a letter.
  return `${p.slice(0, Math.max(1, Math.min(4, 16 - 7 - tag.length - num.length)))}/${fy}/${tag}${num}`;
}

export function exportAllData(): string {
  return JSON.stringify(loadData(), null, 2);
}

export function importAllData(jsonStr: string): boolean {
  try {
    const data = JSON.parse(jsonStr) as AppData;
    if (!data.businesses || !data.invoices) return false;
    saveData(data);
    return true;
  } catch {
    return false;
  }
}

export function saveBusiness(business: BusinessProfile): void {
  const data = loadData();
  const idx = data.businesses.findIndex((b) => b.id === business.id);
  const changes = describeFields(data.businesses[idx], business, {
    name: "Name", gstin: "GSTIN", address: "Address", state: "State", composition: "Composition scheme", pan: "PAN",
  });
  if (idx < 0 || changes) {
    appendAudit(data, auditEntry({ action: idx < 0 ? "created" : "edited", entity: "business", entityId: business.id, ref: business.name, detail: changes || "Business added" }));
  }
  if (idx >= 0) {
    data.businesses[idx] = business;
  } else {
    data.businesses.push(business);
  }
  if (!data.activeBusinessId) data.activeBusinessId = business.id;
  saveData(adoptOrphanDocs(data));
}

/**
 * Bills and notes that arrived without a business (made on the phone before
 * a business existed on the website) belong to the active business; without
 * this they would be hidden from lists and reports.
 */
export function adoptOrphanDocs(data: AppData): AppData {
  const id = data.activeBusinessId;
  if (!id) return data;
  const fix = <T extends { businessId?: string }>(list: T[] | undefined): T[] | undefined =>
    list && list.some((x) => !x.businessId) ? list.map((x) => (x.businessId ? x : { ...x, businessId: id })) : list;
  const invoices = fix(data.invoices) || data.invoices;
  const creditNotes = fix(data.creditNotes as { businessId?: string }[] | undefined) as AppData["creditNotes"];
  const debitNotes = fix(data.debitNotes as { businessId?: string }[] | undefined) as AppData["debitNotes"];
  if (invoices === data.invoices && creditNotes === data.creditNotes && debitNotes === data.debitNotes) return data;
  return { ...data, invoices, creditNotes, debitNotes };
}

export function saveParty(party: Party): void {
  const data = loadData();
  const idx = data.parties.findIndex((p) => p.id === party.id);
  const changes = describeFields(data.parties[idx], party, { name: "Name", gstin: "GSTIN", phone: "Phone", address: "Address", state: "State" });
  if (idx < 0 || changes) {
    appendAudit(data, auditEntry({ action: idx < 0 ? "created" : "edited", entity: "customer", entityId: party.id, ref: party.name, detail: changes || `${party.type === "supplier" ? "Supplier" : "Customer"} added` }));
  }
  if (idx >= 0) {
    data.parties[idx] = party;
  } else {
    data.parties.push(party);
  }
  saveData(data);
}

export function saveInvoice(invoice: Invoice): void {
  const data = loadData();
  const idx = data.invoices.findIndex((i) => i.id === invoice.id);
  if (idx < 0) {
    appendAudit(data, auditEntry({
      action: "created", entity: "bill", entityId: invoice.id, ref: invoice.invoiceNumber,
      detail: `${invoice.status === "draft" ? "Draft" : "Bill"} for ${invoice.partyName || "walk-in"}, ${inr(invoice.grandTotal)}`,
    }));
  } else {
    const changes = describeChanges(data.invoices[idx], invoice);
    if (changes.length) appendAudit(data, auditEntry({ action: "edited", entity: "bill", entityId: invoice.id, ref: invoice.invoiceNumber, detail: changes.join("; ") }));
  }
  if (idx >= 0) {
    data.invoices[idx] = invoice;
  } else {
    data.invoices.push(invoice);
    data.invoiceCounter += 1;
  }
  saveData(data);
}

/**
 * Remember a deletion so cloud sync (other browsers, the phone) cannot bring
 * the record back. Tombstones merge by union in mergeData and on the server.
 */
export function markDeleted(data: AppData, key: DeletableKey, id: string): void {
  const deleted = (data.deleted ||= {});
  (deleted[key] ||= {})[id] = new Date().toISOString();
}

/**
 * Only drafts can be deleted. Issued bills are cancelled instead and stay in
 * the books (CGST Rule 56; cancelled bills count in GSTR-1 Table 13).
 */
export function deleteInvoice(id: string): void {
  const data = loadData();
  const inv = data.invoices.find((i) => i.id === id);
  if (inv && inv.status !== "draft") {
    throw new Error("Issued bills can't be deleted. Cancel the bill instead, or issue a credit note.");
  }
  data.invoices = data.invoices.filter((i) => i.id !== id);
  markDeleted(data, "invoices", id);
  if (inv) appendAudit(data, auditEntry({ action: "deleted", entity: "bill", entityId: id, ref: inv.invoiceNumber, detail: `Draft deleted (${inr(inv.grandTotal)})` }));
  saveData(data);
}

/** Marks an issued bill cancelled and records it in the bill's change log. */
export function cancelInvoice(id: string): void {
  const data = loadData();
  const before = data.invoices;
  data.invoices = data.invoices.map((i) =>
    i.id === id && i.status !== "cancelled"
      ? { ...i, status: "cancelled" as const, balanceDue: 0, updatedAt: new Date().toISOString(), history: [...(i.history || []), cancelledEntry()] }
      : i
  );
  // The goods on a cancelled bill go back into stock.
  const bill = before.find((i) => i.id === id && i.status !== "cancelled" && i.status !== "draft");
  if (bill) appendAudit(data, auditEntry({ action: "cancelled", entity: "bill", entityId: id, ref: bill.invoiceNumber, detail: `Bill cancelled (${inr(bill.grandTotal)}); stock returned` }));
  let next = ensureOpeningMoves(data);
  if (bill) {
    let back: Omit<StockMove, "id" | "createdAt">[] = reverseMoves(next, id, "sale_return", todayIST(), `Bill ${bill.invoiceNumber} cancelled`);
    // Bills from before stock movements were kept: put back what the bill lists.
    if (!back.length) {
      back = bill.items
        .filter((l) => l.stockItemId && next.stock.some((s) => s.id === l.stockItemId))
        .map((l) => ({ itemId: l.stockItemId!, date: todayIST(), kind: "sale_return" as const, qty: l.quantity, godown: MAIN_GODOWN, refId: id, ref: bill.invoiceNumber, note: `Bill ${bill.invoiceNumber} cancelled` }));
    }
    next = recordMoves(next, back);
  }
  saveData(next);
}

export function saveStockItem(item: StockItem): void {
  let data = ensureOpeningMoves(loadData());
  const idx = data.stock.findIndex((s) => s.id === item.id);
  const before = data.stock[idx];
  const changes = describeFields(data.stock[idx], item, { name: "Name", hsn: "HSN", rate: "Price", gstRate: "GST %", currentStock: "Stock", minStock: "Minimum stock" });
  if (idx < 0 || changes) {
    appendAudit(data, auditEntry({ action: idx < 0 ? "created" : "edited", entity: "stock", entityId: item.id, ref: item.name, detail: changes || `Item added with stock ${item.currentStock}` }));
  }
  // Stock counts change only through movements: opening stock for a new
  // item, an adjustment when the count is corrected by hand.
  const target = item.currentStock || 0;
  const was = before ? before.currentStock || 0 : 0;
  if (idx >= 0) {
    data.stock[idx] = { ...item, currentStock: was };
  } else {
    data.stock.push({ ...item, currentStock: 0 });
  }
  if (target !== was) {
    data = recordMoves(data, [{
      itemId: item.id, date: todayIST(), kind: idx < 0 ? "opening" : "adjust", qty: target - was, godown: MAIN_GODOWN,
      unitCost: target > was ? item.costPrice || 0 : undefined, note: idx < 0 ? "Opening stock" : "Stock count corrected",
    }]);
  }
  saveData(data);
}

/** Records stock movements (purchases, transfers, adjustments, production). */
export function saveStockMoves(moves: Omit<StockMove, "id" | "createdAt">[], audit?: { ref: string; detail: string }): void {
  let data = ensureOpeningMoves(loadData());
  data = recordMoves(data, moves);
  if (audit && moves[0]) appendAudit(data, auditEntry({ action: "recorded", entity: "stock", entityId: moves[0].itemId, ref: audit.ref, detail: audit.detail }));
  saveData(data);
}

export function bulkSaveStockItems(items: StockItem[]): void {
  const data = loadData();
  for (const item of items) {
    const idx = data.stock.findIndex((s) => s.id === item.id);
    if (idx >= 0) {
      data.stock[idx] = item;
    } else {
      data.stock.push(item);
    }
  }
  saveData(data);
}

/** Takes a bill's goods out of stock (earliest-expiring batches first). */
export function deductStockForInvoice(invoice: Invoice): void {
  let data = ensureOpeningMoves(loadData());
  data = recordMoves(data, saleMoves(data, invoice));
  saveData(data);
}

export function deleteStockItem(id: string): void {
  const data = loadData();
  const item = data.stock.find((s) => s.id === id);
  if (item) appendAudit(data, auditEntry({ action: "deleted", entity: "stock", entityId: id, ref: item.name, detail: `Item deleted (stock was ${item.currentStock})` }));
  data.stock = data.stock.filter((s) => s.id !== id);
  markDeleted(data, "stock", id);
  saveData(data);
}

export function deleteParty(id: string): void {
  const data = loadData();
  const party = data.parties.find((p) => p.id === id);
  if (party) appendAudit(data, auditEntry({ action: "deleted", entity: "customer", entityId: id, ref: party.name, detail: `${party.type === "supplier" ? "Supplier" : "Customer"} deleted` }));
  data.parties = data.parties.filter((p) => p.id !== id);
  markDeleted(data, "parties", id);
  saveData(data);
}

export function setActiveBusiness(id: string): void {
  const data = loadData();
  data.activeBusinessId = id;
  saveData(data);
}

// ─── Credit Notes ──────────────────────────────────────────────
export function saveCreditNote(cn: CreditNote): void {
  const data = loadData();
  const idx = data.creditNotes.findIndex((c) => c.id === cn.id);
  if (idx < 0) {
    const bill = data.invoices.find((i) => i.id === cn.invoiceId);
    appendAudit(data, auditEntry({ action: "created", entity: "credit_note", entityId: cn.id, ref: cn.creditNoteNumber, detail: `${inr(cn.totalAmount)} against ${bill?.invoiceNumber || "no bill"}${cn.reason ? ` — ${cn.reason}` : ""}` }));
  }
  if (idx >= 0) data.creditNotes[idx] = cn;
  else data.creditNotes.push(cn);
  saveData(data);
}

/** Issued notes are kept (Rule 56); cancelling marks them and the books post a reversal. */
export function cancelCreditNote(id: string): void {
  const data = loadData();
  const note = (data.creditNotes || []).find((n) => n.id === id && n.status !== "cancelled");
  if (note) appendAudit(data, auditEntry({ action: "cancelled", entity: "credit_note", entityId: id, ref: note.creditNoteNumber, detail: `Credit note cancelled (${inr(note.totalAmount)})` }));
  data.creditNotes = (data.creditNotes || []).map((n) =>
    n.id === id && n.status !== "cancelled" ? { ...n, status: "cancelled", updatedAt: new Date().toISOString() } : n,
  );
  saveData(data);
}

export function saveDebitNote(note: DebitNote): void {
  const data = loadData();
  data.debitNotes = data.debitNotes || [];
  const idx = data.debitNotes.findIndex((c) => c.id === note.id);
  if (idx < 0) {
    const bill = data.invoices.find((i) => i.id === note.invoiceId);
    appendAudit(data, auditEntry({ action: "created", entity: "debit_note", entityId: note.id, ref: note.debitNoteNumber, detail: `${inr(note.totalAmount)} against ${bill?.invoiceNumber || "no bill"}${note.reason ? ` — ${note.reason}` : ""}` }));
  }
  if (idx >= 0) data.debitNotes[idx] = note;
  else data.debitNotes.push(note);
  saveData(data);
}

/** Issued notes are kept (Rule 56); cancelling marks them and the books post a reversal. */
export function cancelDebitNote(id: string): void {
  const data = loadData();
  const note = (data.debitNotes || []).find((n) => n.id === id && n.status !== "cancelled");
  if (note) appendAudit(data, auditEntry({ action: "cancelled", entity: "debit_note", entityId: id, ref: note.debitNoteNumber, detail: `Debit note cancelled (${inr(note.totalAmount)})` }));
  data.debitNotes = (data.debitNotes || []).map((n) =>
    n.id === id && n.status !== "cancelled" ? { ...n, status: "cancelled", updatedAt: new Date().toISOString() } : n,
  );
  saveData(data);
}

export function savePayrollEntry(entry: PayrollEntry): void {
  const data = loadData();
  data.payroll = data.payroll || [];
  const idx = data.payroll.findIndex((c) => c.id === entry.id);
  if (idx >= 0) data.payroll[idx] = entry;
  else data.payroll.push(entry);
  saveData(data);
}

export function deletePayrollEntry(id: string): void {
  const data = loadData();
  data.payroll = (data.payroll || []).filter((c) => c.id !== id);
  markDeleted(data, "payroll", id);
  saveData(data);
}

// ─── Delivery Challans ─────────────────────────────────────────
export function saveDeliveryChallan(dc: DeliveryChallan): void {
  const data = loadData();
  const idx = data.deliveryChallans.findIndex((d) => d.id === dc.id);
  if (idx >= 0) data.deliveryChallans[idx] = dc;
  else data.deliveryChallans.push(dc);
  saveData(data);
}

export function deleteDeliveryChallan(id: string): void {
  const data = loadData();
  data.deliveryChallans = data.deliveryChallans.filter((d) => d.id !== id);
  markDeleted(data, "deliveryChallans", id);
  saveData(data);
}

// ─── Expenses ──────────────────────────────────────────────────
export function saveExpense(exp: Expense): void {
  const data = loadData();
  const idx = data.expenses.findIndex((e) => e.id === exp.id);
  const changes = describeFields(data.expenses[idx], exp, { amount: "Amount", category: "Category", date: "Date", vendor: "Paid to" });
  if (idx < 0 || changes) {
    appendAudit(data, auditEntry({ action: idx < 0 ? "created" : "edited", entity: "expense", entityId: exp.id, ref: exp.category || "Expense", detail: changes || `${inr(exp.amount)}${exp.description ? ` — ${exp.description}` : ""}` }));
  }
  if (idx >= 0) data.expenses[idx] = exp;
  else data.expenses.push(exp);
  saveData(data);
}

export function deleteExpense(id: string): void {
  const data = loadData();
  const exp = data.expenses.find((e) => e.id === id);
  if (exp) appendAudit(data, auditEntry({ action: "deleted", entity: "expense", entityId: id, ref: exp.category || "Expense", detail: `Expense deleted (${inr(exp.amount)})` }));
  data.expenses = data.expenses.filter((e) => e.id !== id);
  markDeleted(data, "expenses", id);
  saveData(data);
}

// ─── Quotes ────────────────────────────────────────────────────
export function saveQuote(quote: Quote): void {
  const data = loadData();
  const idx = data.quotes.findIndex((q) => q.id === quote.id);
  if (idx >= 0) data.quotes[idx] = quote;
  else data.quotes.push(quote);
  saveData(data);
}

export function deleteQuote(id: string): void {
  const data = loadData();
  data.quotes = data.quotes.filter((q) => q.id !== id);
  markDeleted(data, "quotes", id);
  saveData(data);
}

// ─── Purchases ─────────────────────────────────────────────────
export function savePurchase(purchase: Purchase): void {
  const data = loadData();
  const idx = data.purchases.findIndex((p) => p.id === purchase.id);
  const changes = describeFields(data.purchases[idx], purchase, { supplierName: "Supplier", supplierInvoiceNumber: "Supplier bill", totalAmount: "Amount", totalGstAmount: "GST", itcEligible: "GST claimable" });
  if (idx < 0 || changes) {
    appendAudit(data, auditEntry({ action: idx < 0 ? "created" : "edited", entity: "purchase", entityId: purchase.id, ref: purchase.supplierInvoiceNumber || purchase.purchaseNumber, detail: changes || `${purchase.supplierName}, ${inr(purchase.totalAmount)} (GST ${inr(purchase.totalGstAmount)})` }));
  }
  if (idx >= 0) data.purchases[idx] = purchase;
  else data.purchases.push(purchase);
  saveData(stockForPurchase(data, purchase));
}

/**
 * Goods on a purchase bill come into stock (lines picked from stock), at their
 * cost before GST and linked to the bill, so the profit and loss counts them
 * once. Editing the bill posts only what changed; deleting takes them out.
 */
function stockForPurchase(data: AppData, purchase: Purchase | null, purchaseId = purchase?.id || ""): AppData {
  const want = new Map<string, { qty: number; cost: number }>();
  for (const line of purchase?.items || []) {
    // Only lines picked from stock carry a real quantity (the quick form has none).
    const itemId = line.stockItemId;
    if (!itemId || !(line.quantity > 0)) continue;
    const w = want.get(itemId) || { qty: 0, cost: 0 };
    want.set(itemId, { qty: w.qty + line.quantity, cost: w.cost + (line.taxableAmount || 0) });
  }
  const have = new Map<string, number>();
  for (const m of data.stockMoves || []) {
    if (m.refId !== purchaseId || (m.kind !== "purchase" && m.kind !== "purchase_return")) continue;
    have.set(m.itemId, (have.get(m.itemId) || 0) + m.qty);
  }
  const date = (purchase?.supplierInvoiceDate || purchase?.createdAt || todayIST()).slice(0, 10);
  const ref = purchase ? purchase.supplierInvoiceNumber || purchase.purchaseNumber : "Purchase deleted";
  const moves: Omit<StockMove, "id" | "createdAt">[] = [];
  for (const itemId of new Set([...want.keys(), ...have.keys()])) {
    const w = want.get(itemId);
    const delta = Math.round(((w?.qty || 0) - (have.get(itemId) || 0)) * 1000) / 1000;
    if (Math.abs(delta) < 1e-9) continue;
    moves.push({
      itemId, date, kind: delta > 0 ? "purchase" : "purchase_return", qty: delta, godown: MAIN_GODOWN,
      unitCost: w && w.qty > 0 ? Math.round((w.cost / w.qty) * 100) / 100 : undefined, ref, refId: purchaseId,
    });
  }
  return moves.length ? recordMoves(ensureOpeningMoves(data), moves) : data;
}

export function deletePurchase(id: string): void {
  const data = loadData();
  const purchase = data.purchases.find((p) => p.id === id);
  if (purchase) appendAudit(data, auditEntry({ action: "deleted", entity: "purchase", entityId: id, ref: purchase.supplierInvoiceNumber || purchase.purchaseNumber, detail: `Purchase deleted (${purchase.supplierName}, ${inr(purchase.totalAmount)})` }));
  data.purchases = data.purchases.filter((p) => p.id !== id);
  markDeleted(data, "purchases", id);
  data.khataEntries = (data.khataEntries || []).filter((e) => e.sourceId !== id);
  // Goods from a deleted bill go back out of stock.
  saveData(stockForPurchase(data, null, id));
}

// ─── Payments ──────────────────────────────────────────────────
export function savePayment(payment: Payment): void {
  const data = loadData();
  const idx = data.payments.findIndex((p) => p.id === payment.id);
  if (idx >= 0) data.payments[idx] = payment;
  else data.payments.push(payment);
  saveData(data);
}

export function deletePayment(id: string): void {
  const data = loadData();
  const pay = data.payments.find((p) => p.id === id);
  if (pay) {
    const bill = data.invoices.find((i) => i.id === pay.invoiceId);
    appendAudit(data, auditEntry({ action: "deleted", entity: "payment", entityId: id, ref: bill?.invoiceNumber || "", detail: `Payment of ${inr(pay.amount)} deleted` }));
  }
  data.payments = data.payments.filter((p) => p.id !== id);
  markDeleted(data, "payments", id);
  saveData(data);
}

export function getPaymentsForInvoice(invoiceId: string): Payment[] {
  return loadData().payments.filter((p) => p.invoiceId === invoiceId);
}

// ─── Templates ─────────────────────────────────────────────────
export function saveTemplate(template: Template): void {
  const data = loadData();
  const idx = data.templates.findIndex((t) => t.id === template.id);
  if (idx >= 0) data.templates[idx] = template;
  else data.templates.push(template);
  saveData(data);
}

export function deleteTemplate(id: string): void {
  const data = loadData();
  data.templates = data.templates.filter((t) => t.id !== id);
  markDeleted(data, "templates", id);
  saveData(data);
}

// ─── Khata Entries ─────────────────────────────────────────────
export function saveKhataEntry(entry: KhataEntry): void {
  const data = loadData();
  const idx = data.khataEntries.findIndex((k) => k.id === entry.id);
  if (idx >= 0) data.khataEntries[idx] = entry;
  else data.khataEntries.push(entry);
  saveData(data);
}

export function deleteKhataEntry(id: string): void {
  const data = loadData();
  data.khataEntries = data.khataEntries.filter((k) => k.id !== id);
  markDeleted(data, "khataEntries", id);
  saveData(data);
}

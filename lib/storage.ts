"use client";

import type { AppData, AppSettings, BusinessProfile, Invoice, Party, StockItem, CreditNote, DeliveryChallan, Expense, Quote, Purchase, Payment, Template, KhataEntry } from "./types";

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

/** Call once on web app boot before relying on loadData/saveData. */
export async function initStorage(): Promise<AppData> {
  if (typeof window === "undefined") return getDefaultData();
  if (storageReady && memoryCache) return memoryCache;
  if (initPromise) {
    await initPromise;
    return memoryCache ?? getDefaultData();
  }

  initPromise = (async () => {
    let data: AppData | null = null;
    try {
      const fromIdb = await idbGet<AppData>("appData");
      if (fromIdb && typeof fromIdb === "object") {
        data = { ...getDefaultData(), ...fromIdb };
      }
    } catch {
      // IndexedDB unavailable
    }

    if (!data) {
      data = readLegacyLocalStorage() ?? getDefaultData();
      try {
        await idbSet("appData", data);
      } catch {
        // ignore
      }
    }

    memoryCache = data;

    try {
      const handle = await idbGet<DirHandle>("dirHandle");
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
            await idbSet("appData", memoryCache);
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

async function writeBooksToFolder(data: AppData): Promise<void> {
  if (!useFileSystem || !dirHandle) return;
  try {
    await writeFileToDir(dirHandle, BOOKS_FILENAME, JSON.stringify(data, null, 2));
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
      await idbSet("dirHandle", handle);
    } catch {
      // Chrome may still keep the in-memory handle for this session
    }

    const existing = await readBooksFromFolder();
    if (existing) {
      memoryCache = existing;
      await idbSet("appData", existing);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
      } catch {
        // ignore
      }
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
      tx.objectStore(IDB_STORE).delete("dirHandle");
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
  const dateFolder = dateStr || new Date().toISOString().split("T")[0];
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
  const legacy = readLegacyLocalStorage();
  memoryCache = legacy ?? getDefaultData();
  return memoryCache;
}

async function persistNow(data: AppData): Promise<void> {
  try {
    await idbSet("appData", data);
  } catch {
    // IndexedDB may be blocked
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full
  }
  await writeBooksToFolder(data);
}

export function saveData(data: AppData): void {
  if (typeof window === "undefined") return;
  memoryCache = data;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    void persistNow(data);
  }, 200);
}

export function getSettings(): AppSettings {
  const data = loadData();
  return data.settings;
}

export function saveSettings(settings: AppSettings): void {
  const data = loadData();
  data.settings = settings;
  saveData(data);
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function generateInvoiceNumber(counter: number, prefix: string, suffix: string): string {
  const year = new Date().getFullYear();
  const num = String(counter).padStart(4, "0");
  return `${prefix}-${year}-${num}${suffix ? `-${suffix}` : ""}`;
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
  if (idx >= 0) {
    data.businesses[idx] = business;
  } else {
    data.businesses.push(business);
  }
  if (!data.activeBusinessId) data.activeBusinessId = business.id;
  saveData(data);
}

export function saveParty(party: Party): void {
  const data = loadData();
  const idx = data.parties.findIndex((p) => p.id === party.id);
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
  if (idx >= 0) {
    data.invoices[idx] = invoice;
  } else {
    data.invoices.push(invoice);
    data.invoiceCounter += 1;
  }
  saveData(data);
}

export function deleteInvoice(id: string): void {
  const data = loadData();
  data.invoices = data.invoices.filter((i) => i.id !== id);
  saveData(data);
}

export function saveStockItem(item: StockItem): void {
  const data = loadData();
  const idx = data.stock.findIndex((s) => s.id === item.id);
  if (idx >= 0) {
    data.stock[idx] = item;
  } else {
    data.stock.push(item);
  }
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

export function deductStockForInvoice(invoice: Invoice): void {
  const data = loadData();
  for (const item of invoice.items) {
    if (item.stockItemId) {
      const stockIdx = data.stock.findIndex((s) => s.id === item.stockItemId);
      if (stockIdx >= 0) {
        data.stock[stockIdx].currentStock = Math.max(0, data.stock[stockIdx].currentStock - item.quantity);
      }
    }
  }
  saveData(data);
}

export function deleteStockItem(id: string): void {
  const data = loadData();
  data.stock = data.stock.filter((s) => s.id !== id);
  saveData(data);
}

export function deleteParty(id: string): void {
  const data = loadData();
  data.parties = data.parties.filter((p) => p.id !== id);
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
  if (idx >= 0) data.creditNotes[idx] = cn;
  else data.creditNotes.push(cn);
  saveData(data);
}

export function deleteCreditNote(id: string): void {
  const data = loadData();
  data.creditNotes = data.creditNotes.filter((c) => c.id !== id);
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
  saveData(data);
}

// ─── Expenses ──────────────────────────────────────────────────
export function saveExpense(exp: Expense): void {
  const data = loadData();
  const idx = data.expenses.findIndex((e) => e.id === exp.id);
  if (idx >= 0) data.expenses[idx] = exp;
  else data.expenses.push(exp);
  saveData(data);
}

export function deleteExpense(id: string): void {
  const data = loadData();
  data.expenses = data.expenses.filter((e) => e.id !== id);
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
  saveData(data);
}

// ─── Purchases ─────────────────────────────────────────────────
export function savePurchase(purchase: Purchase): void {
  const data = loadData();
  const idx = data.purchases.findIndex((p) => p.id === purchase.id);
  if (idx >= 0) data.purchases[idx] = purchase;
  else data.purchases.push(purchase);
  saveData(data);
}

export function deletePurchase(id: string): void {
  const data = loadData();
  data.purchases = data.purchases.filter((p) => p.id !== id);
  data.khataEntries = (data.khataEntries || []).filter((e) => e.sourceId !== id);
  saveData(data);
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
  data.payments = data.payments.filter((p) => p.id !== id);
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
  saveData(data);
}

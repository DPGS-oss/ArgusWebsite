"use client";

import type { AppData, DeletableKey } from "./types";
import { loadData, saveData, getDefaultData, adoptOrphanDocs } from "./storage";

const SYNC_VERSION = 1;
const LAST_SYNC_KEY = "argus_last_sync";
const CLOUD_UPDATED_KEY = "argus_cloud_updated";
/** When this browser last fetched the cloud's changes (the server's updated_at). */
const PULLED_KEY = "argus_cloud_pulled";
/** What this browser last knew the cloud holds: a short fingerprint per record. */
const BASE_KEY = "argus_sync_base";

/** Whose books this browser holds (the owner's, for someone on a team). */
let booksUid = "";
export function setBooksUid(uid: string) {
  booksUid = uid;
}

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";

export function getLastSyncTime(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_SYNC_KEY);
}

export function getCloudUpdatedAt(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CLOUD_UPDATED_KEY);
}

/**
 * The server allows about 30 loads and 30 saves a minute. When it says "too
 * many, try again in N seconds", wait and try once more instead of leaving
 * the changes unsaved until the next edit.
 */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  const response = await fetch(url, init);
  if (response.status !== 429) return response;
  const body = await response.clone().json().catch(() => ({}));
  const wait = Math.min(60, Math.max(1, Number(body?.retry_after_seconds) || 5));
  await new Promise((ok) => setTimeout(ok, wait * 1000));
  return fetch(url, init);
}

// ---------------------------------------------------------------- lean sync
// After the first sync, a save sends only the records that changed (and the
// ids that went away), and a load fetches only what changed since the last
// one. A year of a busy shop is ~5MB of JSON; a day's changes are a few KB.

/** Lists of records (things with an id) in the books. */
const RECORD_LISTS = [
  "businesses", "parties", "invoices", "stock", "creditNotes", "debitNotes", "payroll", "deliveryChallans",
  "expenses", "quotes", "purchases", "payments", "templates", "khataEntries", "stockMoves",
];
const isRecordList = (key: string, v: unknown) =>
  RECORD_LISTS.includes(key) || (Array.isArray(v) && v.some((r) => !!r && typeof r === "object" && (r as { id?: unknown }).id != null));

type Base = { v: 1; lists: Record<string, Record<string, string>>; small: string };

/** FNV-1a, 32 bits: enough to notice that a record changed. */
function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function recordHash(r: Record<string, unknown>): string {
  const { _s, _sync, ...rest } = r;
  void _s;
  void _sync;
  return fnv(JSON.stringify(rest));
}

/** The small parts (settings, active business, counters...), sent whole. */
function smallPart(data: AppData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === "auditLog" || k === "deleted" || isRecordList(k, v)) continue;
    out[k] = v;
  }
  return out;
}

function fingerprints(data: AppData): Base {
  const lists: Record<string, Record<string, string>> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k !== "auditLog" && !isRecordList(k, v)) continue;
    const m: Record<string, string> = {};
    for (const r of Array.isArray(v) ? (v as Record<string, unknown>[]) : []) if (r && r.id != null) m[String(r.id)] = k === "auditLog" ? "1" : recordHash(r);
    lists[k] = m;
  }
  return { v: 1, lists, small: fnv(JSON.stringify(smallPart(data)) + JSON.stringify(data.deleted || {})) };
}

let baseCache: { key: string; base: Base | null } | null = null;
const baseKey = () => `${BASE_KEY}:${booksUid || "own"}`;
function loadBase(): Base | null {
  if (typeof window === "undefined") return null;
  if (baseCache && baseCache.key === baseKey()) return baseCache.base;
  let base: Base | null = null;
  try {
    const raw = localStorage.getItem(baseKey());
    base = raw ? (JSON.parse(raw) as Base) : null;
  } catch {
    base = null;
  }
  baseCache = { key: baseKey(), base: base && base.v === 1 ? base : null };
  return baseCache.base;
}
function storeBase(base: Base | null) {
  baseCache = { key: baseKey(), base };
  try {
    if (base) localStorage.setItem(baseKey(), JSON.stringify(base));
    else localStorage.removeItem(baseKey());
  } catch {
    // Storage full: kept for this page only; the next page load sends the books once whole.
  }
}

/** Only what changed since `base`: records added or edited, ids gone, new edit-log lines. */
function buildPatch(data: AppData, base: Base, now: Base) {
  const changes: Record<string, unknown[]> = {};
  const removed: Record<string, string[]> = {};
  for (const [k, ids] of Object.entries(now.lists)) {
    if (k === "auditLog") continue;
    const was = base.lists[k] || {};
    const list = (data as unknown as Record<string, Record<string, unknown>[]>)[k] || [];
    const changed = list.filter((r) => r && r.id != null && was[String(r.id)] !== ids[String(r.id)]);
    if (changed.length) changes[k] = changed;
    const gone = Object.keys(was).filter((id) => !(id in ids));
    if (gone.length) removed[k] = gone;
  }
  for (const [k, was] of Object.entries(base.lists)) {
    if (k === "auditLog" || now.lists[k]) continue;
    if (Object.keys(was).length) removed[k] = Object.keys(was);
  }
  const knownLog = base.lists.auditLog || {};
  const auditLog = (data.auditLog || []).filter((e) => e && !knownLog[String(e.id)]);
  const empty = !Object.keys(changes).length && !Object.keys(removed).length && !auditLog.length && base.small === now.small;
  return { changes, removed, auditLog, empty };
}

/** After fetching the cloud's changes: those records are what the cloud holds now. */
function noteFetched(cloud: AppData, full: boolean) {
  if (full) {
    storeBase(fingerprints(cloud));
    return;
  }
  const base = loadBase();
  if (!base) return;
  const got = fingerprints(cloud);
  for (const [k, ids] of Object.entries(got.lists)) base.lists[k] = { ...(base.lists[k] || {}), ...ids };
  for (const [k, ids] of Object.entries(cloud.deleted || {})) {
    if (!base.lists[k]) continue;
    for (const id of Object.keys(ids || {})) delete base.lists[k][id];
  }
  storeBase(base);
}

/** Ask for packed answers where the browser can unpack them. */
const canUnpack = () => typeof DecompressionStream !== "undefined";
/** Headers that ask the server for a packed answer, where this browser can unpack it. */
export function packedAnswerHeaders(): Record<string, string> {
  return canUnpack() ? { "X-Argus-Accept": "gzip" } : {};
}
/** An answer's JSON, unpacking it if the server packed it. */
export async function readJson(response: Response): Promise<any> {
  if (response.headers.get("X-Argus-Packed") === "gzip" && canUnpack()) {
    const stream = response.body!.pipeThrough(new DecompressionStream("gzip"));
    return JSON.parse(await new Response(stream).text());
  }
  return response.json();
}

/**
 * A year of books is several MB of JSON and every save sends all of it: gzip
 * it (about ten times smaller) where the browser can, for the server's size
 * limit and the owner's data plan. The server unpacks gzip bodies itself.
 */
async function packJson(json: string): Promise<{ body: BodyInit; headers: Record<string, string> }> {
  if (json.length < 1024 || typeof CompressionStream === "undefined") return { body: json, headers: {} };
  try {
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
    return { body: await new Response(stream).arrayBuffer(), headers: { "Content-Encoding": "gzip" } };
  } catch {
    return { body: json, headers: {} };
  }
}

const pulledKey = () => `${PULLED_KEY}:${booksUid || "own"}`;

/** The cloud's books, or only what changed since this browser last fetched them (`delta`). */
async function fetchCloud(token: string): Promise<{ data: AppData; delta: boolean } | null> {
  try {
    const since = loadBase() ? localStorage.getItem(pulledKey()) || "" : "";
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (canUnpack()) headers["X-Argus-Accept"] = "gzip";
    const response = await fetchWithRetry(`/api/data/load${since ? `?since=${encodeURIComponent(since)}` : ""}`, { method: "GET", headers });

    if (!response.ok) return null;
    const result = await readJson(response);
    if (!result.data) return null;

    const cloudUpdatedAt = result.updated_at as string | null;
    const delta = !!result.delta;
    const cloudData = (delta ? { ...emptyLists(), ...result.data } : result.data) as AppData;
    if (cloudUpdatedAt) {
      localStorage.setItem(CLOUD_UPDATED_KEY, cloudUpdatedAt);
      localStorage.setItem(pulledKey(), cloudUpdatedAt);
    }
    noteFetched(cloudData, !delta);
    return { data: cloudData, delta };
  } catch {
    return null;
  }
}

function emptyLists(): Partial<AppData> {
  return Object.fromEntries(RECORD_LISTS.map((k) => [k, []])) as Partial<AppData>;
}

export async function loadCloudData(token: string): Promise<AppData | null> {
  const got = await fetchCloud(token);
  return got ? got.data : null;
}

/** "conflict": the phone (or another browser) saved since we last loaded. */
export async function saveCloudData(
  token: string,
  data: AppData,
  baseUpdatedAt: string | null = getCloudUpdatedAt()
): Promise<boolean | "conflict"> {
  try {
    const device = getDeviceName();
    // Lean save: only what changed since the cloud last matched this browser.
    const base = loadBase();
    if (base) {
      const now = fingerprints(data);
      const patch = buildPatch(data, base, now);
      if (patch.empty) return true;
      const body = await packJson(JSON.stringify({
        patch: true, ...patch, small: smallPart(data), deleted: data.deleted || {},
        version: SYNC_VERSION, device, books_uid: booksUid || undefined,
      }));
      const res = await fetchWithRetry("/api/data/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...body.headers },
        body: body.body,
      });
      if (res.ok) {
        const result = await res.json().catch(() => ({}));
        if (result.updated_at) localStorage.setItem(CLOUD_UPDATED_KEY, result.updated_at);
        localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
        storeBase(now);
        return true;
      }
      if (res.status === 409) {
        const out = await res.clone().json().catch(() => ({}));
        if (out && out.error === "books_changed") {
          window.location.reload();
          return false;
        }
      }
      if (res.status !== 400) return false;
      // An older server: send the books whole below.
      storeBase(null);
    }
    const packed = await packJson(JSON.stringify({
      appData: data,
      version: SYNC_VERSION,
      device,
      base_updated_at: baseUpdatedAt,
      books_uid: booksUid || undefined,
    }));
    const send = (p: { body: BodyInit; headers: Record<string, string> }) =>
      fetchWithRetry("/api/data/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...p.headers },
        body: p.body,
      });
    let response = await send(packed);
    // Somewhere on the way did not take a gzipped body: send it as it is.
    if (packed.headers["Content-Encoding"] && (response.status === 400 || response.status === 415)) {
      response = await send({ body: JSON.stringify({ appData: data, version: SYNC_VERSION, device, base_updated_at: baseUpdatedAt, books_uid: booksUid || undefined }), headers: {} });
    }

    if (response.status === 409) {
      const body = await response.clone().json().catch(() => ({}));
      // Joined or left a team since this page opened: start again with the right books.
      if (body && body.error === "books_changed") {
        window.location.reload();
        return false;
      }
      return "conflict";
    }
    if (!response.ok) return false;

    const result = await response.json();
    if (result.updated_at) {
      localStorage.setItem(CLOUD_UPDATED_KEY, result.updated_at);
    }
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    // The cloud now holds exactly this: later saves send only changes.
    storeBase(fingerprints(data));
    return true;
  } catch {
    return false;
  }
}

export async function syncFromCloud(token: string): Promise<{
  data: AppData | null;
  merged: boolean;
}> {
  const localData = loadData();
  const fetched = await fetchCloud(token);
  const cloudData = fetched ? fetched.data : null;

  if (!cloudData) {
    return { data: localData, merged: false };
  }

  const localLastSync = getLastSyncTime();
  const cloudUpdatedAt = getCloudUpdatedAt();

  let mergedData: AppData;

  if (
    (fetched && fetched.delta) ||
    cloudData.invoices.length > 0 ||
    cloudData.businesses.length > 0 ||
    (cloudData.stock || []).length > 0 ||
    (cloudData.khataEntries || []).length > 0
  ) {
    mergedData = mergeData(localData, cloudData);
  } else {
    mergedData = localData;
  }

  saveData(mergedData);
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

  if (cloudUpdatedAt) {
    localStorage.setItem(CLOUD_UPDATED_KEY, cloudUpdatedAt);
  }

  return { data: mergedData, merged: true };
}

export async function syncToCloud(token: string, data?: AppData): Promise<boolean> {
  const first = await saveCloudData(token, data || loadData());
  if (first !== "conflict") return first;
  // Someone else saved first: pull and merge their changes, then save once more.
  const { data: merged } = await syncFromCloud(token);
  const retry = await saveCloudData(token, merged || loadData());
  return retry === true;
}

export function mergeData(local: AppData, cloud: AppData): AppData {
  const merged: AppData = {
    businesses: mergeById(local.businesses, cloud.businesses),
    parties: mergeById(local.parties, cloud.parties),
    invoices: mergeById(local.invoices, cloud.invoices),
    stock: mergeById(local.stock, cloud.stock),
    activeBusinessId: cloud.activeBusinessId || local.activeBusinessId,
    invoiceCounter: Math.max(local.invoiceCounter, cloud.invoiceCounter),
    settings: {
      ...local.settings,
      ...Object.fromEntries(
        Object.entries(cloud.settings || {}).filter(([, v]) => v !== undefined && v !== "")
      ),
    },
    creditNotes: mergeById(local.creditNotes ?? [], cloud.creditNotes ?? []),
    debitNotes: mergeById(local.debitNotes ?? [], cloud.debitNotes ?? []),
    payroll: mergeById(local.payroll ?? [], cloud.payroll ?? []),
    deliveryChallans: mergeById(local.deliveryChallans ?? [], cloud.deliveryChallans ?? []),
    expenses: mergeById(local.expenses ?? [], cloud.expenses ?? []),
    quotes: mergeById(local.quotes ?? [], cloud.quotes ?? []),
    purchases: mergeById(local.purchases ?? [], cloud.purchases ?? []),
    payments: mergeById(local.payments ?? [], cloud.payments ?? []),
    templates: mergeById(local.templates ?? [], cloud.templates ?? []),
    khataEntries: mergeById(local.khataEntries ?? [], cloud.khataEntries ?? []),
    // Stock movements are never edited, only added: keep both sides'.
    stockMoves: mergeById(local.stockMoves ?? [], cloud.stockMoves ?? []),
    godowns: [...new Set([...(local.godowns ?? []), ...(cloud.godowns ?? [])])],
    // The edit log only grows: keep every entry from both sides, oldest first.
    auditLog: mergeById(local.auditLog ?? [], cloud.auditLog ?? []).sort((a, b) => a.at.localeCompare(b.at)),
  };
  // GSTR-2B uploads by month: the later upload of a month wins.
  const gstr2b = { ...(local.gstr2b || {}) };
  for (const [period, v] of Object.entries(cloud.gstr2b || {})) {
    if (!gstr2b[period] || (v?.uploadedAt || "") > (gstr2b[period]?.uploadedAt || "")) gstr2b[period] = v;
  }
  if (Object.keys(gstr2b).length) merged.gstr2b = gstr2b;

  // Deletions on either side win over the other side's copy.
  const deleted: NonNullable<AppData["deleted"]> = {};
  for (const src of [local.deleted, cloud.deleted]) {
    for (const [key, ids] of Object.entries(src || {}) as [DeletableKey, Record<string, string>][]) {
      deleted[key] = { ...(deleted[key] || {}), ...(ids || {}) };
    }
  }
  for (const [key, ids] of Object.entries(deleted) as [DeletableKey, Record<string, string>][]) {
    const list = merged[key] as unknown as { id: string }[] | undefined;
    if (Array.isArray(list)) {
      (merged as unknown as Record<string, unknown>)[key] = list.filter((x) => !ids[x.id]);
    }
  }
  if (Object.keys(deleted).length) merged.deleted = deleted;

  return adoptOrphanDocs(stockFromMoves(merged));
}

/**
 * Stock on hand is the sum of an item's movements, so a sale made on the
 * phone and one made here at the same time both count after a merge.
 */
export function stockFromMoves(data: AppData): AppData {
  const moves = data.stockMoves || [];
  if (!moves.length) return data;
  const sums = new Map<string, number>();
  for (const m of moves) sums.set(m.itemId, Math.round(((sums.get(m.itemId) || 0) + m.qty) * 1000) / 1000);
  let changed = false;
  const stock = data.stock.map((s) => {
    const sum = sums.get(s.id);
    if (sum === undefined || Math.abs((s.currentStock || 0) - sum) < 1e-9) return s;
    changed = true;
    return { ...s, currentStock: sum };
  });
  return changed ? { ...data, stock } : data;
}

function mergeById<T extends { id: string; updatedAt?: string }>(
  local: T[],
  cloud: T[]
): T[] {
  const map = new Map<string, T>();

  for (const item of local) {
    map.set(item.id, item);
  }

  for (const item of cloud) {
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
    } else {
      const existingTime = existing.updatedAt || "";
      const cloudTime = item.updatedAt || "";
      // The newer edit wins; with no edit time on either (older records),
      // the cloud's copy, which every device shares: a stale copy in one
      // browser must not overwrite a change made elsewhere.
      if (cloudTime >= existingTime) {
        map.set(item.id, item);
      }
    }
  }

  return Array.from(map.values());
}

function getDeviceName(): string {
  if (typeof window === "undefined") return "server";
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android-web";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios-web";
  if (/Mobile/i.test(ua)) return "mobile-web";
  return "desktop-web";
}

export async function postScanResult(token: string, code: string): Promise<boolean> {
  try {
    const response = await fetch("/api/data/scan-result", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function pollScanResult(token: string): Promise<string | null> {
  try {
    const response = await fetch("/api/data/scan-result", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) return null;
    const result = await response.json();
    return result.code || null;
  } catch {
    return null;
  }
}

export async function clearScanResult(token: string): Promise<void> {
  try {
    await fetch("/api/data/scan-result", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    // ignore
  }
}

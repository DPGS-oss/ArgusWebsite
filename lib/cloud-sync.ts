"use client";

import type { AppData } from "./types";
import { loadData, saveData, getDefaultData } from "./storage";

const SYNC_VERSION = 1;
const LAST_SYNC_KEY = "argus_last_sync";
const CLOUD_UPDATED_KEY = "argus_cloud_updated";

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";

export function getLastSyncTime(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_SYNC_KEY);
}

export function getCloudUpdatedAt(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CLOUD_UPDATED_KEY);
}

export async function loadCloudData(token: string): Promise<AppData | null> {
  try {
    const response = await fetch("/api/data/load", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return null;
    const result = await response.json();
    if (!result.data) return null;

    const cloudData = result.data as AppData;
    const cloudUpdatedAt = result.updated_at as string | null;

    if (cloudUpdatedAt) {
      localStorage.setItem(CLOUD_UPDATED_KEY, cloudUpdatedAt);
    }

    return cloudData;
  } catch {
    return null;
  }
}

export async function saveCloudData(token: string, data: AppData): Promise<boolean> {
  try {
    const device = getDeviceName();
    const response = await fetch("/api/data/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        appData: data,
        version: SYNC_VERSION,
        device,
      }),
    });

    if (!response.ok) return false;

    const result = await response.json();
    if (result.updated_at) {
      localStorage.setItem(CLOUD_UPDATED_KEY, result.updated_at);
    }
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
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
  const cloudData = await loadCloudData(token);

  if (!cloudData) {
    return { data: localData, merged: false };
  }

  const localLastSync = getLastSyncTime();
  const cloudUpdatedAt = getCloudUpdatedAt();

  let mergedData: AppData;

  if (cloudData.invoices.length > 0 || cloudData.businesses.length > 0) {
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
  const dataToSync = data || loadData();
  return saveCloudData(token, dataToSync);
}

function mergeData(local: AppData, cloud: AppData): AppData {
  const merged: AppData = {
    businesses: mergeById(local.businesses, cloud.businesses),
    parties: mergeById(local.parties, cloud.parties),
    invoices: mergeById(local.invoices, cloud.invoices),
    stock: mergeById(local.stock, cloud.stock),
    activeBusinessId: cloud.activeBusinessId || local.activeBusinessId,
    invoiceCounter: Math.max(local.invoiceCounter, cloud.invoiceCounter),
    settings: { ...local.settings, ...cloud.settings },
  };

  return merged;
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
      if (cloudTime > existingTime) {
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

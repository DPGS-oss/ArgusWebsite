"use client";

import { useState, type ChangeEvent } from "react";
import { Settings as SettingsIcon, Download, Upload, FolderOpen, Save, Cloud, RefreshCw } from "lucide-react";
import type { AppData, AppSettings, GSTRate } from "@/lib/types";
import { saveSettings, exportAllData, importAllData, pickFolder, isUsingFileSystem, getFolderName, isFileSystemSupported, disconnectFolder, loadData } from "@/lib/storage";
import { useAuth, hasValidSubscription } from "@/lib/auth-provider";
import { syncFromCloud, syncToCloud, getLastSyncTime } from "@/lib/cloud-sync";
import { encryptBooksPayload, generateCaShareKey } from "@/lib/ca-crypto";
import { gstRatePickerOptions, gstRateLabel } from "@/lib/gst";

type SettingsProps = {
  data: AppData;
  onSaved: () => void;
};

const CA_INVITE_KEY = "argus_ca_invite_session";

function loadStoredCaInvite() {
  try {
    const raw = sessionStorage.getItem(CA_INVITE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { redeem_url: string; backup_code: string; expires_at: string };
    if (!parsed.redeem_url || !parsed.expires_at) return null;
    if (new Date(parsed.expires_at).getTime() < Date.now()) {
      sessionStorage.removeItem(CA_INVITE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function buildSharePayload() {
  const app = loadData();
  const activeBiz =
    app.businesses.find((b) => b.id === app.activeBusinessId) || app.businesses[0] || null;
  return {
    invoices: app.invoices || [],
    purchases: app.purchases || [],
    expenses: app.expenses || [],
    khata: app.khataEntries || [],
    inventory: app.stock || [],
    parties: app.parties || [],
    business_profile: activeBiz
      ? {
          name: activeBiz.name,
          gstin: activeBiz.gstin,
          address: activeBiz.address,
        }
      : {},
  };
}

export function Settings({ data, onSaved }: SettingsProps) {
  const { user, token } = useAuth();
  const [settings, setSettings] = useState<AppSettings>({ ...data.settings });
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(getLastSyncTime());
  const [caInvite, setCaInvite] = useState<{
    redeem_url: string;
    backup_code: string;
    expires_at?: string;
    share_key?: string;
  } | null>(loadStoredCaInvite);
  const [caBusy, setCaBusy] = useState(false);

  const canSync = !!token && hasValidSubscription(user);

  async function handleSyncFromCloud() {
    if (!token) return;
    setSyncing(true);
    const result = await syncFromCloud(token);
    setSyncing(false);
    setLastSync(getLastSyncTime());
    if (result.merged) {
      onSaved();
      alert("Data synced from cloud successfully!");
    } else {
      alert("No cloud data found or already up to date.");
    }
  }

  async function handleSyncToCloud() {
    if (!token) return;
    setSyncing(true);
    const ok = await syncToCloud(token);
    setSyncing(false);
    setLastSync(getLastSyncTime());
    alert(ok ? "Data uploaded to cloud successfully!" : "Failed to upload data to cloud.");
  }

  function update(field: keyof AppSettings, value: string | boolean | GSTRate) {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  function handleSave() {
    saveSettings(settings);
    setSaved(true);
    onSaved();
    setTimeout(() => setSaved(false), 2000);
  }

  function handleExport() {
    const json = exportAllData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `argus_backup_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (importAllData(result)) {
        alert("Data imported successfully!");
        onSaved();
      } else {
        alert("Failed to import data. Invalid file format.");
      }
    };
    reader.readAsText(file);
  }

  async function handlePickFolder() {
    const name = await pickFolder();
    if (name) {
      onSaved();
      alert(`Folder connected: ${name}\nBooks are saved as argus-books.json in this folder.`);
    } else if (!isFileSystemSupported()) {
      alert("Folder storage needs Chrome or Edge. Data still saves in this browser (IndexedDB).");
    }
  }

  async function handleDisconnectFolder() {
    await disconnectFolder();
    onSaved();
  }

  async function uploadEncryptedShare(shareKey: string) {
    if (!token) throw new Error("Sign in first");
    const { ciphertext, iv } = await encryptBooksPayload(buildSharePayload(), shareKey);
    const up = await fetch("/api/ca/share", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ciphertext, iv }),
    });
    if (!up.ok) {
      const err = await up.json().catch(() => ({}));
      throw new Error(err.error || "Could not upload encrypted books for CA");
    }
  }

  async function handleInviteCa(replace = false) {
    if (!token) {
      alert("Sign in first");
      return;
    }
    if (!replace) {
      const stored = loadStoredCaInvite();
      if (stored) {
        setCaInvite(stored);
        return;
      }
    }
    setCaBusy(true);
    try {
      const res = await fetch("/api/ca/invites", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ replace }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create invite");
      if (!data.token && !data.redeem_url) {
        alert(data.message || "An unused 7-day invite already exists. It was shown when created.");
        return;
      }

      const shareKey = await generateCaShareKey();
      await uploadEncryptedShare(shareKey);

      const base = String(data.redeem_url || "https://argusinvoicing.com/ca/redeem/").replace(/\?.*$/, "").replace(/#.*$/, "");
      const rawToken = String(data.token || "");
      const redeemUrl = rawToken
        ? `${base}#token=${encodeURIComponent(rawToken)}&key=${encodeURIComponent(shareKey)}`
        : `${base}#key=${encodeURIComponent(shareKey)}`;
      const next = {
        redeem_url: redeemUrl,
        backup_code: String(data.backup_code || ""),
        expires_at: String(data.expires_at || ""),
        share_key: shareKey,
      };
      sessionStorage.setItem(CA_INVITE_KEY, JSON.stringify(next));
      // Clear any old durable copy from earlier builds.
      try {
        localStorage.removeItem("argus_ca_invite");
      } catch {
        /* ignore */
      }
      setCaInvite(next);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setCaBusy(false);
    }
  }

  async function handleRefreshCaBooks() {
    if (!token) {
      alert("Sign in first");
      return;
    }
    setCaBusy(true);
    try {
      const stored = loadStoredCaInvite();
      const shareKey =
        (stored as { share_key?: string } | null)?.share_key || (await generateCaShareKey());
      await uploadEncryptedShare(shareKey);
      if (stored) {
        const next = { ...stored, share_key: shareKey };
        sessionStorage.setItem(CA_INVITE_KEY, JSON.stringify(next));
        setCaInvite(next);
      }
      alert("Encrypted books refreshed for your CA portal.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setCaBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-card border border-bone bg-white p-6">
        <h2 className="mb-2 text-lg font-semibold text-ink">Invite CA</h2>
        <p className="mb-4 text-sm text-slate">
          Generate a 7-day link. Your CA signs in, redeems once, and gets a free read-only portal.
          Books are encrypted before upload — the invite fragment holds the key (never stored as
          plaintext on Argus servers). The link is shown for this browser session only — copy it now.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={caBusy} onClick={() => handleInviteCa(!!caInvite)}>
            {caBusy ? "Working…" : caInvite ? "Create new 7-day link" : "Invite CA"}
          </button>
          <button className="btn-outline" disabled={caBusy} onClick={handleRefreshCaBooks}>
            Refresh CA books
          </button>
        </div>
        {caInvite ? (
          <div className="mt-4 space-y-2 text-sm text-slate">
            {caInvite.expires_at ? <p>Valid until {new Date(caInvite.expires_at).toLocaleString()}</p> : null}
            <p className="break-all rounded-card bg-mist p-3 text-xs text-ink">{caInvite.redeem_url}</p>
            <p>Backup code: <span className="font-mono text-ink">{caInvite.backup_code}</span></p>
            <button
              className="btn-outline"
              onClick={() => {
                navigator.clipboard.writeText(`${caInvite.redeem_url}\nBackup: ${caInvite.backup_code}`);
                alert("Copied. Send privately to your CA — closing this tab clears the session copy.");
              }}
            >
              Copy link + code
            </button>
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl text-ink">Settings</h1>
        <button onClick={handleSave} className="btn-primary">
          <Save className="mr-1 h-4 w-4" /> {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>

      <div className="rounded-card border border-bone bg-white p-6">
        <h2 className="mb-4 text-lg text-ink">Invoice Defaults</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-slate">
            Invoice Prefix
            <input
              type="text"
              value={settings.invoicePrefix}
              onChange={(e) => update("invoicePrefix", e.target.value)}
              className="mt-1 w-full rounded-btn border border-bone bg-mist px-4 py-2.5 text-ink outline-none focus:border-brand-violet"
            />
          </label>
          <label className="block text-sm text-slate">
            Invoice Suffix
            <input
              type="text"
              value={settings.invoiceSuffix}
              onChange={(e) => update("invoiceSuffix", e.target.value)}
              className="mt-1 w-full rounded-btn border border-bone bg-mist px-4 py-2.5 text-ink outline-none focus:border-brand-violet"
            />
          </label>
          <label className="block text-sm text-slate">
            Default GST Rate
            <select
              value={settings.defaultGstRate}
              onChange={(e) => update("defaultGstRate", parseFloat(e.target.value) as GSTRate)}
              className="mt-1 w-full rounded-btn border border-bone bg-mist px-4 py-2.5 text-ink outline-none focus:border-brand-violet"
            >
              {gstRatePickerOptions(settings.defaultGstRate).map((r) => <option key={r} value={r}>{gstRateLabel(r)}</option>)}
            </select>
          </label>
          <label className="block text-sm text-slate">
            Default Payment Terms (days)
            <input
              type="text"
              value={settings.defaultPaymentTerms}
              onChange={(e) => update("defaultPaymentTerms", e.target.value)}
              className="mt-1 w-full rounded-btn border border-bone bg-mist px-4 py-2.5 text-ink outline-none focus:border-brand-violet"
            />
          </label>
          <label className="block text-sm text-slate sm:col-span-2">
            Default Notes
            <textarea
              value={settings.defaultNotes}
              onChange={(e) => update("defaultNotes", e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-btn border border-bone bg-mist px-4 py-2.5 text-ink outline-none focus:border-brand-violet"
            />
          </label>
          <label className="block text-sm text-slate sm:col-span-2">
            Default Terms & Conditions
            <textarea
              value={settings.defaultTerms}
              onChange={(e) => update("defaultTerms", e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-btn border border-bone bg-mist px-4 py-2.5 text-ink outline-none focus:border-brand-violet"
            />
          </label>
          <label className="flex items-center gap-3 text-sm text-slate sm:col-span-2">
            <input
              type="checkbox"
              checked={settings.roundOff}
              onChange={(e) => update("roundOff", e.target.checked)}
              className="h-4 w-4 rounded border-bone"
            />
            Enable round-off on invoice totals
          </label>
          <label className="flex items-center gap-3 text-sm text-slate sm:col-span-2">
            <input
              type="checkbox"
              checked={Boolean(settings.askArgusIncludeParties)}
              onChange={(e) => update("askArgusIncludeParties", e.target.checked)}
              className="h-4 w-4 rounded border-bone"
            />
            Include top party names when I tap Ask Argus (cloud AI)
          </label>
        </div>
      </div>

      {canSync && (
        <div className="rounded-card border border-bone bg-white p-6">
          <h2 className="mb-1 text-lg text-ink">Cloud Sync</h2>
          <p className="mb-4 text-sm text-slate">
            Sync your invoices, businesses, and inventory across all your devices.
            Data is securely stored in Firebase and tied to your account.
          </p>
          <div className="mb-4 flex items-center gap-2 rounded-card bg-mist p-3 text-sm text-slate">
            <Cloud className="h-4 w-4 text-emerald-500" />
            {lastSync
              ? `Last synced: ${new Date(lastSync).toLocaleString()}`
              : "Not synced yet"}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleSyncFromCloud}
              disabled={syncing}
              className="btn-secondary flex-1 !py-2 disabled:opacity-50"
            >
              <RefreshCw className={`mr-1 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              Sync From Cloud
            </button>
            <button
              onClick={handleSyncToCloud}
              disabled={syncing}
              className="btn-primary flex-1 !py-2 disabled:opacity-50"
            >
              <Cloud className="mr-1 h-4 w-4" />
              Upload To Cloud
            </button>
          </div>
        </div>
      )}

      <div className="rounded-card border border-bone bg-white p-6">
        <h2 className="mb-4 text-lg text-ink">Local storage & backup</h2>
        <p className="mb-4 text-sm text-slate">
          Books are always saved in this browser (IndexedDB). On Chrome or Edge you can also
          attach a folder for <code className="text-ink">argus-books.json</code>. Firefox
          and Safari block folder access — use Export / Import (or cloud sync) as your portable backup.
        </p>
        <div className="space-y-4">
          {isFileSystemSupported() ? (
            <div className="flex flex-col gap-3 rounded-card bg-mist p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-ink">Working folder</p>
                <p className="text-xs text-slate">
                  {isUsingFileSystem()
                    ? `Connected: ${getFolderName()}`
                    : "No folder selected yet"}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={handlePickFolder} className="btn-secondary !py-2">
                  <FolderOpen className="mr-1 h-4 w-4" /> {isUsingFileSystem() ? "Change Folder" : "Select Folder"}
                </button>
                {isUsingFileSystem() ? (
                  <button onClick={handleDisconnectFolder} className="btn-outline !py-2">
                    Disconnect
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="rounded-card bg-mist p-4 text-sm text-slate">
              Folder attach is not available in this browser. Export a JSON backup below and store
              it wherever you like (Desktop, Drive, USB). Import it later to restore.
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleExport} className="btn-secondary flex-1 !py-2">
              <Download className="mr-1 h-4 w-4" /> Export Data
            </button>
            <label className="btn-secondary flex-1 cursor-pointer !py-2 text-center">
              <Upload className="mr-1 inline h-4 w-4" /> Import Data
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

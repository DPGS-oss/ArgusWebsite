"use client";

import { useState, type ChangeEvent } from "react";
import { Settings as SettingsIcon, Download, Upload, FolderOpen, Save } from "lucide-react";
import type { AppData, AppSettings, GSTRate } from "@/lib/types";
import { saveSettings, exportAllData, importAllData, pickFolder, isUsingFileSystem, getFolderName } from "@/lib/storage";

type SettingsProps = {
  data: AppData;
  onSaved: () => void;
};

const GST_RATES: GSTRate[] = [0, 3, 5, 12, 18, 28];

export function Settings({ data, onSaved }: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings>({ ...data.settings });
  const [saved, setSaved] = useState(false);

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
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl text-starlight">Settings</h1>
        <button onClick={handleSave} className="btn-primary">
          <Save className="mr-1 h-4 w-4" /> {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>

      <div className="rounded-lg border border-lead/20 bg-midnight p-6">
        <h2 className="mb-4 text-lg text-starlight">Invoice Defaults</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-silver">
            Invoice Prefix
            <input
              type="text"
              value={settings.invoicePrefix}
              onChange={(e) => update("invoicePrefix", e.target.value)}
              className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-starlight outline-none focus:border-mercury-blue"
            />
          </label>
          <label className="block text-sm text-silver">
            Invoice Suffix
            <input
              type="text"
              value={settings.invoiceSuffix}
              onChange={(e) => update("invoiceSuffix", e.target.value)}
              className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-starlight outline-none focus:border-mercury-blue"
            />
          </label>
          <label className="block text-sm text-silver">
            Default GST Rate
            <select
              value={settings.defaultGstRate}
              onChange={(e) => update("defaultGstRate", parseFloat(e.target.value) as GSTRate)}
              className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-starlight outline-none focus:border-mercury-blue"
            >
              {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
            </select>
          </label>
          <label className="block text-sm text-silver">
            Default Payment Terms (days)
            <input
              type="text"
              value={settings.defaultPaymentTerms}
              onChange={(e) => update("defaultPaymentTerms", e.target.value)}
              className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-starlight outline-none focus:border-mercury-blue"
            />
          </label>
          <label className="block text-sm text-silver sm:col-span-2">
            Default Notes
            <textarea
              value={settings.defaultNotes}
              onChange={(e) => update("defaultNotes", e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-starlight outline-none focus:border-mercury-blue"
            />
          </label>
          <label className="block text-sm text-silver sm:col-span-2">
            Default Terms & Conditions
            <textarea
              value={settings.defaultTerms}
              onChange={(e) => update("defaultTerms", e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-starlight outline-none focus:border-mercury-blue"
            />
          </label>
          <label className="flex items-center gap-3 text-sm text-silver sm:col-span-2">
            <input
              type="checkbox"
              checked={settings.roundOff}
              onChange={(e) => update("roundOff", e.target.checked)}
              className="h-4 w-4 rounded border-lead/30"
            />
            Enable round-off on invoice totals
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-lead/20 bg-midnight p-6">
        <h2 className="mb-4 text-lg text-starlight">Storage & Folder</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-graphite p-4">
            <div>
              <p className="text-sm text-starlight">Invoice Folder</p>
              <p className="text-xs text-silver">
                {isUsingFileSystem() ? `Connected: ${getFolderName()}` : "No folder selected"}
              </p>
            </div>
            <button onClick={handlePickFolder} className="btn-secondary !py-2">
              <FolderOpen className="mr-1 h-4 w-4" /> Select Folder
            </button>
          </div>

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

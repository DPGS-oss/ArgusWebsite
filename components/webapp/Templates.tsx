"use client";

import { useState } from "react";
import { Plus, Trash2, LayoutTemplate } from "lucide-react";
import type { AppData, Template } from "@/lib/types";
import { saveTemplate, deleteTemplate, generateId } from "@/lib/storage";

type Props = {
  data: AppData;
  onSaved: () => void;
};

export function Templates({ data, onSaved }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [customerName, setCustomerName] = useState("");

  const templates = data.templates ?? [];

  function handleSave() {
    if (!name.trim()) return;
    const t: Template = {
      id: generateId(),
      name: name.trim(),
      customerName: customerName.trim(),
      items: [],
      usageCount: 0,
    };
    saveTemplate(t);
    onSaved();
    setShowForm(false);
    setName("");
    setCustomerName("");
  }

  function handleDelete(id: string) {
    if (confirm("Delete this template?")) {
      deleteTemplate(id);
      onSaved();
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Templates</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Template
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl border border-bone bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">New Template</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate">Template Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="e.g. Monthly Service Invoice" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate">Default Customer</label>
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input-field" placeholder="Optional" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} className="btn-primary">Save</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-bone py-16 text-center">
          <LayoutTemplate className="mb-3 h-10 w-10 text-ash" />
          <p className="text-slate">No templates yet. Create one to speed up invoice creation.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-xl border border-bone bg-white p-4">
              <div>
                <div className="font-semibold text-ink">{t.name}</div>
                <div className="text-sm text-slate">{t.customerName || "Any customer"} · {t.items.length} items</div>
                <div className="text-xs text-ash">Used {t.usageCount} times</div>
              </div>
              <button onClick={() => handleDelete(t.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

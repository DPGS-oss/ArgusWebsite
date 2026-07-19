"use client";

import { useState } from "react";
import { Plus, Trash2, BookOpen } from "lucide-react";
import type { AppData, KhataEntry } from "@/lib/types";
import { saveKhataEntry, deleteKhataEntry, generateId } from "@/lib/storage";

type Props = {
  data: AppData;
  onSaved: () => void;
};

export function Khata({ data, onSaved }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [isCredit, setIsCredit] = useState(false);

  const entries = data.khataEntries ?? [];
  const customers = data.parties.filter((p) => p.type === "customer" || true);

  function handleSave() {
    if (!customerId || amount <= 0) return;
    const customer = data.parties.find((p) => p.id === customerId);
    const entry: KhataEntry = {
      id: generateId(),
      customerId,
      customerName: customer?.name ?? "Unknown",
      amount,
      description: description.trim(),
      createdAt: new Date().toISOString(),
      isCredit,
    };
    saveKhataEntry(entry);
    onSaved();
    setShowForm(false);
    setCustomerId("");
    setAmount(0);
    setDescription("");
    setIsCredit(false);
  }

  function handleDelete(id: string) {
    if (confirm("Delete this entry?")) {
      deleteKhataEntry(id);
      onSaved();
    }
  }

  // Group entries by customer
  const byCustomer = new Map<string, { name: string; entries: KhataEntry[] }>();
  for (const e of entries) {
    const g = byCustomer.get(e.customerId) ?? { name: e.customerName, entries: [] };
    g.entries.push(e);
    byCustomer.set(e.customerId, g);
  }

  const totalCredit = entries.filter((e) => e.isCredit).reduce((s, e) => s + e.amount, 0);
  const totalDebit = entries.filter((e) => !e.isCredit).reduce((s, e) => s + e.amount, 0);
  const balance = totalDebit - totalCredit;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Khata (Ledger)</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Entry
        </button>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-bone bg-white p-4">
          <div className="text-xs text-ash">Total Debit (Given)</div>
          <div className="text-xl font-bold text-ink">₹{totalDebit.toFixed(2)}</div>
        </div>
        <div className="rounded-xl border border-bone bg-white p-4">
          <div className="text-xs text-ash">Total Credit (Received)</div>
          <div className="text-xl font-bold text-emerald-600">₹{totalCredit.toFixed(2)}</div>
        </div>
        <div className="rounded-xl border border-bone bg-white p-4">
          <div className="text-xs text-ash">Outstanding Balance</div>
          <div className={`text-xl font-bold ${balance >= 0 ? "text-red-600" : "text-emerald-600"}`}>₹{Math.abs(balance).toFixed(2)}</div>
        </div>
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl border border-bone bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">New Khata Entry</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate">Customer</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input-field">
                <option value="">Select customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate">Amount (₹)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} className="input-field" />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm text-slate">Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="input-field" placeholder="What is this for?" />
          </div>
          <div className="mt-4">
            <label className="flex items-center gap-2 text-sm text-slate">
              <input type="checkbox" checked={isCredit} onChange={(e) => setIsCredit(e.target.checked)} className="h-4 w-4" />
              This is a credit (money received from customer)
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} className="btn-primary">Save</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-bone py-16 text-center">
          <BookOpen className="mb-3 h-10 w-10 text-ash" />
          <p className="text-slate">No khata entries yet. Track credit/debit with customers here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(byCustomer.entries()).map(([cid, { name, entries: custEntries }]) => {
            const custBalance = custEntries.filter((e) => !e.isCredit).reduce((s, e) => s + e.amount, 0) - custEntries.filter((e) => e.isCredit).reduce((s, e) => s + e.amount, 0);
            return (
              <div key={cid} className="rounded-xl border border-bone bg-white">
                <div className="flex items-center justify-between border-b border-bone px-4 py-3">
                  <div className="font-semibold text-ink">{name}</div>
                  <div className={`text-sm font-medium ${custBalance >= 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {custBalance >= 0 ? "Receivable" : "Payable"}: ₹{Math.abs(custBalance).toFixed(2)}
                  </div>
                </div>
                <div className="divide-y divide-bone">
                  {custEntries.map((e) => (
                    <div key={e.id} className="flex items-center justify-between px-4 py-2">
                      <div>
                        <span className={`text-sm font-medium ${e.isCredit ? "text-emerald-600" : "text-red-600"}`}>
                          {e.isCredit ? "Credit" : "Debit"}
                        </span>
                        <span className="ml-2 text-sm text-slate">{e.description}</span>
                        <div className="text-xs text-ash">{new Date(e.createdAt).toLocaleDateString()}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-ink">₹{e.amount.toFixed(2)}</span>
                        <button onClick={() => handleDelete(e.id)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

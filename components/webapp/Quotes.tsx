"use client";

import { useState } from "react";
import { Plus, Trash2, FileSignature } from "lucide-react";
import type { AppData, Quote } from "@/lib/types";
import { saveQuote, deleteQuote, generateId } from "@/lib/storage";

type Props = {
  data: AppData;
  onSaved: () => void;
};

export function Quotes({ data, onSaved }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");

  const quotes = data.quotes ?? [];

  function handleSave() {
    if (!customerName.trim()) return;
    const now = new Date().toISOString();
    const q: Quote = {
      id: generateId(),
      quoteNumber: `QT-${Date.now()}`,
      customerName: customerName.trim(),
      items: [],
      subtotal: 0,
      totalGstAmount: 0,
      totalAmount: 0,
      status: "draft",
      validUntil: validUntil,
      notes: notes.trim(),
      createdAt: now,
      updatedAt: now,
    };
    saveQuote(q);
    onSaved();
    setShowForm(false);
    setCustomerName("");
    setValidUntil("");
    setNotes("");
  }

  function handleDelete(id: string) {
    if (confirm("Delete this quote?")) {
      deleteQuote(id);
      onSaved();
    }
  }

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    sent: "bg-blue-100 text-blue-700",
    accepted: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    expired: "bg-amber-100 text-amber-700",
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Quotes</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Quote
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl border border-bone bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">New Quote</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate">Customer Name</label>
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input-field" placeholder="Customer name" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate">Valid Until</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="input-field" />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm text-slate">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field" rows={2} placeholder="Optional notes" />
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} className="btn-primary">Save</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {quotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-bone py-16 text-center">
          <FileSignature className="mb-3 h-10 w-10 text-ash" />
          <p className="text-slate">No quotes yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map((q) => (
            <div key={q.id} className="flex items-center justify-between rounded-xl border border-bone bg-white p-4">
              <div>
                <div className="font-semibold text-ink">{q.quoteNumber}</div>
                <div className="text-sm text-slate">{q.customerName}</div>
                <div className="text-xs text-ash">{new Date(q.createdAt).toLocaleDateString()}{q.validUntil ? ` · Valid until ${new Date(q.validUntil).toLocaleDateString()}` : ""}</div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`rounded-full px-3 py-1 text-xs ${statusColors[q.status] ?? "bg-gray-100 text-gray-700"}`}>{q.status}</span>
                <div className="text-right">
                  <div className="font-semibold text-ink">₹{q.totalAmount.toFixed(2)}</div>
                </div>
                <button onClick={() => handleDelete(q.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

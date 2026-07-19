"use client";

import { useState } from "react";
import { Plus, Trash2, FileText } from "lucide-react";
import type { AppData, CreditNote, InvoiceItem } from "@/lib/types";
import { saveCreditNote, deleteCreditNote, generateId } from "@/lib/storage";

type Props = {
  data: AppData;
  onSaved: () => void;
};

const EXPENSE_CATEGORIES = ["Rent", "Utilities", "Salaries", "Office Supplies", "Travel", "Marketing", "Software", "Equipment", "Professional Fees", "Other"];

export function CreditNotes({ data, onSaved }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]);

  const creditNotes = data.creditNotes ?? [];

  function handleAdd() {
    setShowForm(true);
    setCustomerName("");
    setReason("");
    setNotes("");
    setItems([]);
  }

  function handleSave() {
    if (!customerName.trim()) return;
    const now = new Date().toISOString();
    const cn: CreditNote = {
      id: generateId(),
      creditNoteNumber: `CN-${Date.now()}`,
      customerName: customerName.trim(),
      reason: reason.trim(),
      items,
      subtotal: items.reduce((s, i) => s + i.taxableAmount, 0),
      totalGstAmount: items.reduce((s, i) => s + i.cgst + i.sgst + i.igst, 0),
      totalAmount: items.reduce((s, i) => s + i.total, 0),
      notes: notes.trim(),
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    saveCreditNote(cn);
    onSaved();
    setShowForm(false);
  }

  function handleDelete(id: string) {
    if (confirm("Delete this credit note?")) {
      deleteCreditNote(id);
      onSaved();
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Credit Notes</h1>
        <button onClick={handleAdd} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Credit Note
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl border border-bone bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">New Credit Note</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate">Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="input-field"
                placeholder="Customer name"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate">Reason</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input-field"
                placeholder="Return, adjustment, etc."
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm text-slate">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field"
              rows={2}
              placeholder="Optional notes"
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} className="btn-primary">Save</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {creditNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-bone py-16 text-center">
          <FileText className="mb-3 h-10 w-10 text-ash" />
          <p className="text-slate">No credit notes yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {creditNotes.map((cn) => (
            <div key={cn.id} className="flex items-center justify-between rounded-xl border border-bone bg-white p-4">
              <div>
                <div className="font-semibold text-ink">{cn.creditNoteNumber}</div>
                <div className="text-sm text-slate">{cn.customerName} · {cn.reason || "No reason"}</div>
                <div className="text-xs text-ash">{new Date(cn.createdAt).toLocaleDateString()}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-semibold text-ink">₹{cn.totalAmount.toFixed(2)}</div>
                  <div className="text-xs text-ash">{cn.status}</div>
                </div>
                <button onClick={() => handleDelete(cn.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50">
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

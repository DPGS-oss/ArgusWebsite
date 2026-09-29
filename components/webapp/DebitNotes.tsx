"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { formatCurrency } from "@/lib/gst";
import type { AppData, DebitNote } from "@/lib/types";
import { deleteDebitNote, generateId, saveDebitNote } from "@/lib/storage";

type Props = { data: AppData; onSaved: () => void };

export function DebitNotes({ data, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(0);
  const [gst, setGst] = useState(0);
  const [reason, setReason] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [error, setError] = useState("");
  const notes = data.debitNotes || [];

  function save() {
    if (!name.trim() || amount <= 0) {
      setError("Enter a customer and a total above zero.");
      return;
    }
    if (gst < 0 || gst > amount) {
      setError("GST amount must be between 0 and the total.");
      return;
    }
    setError("");
    const now = new Date().toISOString();
    const year = new Date().getFullYear();
    const prefix = `DN-${year}-`;
    // Next number after the highest used this year, so deleting a note never reuses a number.
    const n =
      notes.reduce((max, existing) => {
        if (!existing.debitNoteNumber.startsWith(prefix)) return max;
        const seq = parseInt(existing.debitNoteNumber.slice(prefix.length), 10);
        return Number.isFinite(seq) ? Math.max(max, seq) : max;
      }, 0) + 1;
    const note: DebitNote = {
      id: generateId(),
      debitNoteNumber: `${prefix}${String(n).padStart(3, "0")}`,
      invoiceId: invoiceId || undefined,
      customerName: name.trim(),
      reason: reason.trim(),
      subtotal: amount - gst,
      totalGstAmount: gst,
      totalAmount: amount,
      notes: "",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    saveDebitNote(note);
    onSaved();
    setOpen(false);
    setName("");
    setAmount(0);
    setGst(0);
    setReason("");
    setInvoiceId("");
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Debit notes</h1>
          <p className="text-sm text-slate">Use when you undercharged. Link the original bill for GSTR-1.</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> New debit note
        </button>
      </div>

      {open && (
        <div className="mb-6 rounded-2xl border border-bone bg-white p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-slate">Customer
              <input className="input-field mt-1" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="text-sm text-slate">Total including GST
              <input type="number" className="input-field mt-1" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} />
            </label>
            <label className="text-sm text-slate">GST amount
              <input type="number" className="input-field mt-1" value={gst} onChange={(e) => setGst(parseFloat(e.target.value) || 0)} />
            </label>
            <label className="text-sm text-slate">Reason
              <input className="input-field mt-1" value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <label className="text-sm text-slate sm:col-span-2">Original invoice
              <select className="input-field mt-1" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
                <option value="">Not linked</option>
                {data.invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>{inv.invoiceNumber}</option>
                ))}
              </select>
            </label>
          </div>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          <div className="mt-4 flex gap-2">
            <button className="btn-primary" onClick={save}>Save</button>
            <button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {notes.map((n) => (
          <div key={n.id} className="flex items-center justify-between rounded-xl border border-bone bg-white px-4 py-3">
            <div>
              <div className="font-medium text-ink">{n.debitNoteNumber}</div>
              <div className="text-sm text-slate">{n.customerName}{n.reason ? ` · ${n.reason}` : ""}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="font-semibold">{formatCurrency(n.totalAmount)}</div>
              <button className="text-sm text-ash" onClick={() => {
                if (!window.confirm(`Remove ${n.debitNoteNumber}?`)) return;
                deleteDebitNote(n.id);
                onSaved();
              }}>Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

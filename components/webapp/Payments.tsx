"use client";

import { useState } from "react";
import { Plus, Trash2, CreditCard } from "lucide-react";
import type { AppData, Payment } from "@/lib/types";
import { savePayment, deletePayment, generateId } from "@/lib/storage";

type Props = {
  data: AppData;
  onSaved: () => void;
};

const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Bank", "Cheque", "Other"];

export function Payments({ data, onSaved }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState("Cash");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");

  const payments = data.payments ?? [];

  function handleSave() {
    if (!invoiceId || amount <= 0) return;
    const p: Payment = {
      id: generateId(),
      invoiceId,
      amount,
      method,
      date,
      note: note.trim() || undefined,
    };
    savePayment(p);
    onSaved();
    setShowForm(false);
    setInvoiceId("");
    setAmount(0);
    setNote("");
  }

  function handleDelete(id: string) {
    if (confirm("Delete this payment record?")) {
      deletePayment(id);
      onSaved();
    }
  }

  const totalReceived = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Payments</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Record Payment
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-bone bg-white p-4">
          <div className="text-xs text-ash">Total Received</div>
          <div className="text-xl font-bold text-emerald-600">₹{totalReceived.toFixed(2)}</div>
        </div>
        <div className="rounded-xl border border-bone bg-white p-4">
          <div className="text-xs text-ash">Count</div>
          <div className="text-xl font-bold text-ink">{payments.length}</div>
        </div>
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl border border-bone bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">Record Payment</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate">Invoice</label>
              <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} className="input-field">
                <option value="">Select invoice...</option>
                {data.invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>{inv.invoiceNumber} — {inv.partyName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate">Amount (₹)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} className="input-field" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate">Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="input-field">
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm text-slate">Note</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="input-field" placeholder="Optional note" />
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} className="btn-primary">Save</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-bone py-16 text-center">
          <CreditCard className="mb-3 h-10 w-10 text-ash" />
          <p className="text-slate">No payments recorded yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-bone bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-bone bg-mist text-left text-xs uppercase text-ash">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const inv = data.invoices.find((i) => i.id === p.invoiceId);
                return (
                  <tr key={p.id} className="border-b border-bone last:border-0">
                    <td className="px-4 py-3 text-slate">{new Date(p.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-ink">{inv?.invoiceNumber ?? p.invoiceId}</td>
                    <td className="px-4 py-3 text-slate">{p.method}</td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-600">₹{p.amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate">{p.note ?? "—"}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(p.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

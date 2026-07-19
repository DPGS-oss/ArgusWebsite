"use client";

import { useState } from "react";
import { Plus, Trash2, Receipt } from "lucide-react";
import type { AppData, Expense } from "@/lib/types";
import { saveExpense, deleteExpense, generateId } from "@/lib/storage";

type Props = {
  data: AppData;
  onSaved: () => void;
};

const CATEGORIES = ["Rent", "Utilities", "Salaries", "Office Supplies", "Travel", "Marketing", "Software", "Equipment", "Professional Fees", "Other"];
const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Cheque", "Card", "Other"];

export function Expenses({ data, onSaved }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("Rent");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [vendor, setVendor] = useState("");
  const [gstAmount, setGstAmount] = useState(0);
  const [isGstClaimable, setIsGstClaimable] = useState(false);

  const expenses = data.expenses ?? [];

  function handleSave() {
    if (amount <= 0) return;
    const now = new Date().toISOString();
    const exp: Expense = {
      id: generateId(),
      category,
      description: description.trim(),
      amount,
      date,
      paymentMode,
      vendor: vendor.trim(),
      gstAmount,
      isGstClaimable,
      createdAt: now,
      updatedAt: now,
    };
    saveExpense(exp);
    onSaved();
    setShowForm(false);
    setDescription("");
    setAmount(0);
    setVendor("");
    setGstAmount(0);
    setIsGstClaimable(false);
  }

  function handleDelete(id: string) {
    if (confirm("Delete this expense?")) {
      deleteExpense(id);
      onSaved();
    }
  }

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalGstClaimable = expenses.filter((e) => e.isGstClaimable).reduce((s, e) => s + e.gstAmount, 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Expenses</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Expense
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-bone bg-white p-4">
          <div className="text-xs text-ash">Total Expenses</div>
          <div className="text-xl font-bold text-ink">₹{totalExpenses.toFixed(2)}</div>
        </div>
        <div className="rounded-xl border border-bone bg-white p-4">
          <div className="text-xs text-ash">GST Claimable</div>
          <div className="text-xl font-bold text-emerald-600">₹{totalGstClaimable.toFixed(2)}</div>
        </div>
        <div className="rounded-xl border border-bone bg-white p-4">
          <div className="text-xs text-ash">Count</div>
          <div className="text-xl font-bold text-ink">{expenses.length}</div>
        </div>
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl border border-bone bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">New Expense</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate">Amount (₹)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} className="input-field" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate">Payment Mode</label>
              <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="input-field">
                {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate">Vendor</label>
              <input type="text" value={vendor} onChange={(e) => setVendor(e.target.value)} className="input-field" placeholder="Vendor name" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate">GST Amount (₹)</label>
              <input type="number" value={gstAmount} onChange={(e) => setGstAmount(parseFloat(e.target.value) || 0)} className="input-field" />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm text-slate">Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="input-field" placeholder="Optional description" />
          </div>
          <div className="mt-4">
            <label className="flex items-center gap-2 text-sm text-slate">
              <input type="checkbox" checked={isGstClaimable} onChange={(e) => setIsGstClaimable(e.target.checked)} className="h-4 w-4" />
              GST is claimable (ITC)
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} className="btn-primary">Save</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-bone py-16 text-center">
          <Receipt className="mb-3 h-10 w-10 text-ash" />
          <p className="text-slate">No expenses recorded yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-bone bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-bone bg-mist text-left text-xs uppercase text-ash">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">GST</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp) => (
                <tr key={exp.id} className="border-b border-bone last:border-0">
                  <td className="px-4 py-3 text-slate">{new Date(exp.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-medium text-ink">{exp.category}</td>
                  <td className="px-4 py-3 text-slate">{exp.vendor || "—"}</td>
                  <td className="px-4 py-3 text-right font-medium text-ink">₹{exp.amount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-slate">{exp.isGstClaimable ? `₹${exp.gstAmount.toFixed(2)}` : "—"}</td>
                  <td className="px-4 py-3 text-slate">{exp.paymentMode}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(exp.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

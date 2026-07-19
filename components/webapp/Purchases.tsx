"use client";

import { useState } from "react";
import { Plus, Trash2, ShoppingCart } from "lucide-react";
import type { AppData, Purchase, InvoiceItem } from "@/lib/types";
import { savePurchase, deletePurchase, generateId } from "@/lib/storage";

type Props = {
  data: AppData;
  onSaved: () => void;
};

export function Purchases({ data, onSaved }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]);

  const purchases = data.purchases ?? [];

  function handleSave() {
    if (!supplierName.trim()) return;
    const now = new Date().toISOString();
    const p: Purchase = {
      id: generateId(),
      purchaseNumber: `PUR-${Date.now()}`,
      supplierName: supplierName.trim(),
      createdAt: now,
      totalAmount: items.reduce((s, i) => s + i.total, 0),
      totalGstAmount: items.reduce((s, i) => s + i.cgst + i.sgst + i.igst, 0),
      items,
    };
    savePurchase(p);
    onSaved();
    setShowForm(false);
    setSupplierName("");
    setItems([]);
  }

  function handleDelete(id: string) {
    if (confirm("Delete this purchase record?")) {
      deletePurchase(id);
      onSaved();
    }
  }

  const totalPurchases = purchases.reduce((s, p) => s + p.totalAmount, 0);
  const totalGstPaid = purchases.reduce((s, p) => s + p.totalGstAmount, 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Purchases</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Purchase
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-bone bg-white p-4">
          <div className="text-xs text-ash">Total Purchases</div>
          <div className="text-xl font-bold text-ink">₹{totalPurchases.toFixed(2)}</div>
        </div>
        <div className="rounded-xl border border-bone bg-white p-4">
          <div className="text-xs text-ash">GST Paid (ITC)</div>
          <div className="text-xl font-bold text-emerald-600">₹{totalGstPaid.toFixed(2)}</div>
        </div>
        <div className="rounded-xl border border-bone bg-white p-4">
          <div className="text-xs text-ash">Count</div>
          <div className="text-xl font-bold text-ink">{purchases.length}</div>
        </div>
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl border border-bone bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">New Purchase</h2>
          <div>
            <label className="mb-1 block text-sm text-slate">Supplier Name</label>
            <input type="text" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="input-field" placeholder="Supplier name" />
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} className="btn-primary">Save</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {purchases.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-bone py-16 text-center">
          <ShoppingCart className="mb-3 h-10 w-10 text-ash" />
          <p className="text-slate">No purchases recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {purchases.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-bone bg-white p-4">
              <div>
                <div className="font-semibold text-ink">{p.purchaseNumber}</div>
                <div className="text-sm text-slate">{p.supplierName} · {p.items.length} items</div>
                <div className="text-xs text-ash">{new Date(p.createdAt).toLocaleDateString()}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-semibold text-ink">₹{p.totalAmount.toFixed(2)}</div>
                  <div className="text-xs text-ash">GST: ₹{p.totalGstAmount.toFixed(2)}</div>
                </div>
                <button onClick={() => handleDelete(p.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50">
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

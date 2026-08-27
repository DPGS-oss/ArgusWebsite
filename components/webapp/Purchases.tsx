"use client";

import { useState } from "react";
import { Plus, Trash2, ShoppingCart } from "lucide-react";
import type { AppData, GSTRate, InvoiceItem, Purchase } from "@/lib/types";
import { savePurchase, deletePurchase, generateId, loadData } from "@/lib/storage";
import { persistLedger, postPurchaseLedger } from "@/lib/books";
import { round2 } from "@/lib/gst";

type Props = {
  data: AppData;
  onSaved: () => void;
};

const GST_RATES: GSTRate[] = [0, 3, 5, 12, 18, 28];
const PAYMENT_METHODS = ["Cash", "UPI", "Bank Transfer", "Cheque", "Card", "Credit"];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function splitInclusive(total: number, gstRate: GSTRate) {
  const taxable = round2(total / (1 + gstRate / 100));
  const gst = round2(total - taxable);
  return { taxable, gst, total: round2(total) };
}

export function Purchases({ data, onSaved }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [gstRate, setGstRate] = useState<GSTRate>(data.settings.defaultGstRate || 18);
  const [date, setDate] = useState(todayIso());
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paidAmount, setPaidAmount] = useState(0);
  const [paidTouched, setPaidTouched] = useState(false);

  const purchases = data.purchases ?? [];
  const suppliers = data.parties.filter((p) => p.type === "supplier");

  function resetForm() {
    setShowForm(false);
    setSupplierName("");
    setDescription("");
    setAmount(0);
    setGstRate(data.settings.defaultGstRate || 18);
    setDate(todayIso());
    setPaymentMethod("Cash");
    setPaidAmount(0);
    setPaidTouched(false);
  }

  function handleSave() {
    if (!supplierName.trim()) {
      alert("Enter a supplier name.");
      return;
    }
    if (amount <= 0) {
      alert("Enter a purchase amount.");
      return;
    }
    const split = splitInclusive(amount, gstRate);
    const isCredit = paymentMethod === "Credit";
    const paid = isCredit ? 0 : paidTouched ? Math.min(paidAmount, amount) : amount;
    const now = new Date().toISOString();
    const item: InvoiceItem = {
      id: generateId(),
      description: description.trim() || "Purchase",
      hsn: "",
      quantity: 1,
      unit: "NOS",
      rate: split.taxable,
      discount: 0,
      gstRate,
      taxableAmount: split.taxable,
      cgst: round2(split.gst / 2),
      sgst: round2(split.gst / 2),
      igst: 0,
      total: split.total,
    };
    const supplier = data.parties.find((p) => p.name.toLowerCase() === supplierName.trim().toLowerCase());
    const p: Purchase = {
      id: generateId(),
      purchaseNumber: `PUR-${Date.now()}`,
      supplierName: supplierName.trim(),
      supplierId: supplier?.id,
      supplierGstin: supplier?.gstin,
      createdAt: date ? `${date}T00:00:00.000Z` : now,
      totalAmount: split.total,
      totalGstAmount: split.gst,
      items: [item],
      paymentMethod,
      paidAmount: paid,
    };
    savePurchase(p);
    persistLedger(postPurchaseLedger(loadData(), p));
    onSaved();
    resetForm();
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate">Supplier Name</label>
              <input
                list="purchase-suppliers"
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="input-field"
                placeholder="Supplier name"
              />
              <datalist id="purchase-suppliers">
                {suppliers.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate">Amount (₹, incl. GST)</label>
              <input
                type="number"
                min={0}
                value={amount || ""}
                onChange={(e) => {
                  const next = parseFloat(e.target.value) || 0;
                  setAmount(next);
                  if (!paidTouched && paymentMethod !== "Credit") setPaidAmount(next);
                }}
                className="input-field"
                placeholder="0"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-slate">What did you buy?</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field"
                placeholder="Stock, goods, materials…"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate">GST %</label>
              <select
                value={gstRate}
                onChange={(e) => setGstRate(Number(e.target.value) as GSTRate)}
                className="input-field"
              >
                {GST_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r}%
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate">Payment</label>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  const next = e.target.value;
                  setPaymentMethod(next);
                  if (next === "Credit") {
                    setPaidAmount(0);
                    setPaidTouched(true);
                  } else if (!paidTouched) {
                    setPaidAmount(amount);
                  }
                }}
                className="input-field"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            {paymentMethod !== "Credit" && (
              <div>
                <label className="mb-1 block text-sm text-slate">Paid now (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={paidAmount || ""}
                  onChange={(e) => {
                    setPaidTouched(true);
                    setPaidAmount(parseFloat(e.target.value) || 0);
                  }}
                  className="input-field"
                />
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} className="btn-primary">
              Save
            </button>
            <button onClick={resetForm} className="btn-secondary">
              Cancel
            </button>
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
                <div className="font-semibold text-ink">{p.supplierName}</div>
                <div className="text-sm text-slate">
                  {p.purchaseNumber}
                  {p.items[0]?.description ? ` · ${p.items[0].description}` : ""}
                </div>
                <div className="text-xs text-ash">
                  {new Date(p.createdAt).toLocaleDateString()}
                  {p.paymentMethod ? ` · ${p.paymentMethod}` : ""}
                </div>
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

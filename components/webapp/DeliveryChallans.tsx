"use client";

import { useState } from "react";
import { Plus, Trash2, Truck } from "lucide-react";
import type { AppData, DeliveryChallan, ChallanItem } from "@/lib/types";
import { saveDeliveryChallan, deleteDeliveryChallan, generateId } from "@/lib/storage";

type Props = {
  data: AppData;
  onSaved: () => void;
};

export function DeliveryChallans({ data, onSaved }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [transportMode, setTransportMode] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ChallanItem[]>([{ name: "", hsnCode: "", quantity: 1, unit: "PCS" }]);

  const challans = data.deliveryChallans ?? [];

  function updateItem(idx: number, field: keyof ChallanItem, value: string | number) {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: value };
    setItems(next);
  }

  function addItem() {
    setItems([...items, { name: "", hsnCode: "", quantity: 1, unit: "PCS" }]);
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  function handleSave() {
    if (!customerName.trim()) return;
    const now = new Date().toISOString();
    const dc: DeliveryChallan = {
      id: generateId(),
      challanNumber: `DC-${Date.now()}`,
      customerName: customerName.trim(),
      items: items.filter((i) => i.name.trim()),
      transportMode: transportMode.trim(),
      vehicleNumber: vehicleNumber.trim(),
      deliveryAddress: deliveryAddress.trim(),
      notes: notes.trim(),
      status: "open",
      createdAt: now,
      updatedAt: now,
    };
    saveDeliveryChallan(dc);
    onSaved();
    setShowForm(false);
    setCustomerName("");
    setTransportMode("");
    setVehicleNumber("");
    setDeliveryAddress("");
    setNotes("");
    setItems([{ name: "", hsnCode: "", quantity: 1, unit: "PCS" }]);
  }

  function handleDelete(id: string) {
    if (confirm("Delete this delivery challan?")) {
      deleteDeliveryChallan(id);
      onSaved();
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Delivery Challans</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Challan
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl border border-bone bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">New Delivery Challan</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate">Customer Name</label>
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input-field" placeholder="Customer name" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate">Transport Mode</label>
              <input type="text" value={transportMode} onChange={(e) => setTransportMode(e.target.value)} className="input-field" placeholder="Road, Rail, Air..." />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate">Vehicle Number</label>
              <input type="text" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} className="input-field" placeholder="DL01AB1234" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate">Delivery Address</label>
              <input type="text" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className="input-field" placeholder="Delivery address" />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-sm text-slate">Items</label>
            {items.map((item, idx) => (
              <div key={idx} className="mb-2 flex gap-2">
                <input type="text" value={item.name} onChange={(e) => updateItem(idx, "name", e.target.value)} className="input-field flex-1" placeholder="Item name" />
                <input type="text" value={item.hsnCode} onChange={(e) => updateItem(idx, "hsnCode", e.target.value)} className="input-field w-24" placeholder="HSN" />
                <input type="number" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)} className="input-field w-24" placeholder="Qty" />
                <input type="text" value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)} className="input-field w-20" placeholder="Unit" />
                <button onClick={() => removeItem(idx)} className="rounded-lg p-2 text-red-500 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button onClick={addItem} className="text-sm text-signal-blue hover:underline">+ Add item</button>
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

      {challans.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-bone py-16 text-center">
          <Truck className="mb-3 h-10 w-10 text-ash" />
          <p className="text-slate">No delivery challans yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {challans.map((dc) => (
            <div key={dc.id} className="flex items-center justify-between rounded-xl border border-bone bg-white p-4">
              <div>
                <div className="font-semibold text-ink">{dc.challanNumber}</div>
                <div className="text-sm text-slate">{dc.customerName} · {dc.items.length} items</div>
                <div className="text-xs text-ash">{new Date(dc.createdAt).toLocaleDateString()} · {dc.transportMode || "N/A"}</div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`rounded-full px-3 py-1 text-xs ${dc.status === "open" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                  {dc.status}
                </span>
                <button onClick={() => handleDelete(dc.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50">
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

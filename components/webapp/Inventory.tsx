"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Upload, Barcode as BarcodeIcon, X, Edit } from "lucide-react";
import type { AppData, StockItem, GSTRate } from "@/lib/types";
import { UNITS } from "@/lib/types";
import { formatCurrency } from "@/lib/gst";
import { saveStockItem, deleteStockItem, bulkSaveStockItems, generateId } from "@/lib/storage";
import JsBarcode from "jsbarcode";

const GST_RATES: GSTRate[] = [0, 3, 5, 12, 18, 28];

type InventoryProps = {
  data: AppData;
  onSaved: () => void;
};

function emptyStockItem(): StockItem {
  return {
    id: generateId(),
    name: "",
    hsn: "",
    unit: "NOS",
    openingStock: 0,
    currentStock: 0,
    minStock: 0,
    rate: 0,
    gstRate: 18,
    barcode: "",
  };
}

export function Inventory({ data, onSaved }: InventoryProps) {
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showBarcode, setShowBarcode] = useState<StockItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    setEditing(emptyStockItem());
    setShowForm(true);
  }

  function handleEdit(item: StockItem) {
    setEditing({ ...item });
    setShowForm(true);
  }

  function handleSave() {
    if (!editing) return;
    if (!editing.name) {
      alert("Please enter a name.");
      return;
    }
    saveStockItem(editing);
    setEditing(null);
    setShowForm(false);
    onSaved();
  }

  function handleDelete(id: string) {
    if (confirm("Delete this inventory item?")) {
      deleteStockItem(id);
      onSaved();
    }
  }

  function handleXMLImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "text/xml");
        const items = doc.querySelectorAll("item, Item, product, Product");

        if (items.length === 0) {
          alert("No items found in XML. Expected <item> or <product> elements.");
          return;
        }

        const stockItems: StockItem[] = [];
        items.forEach((node) => {
          const get = (tag: string) => node.querySelector(tag)?.textContent?.trim() || "";
          const name = get("name") || get("Name") || get("title") || get("Title");
          if (!name) return;

          stockItems.push({
            id: generateId(),
            name,
            hsn: get("hsn") || get("HSN") || get("hsnCode") || "",
            unit: get("unit") || get("Unit") || "NOS",
            openingStock: parseFloat(get("openingStock") || get("stock") || get("quantity") || "0") || 0,
            currentStock: parseFloat(get("currentStock") || get("stock") || get("quantity") || "0") || 0,
            minStock: parseFloat(get("minStock") || get("minStockLevel") || "0") || 0,
            rate: parseFloat(get("rate") || get("price") || get("rate") || "0") || 0,
            gstRate: (parseFloat(get("gstRate") || get("gst") || "18") as GSTRate) || 18,
            barcode: get("barcode") || get("Barcode") || get("sku") || get("SKU") || "",
          });
        });

        if (stockItems.length === 0) {
          alert("No valid items found in XML.");
          return;
        }

        bulkSaveStockItems(stockItems);
        alert(`Imported ${stockItems.length} items from XML.`);
        onSaved();
      } catch {
        alert("Failed to parse XML file.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl text-starlight">Inventory</h1>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml,text/xml"
            onChange={handleXMLImport}
            className="hidden"
          />
          <button onClick={() => fileInputRef.current?.click()} className="btn-secondary">
            <Upload className="mr-1 h-4 w-4" /> Import XML
          </button>
          <button onClick={handleAdd} className="btn-primary">
            <Plus className="mr-1 h-4 w-4" /> Add Item
          </button>
        </div>
      </div>

      {data.stock.length === 0 ? (
        <div className="rounded-lg border border-lead/20 bg-midnight p-8 text-center">
          <p className="text-silver">No inventory items yet. Add items manually or import from XML.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-lead/20 bg-midnight">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-lead/20 text-silver">
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">HSN</th>
                <th className="p-3 text-right">Stock</th>
                <th className="p-3 text-right">Min</th>
                <th className="p-3 text-right">Rate</th>
                <th className="p-3 text-center">GST</th>
                <th className="p-3 text-center">Barcode</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.stock.map((item) => (
                <tr key={item.id} className="border-b border-lead/10 text-starlight">
                  <td className="p-3">{item.name}</td>
                  <td className="p-3 text-silver">{item.hsn || "—"}</td>
                  <td className="p-3 text-right">
                    <span className={item.currentStock <= item.minStock ? "text-red-400" : ""}>
                      {item.currentStock} {item.unit}
                    </span>
                  </td>
                  <td className="p-3 text-right text-silver">{item.minStock}</td>
                  <td className="p-3 text-right">{formatCurrency(item.rate)}</td>
                  <td className="p-3 text-center text-silver">{item.gstRate}%</td>
                  <td className="p-3 text-center">
                    {item.barcode ? (
                      <button
                        onClick={() => setShowBarcode(item)}
                        className="text-mercury-blue hover:underline"
                      >
                        <BarcodeIcon className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="text-silver">—</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => handleEdit(item)} className="mr-2 rounded p-1 text-silver hover:text-starlight">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="rounded p-1 text-silver hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && editing && (
        <StockItemForm
          item={editing}
          onChange={setEditing}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {showBarcode && (
        <BarcodeDisplayModal item={showBarcode} onClose={() => setShowBarcode(null)} />
      )}
    </div>
  );
}

function StockItemForm({
  item,
  onChange,
  onSave,
  onCancel,
}: {
  item: StockItem;
  onChange: (item: StockItem) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  function update(patch: Partial<StockItem>) {
    onChange({ ...item, ...patch });
  }

  function generateBarcode() {
    const code = String(Date.now()).slice(-12);
    update({ barcode: code });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-lg rounded-lg bg-midnight p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg text-starlight">{item.name ? "Edit Item" : "New Item"}</h3>
          <button onClick={onCancel} className="rounded p-1 text-silver hover:text-starlight">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-silver sm:col-span-2">
            Name
            <input
              type="text"
              value={item.name}
              onChange={(e) => update({ name: e.target.value })}
              className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-sm text-starlight outline-none focus:border-mercury-blue"
            />
          </label>
          <label className="block text-sm text-silver">
            HSN Code
            <input
              type="text"
              value={item.hsn}
              onChange={(e) => update({ hsn: e.target.value })}
              className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-sm text-starlight outline-none focus:border-mercury-blue"
            />
          </label>
          <label className="block text-sm text-silver">
            Unit
            <select
              value={item.unit}
              onChange={(e) => update({ unit: e.target.value })}
              className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-sm text-starlight outline-none focus:border-mercury-blue"
            >
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label className="block text-sm text-silver">
            Opening Stock
            <input
              type="number"
              value={item.openingStock}
              onChange={(e) => update({ openingStock: parseFloat(e.target.value) || 0 })}
              className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-sm text-starlight outline-none focus:border-mercury-blue"
            />
          </label>
          <label className="block text-sm text-silver">
            Current Stock
            <input
              type="number"
              value={item.currentStock}
              onChange={(e) => update({ currentStock: parseFloat(e.target.value) || 0 })}
              className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-sm text-starlight outline-none focus:border-mercury-blue"
            />
          </label>
          <label className="block text-sm text-silver">
            Min Stock Level
            <input
              type="number"
              value={item.minStock}
              onChange={(e) => update({ minStock: parseFloat(e.target.value) || 0 })}
              className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-sm text-starlight outline-none focus:border-mercury-blue"
            />
          </label>
          <label className="block text-sm text-silver">
            Rate (₹)
            <input
              type="number"
              value={item.rate}
              onChange={(e) => update({ rate: parseFloat(e.target.value) || 0 })}
              className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-sm text-starlight outline-none focus:border-mercury-blue"
            />
          </label>
          <label className="block text-sm text-silver">
            GST Rate
            <select
              value={item.gstRate}
              onChange={(e) => update({ gstRate: parseFloat(e.target.value) as GSTRate })}
              className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-sm text-starlight outline-none focus:border-mercury-blue"
            >
              {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
            </select>
          </label>
          <label className="block text-sm text-silver sm:col-span-2">
            Barcode / SKU
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={item.barcode || ""}
                onChange={(e) => update({ barcode: e.target.value })}
                placeholder="Enter or generate barcode"
                className="flex-1 rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-sm text-starlight outline-none focus:border-mercury-blue"
              />
              <button onClick={generateBarcode} className="btn-secondary !py-2">
                <BarcodeIcon className="mr-1 h-4 w-4" /> Generate
              </button>
            </div>
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
          <button onClick={onSave} className="btn-primary">Save</button>
        </div>
      </div>
    </div>
  );
}

function BarcodeDisplayModal({ item, onClose }: { item: StockItem; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && item.barcode) {
      try {
        JsBarcode(canvasRef.current, item.barcode, {
          format: "CODE128",
          width: 2,
          height: 80,
          displayValue: true,
          fontSize: 14,
        });
      } catch {
        // barcode generation error
      }
    }
  }, [item.barcode]);

  function handleDownload() {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `barcode_${item.name.replace(/[^a-zA-Z0-9]/g, "_")}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="rounded-lg bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">{item.name}</h3>
          <button onClick={onClose} className="rounded p-1 text-gray-500 hover:text-gray-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col items-center">
          <canvas ref={canvasRef} className="mb-4" />
          <p className="mb-4 text-sm text-gray-600">Barcode: {item.barcode}</p>
          <button onClick={handleDownload} className="btn-primary">
            <BarcodeIcon className="mr-1 h-4 w-4" /> Download PNG
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { AppData, StockItem } from "@/lib/types";
import { loadData, saveData, saveStockMoves } from "@/lib/storage";
import {
  MAIN_GODOWN, expiring, godownQty, godowns, lots, movesFor, productionMoves, stockValuation, transferMoves, type StockMoveKind,
} from "@/lib/stock";
import { formatCurrency } from "@/lib/gst";
import { todayIST } from "@/lib/dates";
import { downloadCsv } from "@/lib/gst-returns";

export type StockTab = "in" | "move" | "adjust" | "make" | "ledger" | "batches" | "value";

export const STOCK_TABS: [StockTab, string][] = [
  ["in", "Stock in"],
  ["move", "Move between godowns"],
  ["adjust", "Adjust"],
  ["make", "Make items"],
  ["ledger", "Movements"],
  ["batches", "Batches & expiry"],
  ["value", "Stock value"],
];

const KIND: Record<StockMoveKind, string> = {
  opening: "Opening stock", purchase: "Stock in", sale: "Sold", sale_return: "Returned / bill cancelled",
  purchase_return: "Returned to supplier", transfer: "Moved", adjust: "Adjusted", produce: "Made", consume: "Used to make",
};

const field = "mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-3 py-2 text-sm text-starlight outline-none focus:border-mercury-blue";

type Props = { data: AppData; onSaved: () => void; tab: StockTab };

export function StockDepth({ data, onSaved, tab }: Props) {
  const [itemId, setItemId] = useState(data.stock[0]?.id || "");
  const item = data.stock.find((s) => s.id === itemId);
  const places = godowns(data);

  const picker = (
    <label className="block text-sm text-silver">
      Item
      <select className={field} value={itemId} onChange={(e) => setItemId(e.target.value)}>
        {data.stock.map((s) => (
          <option key={s.id} value={s.id}>{s.name} ({s.currentStock} {s.unit})</option>
        ))}
      </select>
    </label>
  );

  if (!data.stock.length) return <p className="text-sm text-silver">Add an item first.</p>;

  return (
    <div className="rounded-lg border border-lead/20 bg-midnight p-4">
      {tab === "in" && item && <StockIn data={data} item={item} places={places} picker={picker} onSaved={onSaved} />}
      {tab === "move" && item && <Move data={data} item={item} places={places} picker={picker} onSaved={onSaved} />}
      {tab === "adjust" && item && <Adjust data={data} item={item} places={places} picker={picker} onSaved={onSaved} />}
      {tab === "make" && <Make data={data} places={places} onSaved={onSaved} />}
      {tab === "ledger" && item && <Ledger data={data} item={item} picker={picker} />}
      {tab === "batches" && <Batches data={data} />}
      {tab === "value" && <Value data={data} />}
    </div>
  );
}

type FormProps = { data: AppData; item: StockItem; places: string[]; picker: React.ReactNode; onSaved: () => void };

function Godown({ value, onChange, places, label = "Godown" }: { value: string; onChange: (v: string) => void; places: string[]; label?: string }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  return (
    <label className="block text-sm text-silver">
      {label}
      {adding ? (
        <span className="mt-1 flex gap-2">
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Godown name" />
          <button
            className="btn-secondary !py-2"
            onClick={() => {
              const n = name.trim();
              if (!n) return;
              const latest = loadData();
              saveData({ ...latest, godowns: [...new Set([...(latest.godowns || []), n])] });
              onChange(n);
              setAdding(false);
            }}
          >
            Add
          </button>
        </span>
      ) : (
        <select className={field} value={value} onChange={(e) => (e.target.value === "+" ? setAdding(true) : onChange(e.target.value))}>
          {places.map((g) => <option key={g} value={g}>{g}</option>)}
          <option value="+">+ New godown…</option>
        </select>
      )}
    </label>
  );
}

function StockIn({ data, item, places, picker, onSaved }: FormProps) {
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState(String(item.costPrice || ""));
  const [godown, setGodown] = useState(MAIN_GODOWN);
  const [batch, setBatch] = useState("");
  const [expiry, setExpiry] = useState("");
  const [ref, setRef] = useState("");
  const [msg, setMsg] = useState("");
  function save() {
    const q = Number(qty);
    if (!(q > 0)) return setMsg("Enter how many came in.");
    if (item.trackBatches && !batch.trim()) return setMsg("This item tracks batches: enter the batch number.");
    // Goods on a purchase bill already entered: link to it, so its cost is counted once.
    const billNo = ref.trim().toLowerCase();
    const bill = billNo ? (data.purchases || []).find((p) => [p.supplierInvoiceNumber, p.purchaseNumber].some((n) => (n || "").trim().toLowerCase() === billNo)) : undefined;
    saveStockMoves(
      [{ itemId: item.id, date: todayIST(), kind: "purchase", qty: q, godown, batch: batch.trim() || undefined, expiry: expiry || undefined, unitCost: Number(cost) || item.costPrice || 0, ref: ref.trim() || undefined, refId: bill?.id }],
      { ref: item.name, detail: `${q} ${item.unit} in to ${godown}${batch ? `, batch ${batch}` : ""} at ₹${Number(cost) || 0} each` },
    );
    setQty(""); setBatch(""); setExpiry(""); setRef(""); setMsg("Saved.");
    onSaved();
  }
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="sm:col-span-3">{picker}</div>
      <label className="block text-sm text-silver">Quantity<input type="number" className={field} value={qty} onChange={(e) => setQty(e.target.value)} /></label>
      <label className="block text-sm text-silver">Cost per {item.unit} before GST (₹)<input type="number" className={field} value={cost} onChange={(e) => setCost(e.target.value)} /></label>
      <Godown value={godown} onChange={setGodown} places={places} />
      <label className="block text-sm text-silver">Batch{item.trackBatches ? "" : " (optional)"}<input className={field} value={batch} onChange={(e) => setBatch(e.target.value)} /></label>
      <label className="block text-sm text-silver">Expiry (optional)<input type="date" className={field} value={expiry} onChange={(e) => setExpiry(e.target.value)} /></label>
      <label className="block text-sm text-silver">Supplier bill no. (optional)<input className={field} value={ref} onChange={(e) => setRef(e.target.value)} /></label>
      <p className="text-xs text-ash sm:col-span-2">If these goods are on a purchase you entered under Purchases, type its bill number so the cost is counted once.</p>
      <div className="sm:col-span-3 flex items-center gap-3"><button className="btn-primary" onClick={save}>Add to stock</button><span className="text-sm text-silver">{msg}</span></div>
    </div>
  );
}

function Move({ data, item, places, picker, onSaved }: FormProps) {
  const [from, setFrom] = useState(MAIN_GODOWN);
  const [to, setTo] = useState(places.find((g) => g !== MAIN_GODOWN) || "");
  const [qty, setQty] = useState("");
  const [batch, setBatch] = useState("");
  const [msg, setMsg] = useState("");
  const batchesHere = lots(data, item.id).filter((l) => l.godown === from && l.qty > 0 && l.batch);
  function save() {
    const q = Number(qty);
    if (!(q > 0)) return setMsg("Enter how many to move.");
    if (!to || to === from) return setMsg("Pick a different godown to move to.");
    const have = batch ? lots(data, item.id).find((l) => l.godown === from && l.batch === batch)?.qty || 0 : godownQty(data, item.id, from);
    if (q > have) return setMsg(`Only ${have} ${item.unit} in ${from}${batch ? ` (batch ${batch})` : ""}.`);
    const exp = batch ? lots(data, item.id).find((l) => l.batch === batch)?.expiry : undefined;
    saveStockMoves(transferMoves(item.id, q, from, to, batch || undefined, exp), { ref: item.name, detail: `${q} ${item.unit} moved from ${from} to ${to}` });
    setQty(""); setMsg("Moved.");
    onSaved();
  }
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="sm:col-span-3">{picker}</div>
      <Godown value={from} onChange={setFrom} places={places} label="From" />
      <Godown value={to} onChange={setTo} places={places} label="To" />
      <label className="block text-sm text-silver">Quantity (here: {godownQty(data, item.id, from)})<input type="number" className={field} value={qty} onChange={(e) => setQty(e.target.value)} /></label>
      {batchesHere.length ? (
        <label className="block text-sm text-silver">Batch
          <select className={field} value={batch} onChange={(e) => setBatch(e.target.value)}>
            <option value="">Any</option>
            {batchesHere.map((l) => <option key={l.batch} value={l.batch}>{l.batch} ({l.qty}{l.expiry ? `, exp ${l.expiry}` : ""})</option>)}
          </select>
        </label>
      ) : null}
      <div className="sm:col-span-3 flex items-center gap-3"><button className="btn-primary" onClick={save}>Move</button><span className="text-sm text-silver">{msg}</span></div>
    </div>
  );
}

const REASONS = ["Damaged", "Expired", "Lost or stolen", "Used in the shop", "Free sample", "Counted again"];

function Adjust({ data, item, places, picker, onSaved }: FormProps) {
  const [godown, setGodown] = useState(MAIN_GODOWN);
  const [mode, setMode] = useState<"out" | "count">("out");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState(REASONS[0]);
  const [batch, setBatch] = useState("");
  const [msg, setMsg] = useState("");
  const here = godownQty(data, item.id, godown);
  const batchesHere = lots(data, item.id).filter((l) => l.godown === godown && l.qty > 0 && l.batch);
  function save() {
    const q = Number(qty);
    if (!(q >= 0) || qty === "") return setMsg("Enter a quantity.");
    const delta = mode === "out" ? -q : q - here;
    if (!delta) return setMsg("Nothing to change.");
    const exp = batch ? lots(data, item.id).find((l) => l.batch === batch)?.expiry : undefined;
    saveStockMoves(
      [{ itemId: item.id, date: todayIST(), kind: "adjust", qty: delta, godown, batch: batch || undefined, expiry: exp, note: mode === "out" ? reason : "Counted again" }],
      { ref: item.name, detail: `${delta > 0 ? "+" : ""}${delta} ${item.unit} in ${godown}: ${mode === "out" ? reason : "counted again"}` },
    );
    setQty(""); setMsg("Saved.");
    onSaved();
  }
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="sm:col-span-3">{picker}</div>
      <Godown value={godown} onChange={setGodown} places={places} />
      <label className="block text-sm text-silver">What happened
        <select className={field} value={mode} onChange={(e) => setMode(e.target.value as "out" | "count")}>
          <option value="out">Goods went out (write off)</option>
          <option value="count">I counted the stock</option>
        </select>
      </label>
      <label className="block text-sm text-silver">{mode === "out" ? "How many" : `Counted quantity (books say ${here})`}<input type="number" className={field} value={qty} onChange={(e) => setQty(e.target.value)} /></label>
      {mode === "out" ? (
        <label className="block text-sm text-silver">Reason
          <select className={field} value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</select>
        </label>
      ) : null}
      {batchesHere.length ? (
        <label className="block text-sm text-silver">Batch
          <select className={field} value={batch} onChange={(e) => setBatch(e.target.value)}>
            <option value="">None</option>
            {batchesHere.map((l) => <option key={l.batch} value={l.batch}>{l.batch} ({l.qty})</option>)}
          </select>
        </label>
      ) : null}
      <div className="sm:col-span-3 flex items-center gap-3"><button className="btn-primary" onClick={save}>Save</button><span className="text-sm text-silver">{msg}</span></div>
    </div>
  );
}

function Make({ data, places, onSaved }: { data: AppData; places: string[]; onSaved: () => void }) {
  const makeable = data.stock.filter((s) => (s.bom || []).length);
  const [id, setId] = useState(makeable[0]?.id || "");
  const [qty, setQty] = useState("");
  const [godown, setGodown] = useState(MAIN_GODOWN);
  const [batch, setBatch] = useState("");
  const [expiry, setExpiry] = useState("");
  const [msg, setMsg] = useState("");
  const product = makeable.find((s) => s.id === id);
  if (!makeable.length) {
    return <p className="text-sm text-silver">To make items here, open an item and add the components it is made from (its recipe).</p>;
  }
  function save() {
    const q = Number(qty);
    if (!product || !(q > 0)) return setMsg("Enter how many you made.");
    const short = (product.bom || [])
      .map((c) => ({ c, have: godownQty(data, c.itemId, godown), name: data.stock.find((s) => s.id === c.itemId)?.name || "?" }))
      .filter((x) => x.have < x.c.qty * q);
    if (short.length && !window.confirm(`Not enough in ${godown}: ${short.map((x) => `${x.name} (have ${x.have}, need ${x.c.qty * q})`).join(", ")}. Record anyway?`)) return;
    saveStockMoves(productionMoves(data, product, q, godown, batch || undefined, expiry || undefined), { ref: product.name, detail: `Made ${q} ${product.unit} from components` });
    setQty(""); setMsg("Saved.");
    onSaved();
  }
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="block text-sm text-silver sm:col-span-3">Item to make
        <select className={field} value={id} onChange={(e) => setId(e.target.value)}>{makeable.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      </label>
      {product ? (
        <p className="text-xs text-silver sm:col-span-3">
          Each {product.unit || "unit"} uses: {(product.bom || []).map((c) => `${c.qty} × ${data.stock.find((s) => s.id === c.itemId)?.name || "?"}`).join(", ")}
        </p>
      ) : null}
      <label className="block text-sm text-silver">Quantity made<input type="number" className={field} value={qty} onChange={(e) => setQty(e.target.value)} /></label>
      <Godown value={godown} onChange={setGodown} places={places} />
      <label className="block text-sm text-silver">Batch (optional)<input className={field} value={batch} onChange={(e) => setBatch(e.target.value)} /></label>
      <label className="block text-sm text-silver">Expiry (optional)<input type="date" className={field} value={expiry} onChange={(e) => setExpiry(e.target.value)} /></label>
      <div className="sm:col-span-3 flex items-center gap-3"><button className="btn-primary" onClick={save}>Record</button><span className="text-sm text-silver">{msg}</span></div>
    </div>
  );
}

function Ledger({ data, item, picker }: { data: AppData; item: StockItem; picker: React.ReactNode }) {
  const moves = movesFor(data, item.id);
  let running = 0;
  const rows = moves.map((m) => ({ ...m, balance: (running = Math.round((running + m.qty) * 1000) / 1000) }));
  return (
    <div className="space-y-3">
      {picker}
      <button
        className="btn-secondary !py-1.5 text-xs"
        onClick={() => downloadCsv(`stock-${item.name}.csv`, [["Date", "What", "Godown", "Batch", "In", "Out", "Balance", "Reference", "Note"], ...rows.map((m) => [m.date, KIND[m.kind], m.godown, m.batch || "", m.qty > 0 ? m.qty : "", m.qty < 0 ? -m.qty : "", m.balance, m.ref || "", m.note || ""])])}
      >
        Download
      </button>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-silver">
          <thead><tr className="text-left"><th className="p-1">Date</th><th className="p-1">What</th><th className="p-1">Godown</th><th className="p-1">Batch</th><th className="p-1 text-right">In</th><th className="p-1 text-right">Out</th><th className="p-1 text-right">Balance</th><th className="p-1">Ref</th></tr></thead>
          <tbody>
            {rows.slice().reverse().map((m) => (
              <tr key={m.id} className="border-t border-lead/20">
                <td className="p-1">{m.date}</td><td className="p-1">{KIND[m.kind]}{m.note ? ` — ${m.note}` : ""}</td><td className="p-1">{m.godown}</td><td className="p-1">{m.batch || ""}</td>
                <td className="p-1 text-right">{m.qty > 0 ? m.qty : ""}</td><td className="p-1 text-right">{m.qty < 0 ? -m.qty : ""}</td><td className="p-1 text-right">{m.balance}</td><td className="p-1">{m.ref || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <p className="p-2 text-xs">No movements yet.</p> : null}
      </div>
    </div>
  );
}

function Batches({ data }: { data: AppData }) {
  const soon = useMemo(() => expiring(data, 60), [data]);
  const all = data.stock.flatMap((s) => lots(data, s.id).filter((l) => l.qty > 0 && (l.batch || l.godown !== MAIN_GODOWN)).map((l) => ({ ...l, name: s.name, unit: s.unit })));
  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="mb-1 text-starlight">Expiring within 60 days</h3>
        {soon.length ? (
          <ul className="space-y-1 text-silver">{soon.map((l) => <li key={l.itemId + l.batch + l.godown}>{l.expiry} · {l.name}{l.batch ? ` (batch ${l.batch})` : ""} · {l.qty} in {l.godown}</li>)}</ul>
        ) : <p className="text-silver">Nothing is close to expiry.</p>}
      </div>
      <div>
        <h3 className="mb-1 text-starlight">Stock by godown and batch</h3>
        <ul className="space-y-1 text-silver">{all.map((l) => <li key={l.name + l.godown + l.batch}>{l.name} · {l.godown}{l.batch ? ` · batch ${l.batch}` : ""}{l.expiry ? ` · exp ${l.expiry}` : ""} · {l.qty} {l.unit}</li>)}</ul>
        {!all.length ? <p className="text-silver">All stock is in {MAIN_GODOWN}, without batches.</p> : null}
      </div>
    </div>
  );
}

function Value({ data }: { data: AppData }) {
  const v = useMemo(() => stockValuation(data), [data]);
  const missingCost = data.stock.filter((s) => s.currentStock > 0 && !s.costPrice && !movesFor(data, s.id).some((m) => m.unitCost));
  return (
    <div className="space-y-3 text-sm">
      <p className="text-starlight">Stock value: <b>{formatCurrency(v.total)}</b> (at cost, before GST)</p>
      {missingCost.length ? <p className="text-xs text-orange-300">No cost price for: {missingCost.map((s) => s.name).join(", ")}. Add it on the item for a correct value.</p> : null}
      <button className="btn-secondary !py-1.5 text-xs" onClick={() => downloadCsv(`stock-value-${todayIST()}.csv`, [["Item", "Quantity", "Cost per unit", "Value", "Method"], ...v.items.map((i) => [i.name, i.qty, i.unitCost, i.value, i.method === "fifo" ? "First in, first out" : "Average cost"])])}>Download</button>
      <table className="w-full text-xs text-silver">
        <thead><tr className="text-left"><th className="p-1">Item</th><th className="p-1 text-right">Qty</th><th className="p-1 text-right">Cost/unit</th><th className="p-1 text-right">Value</th></tr></thead>
        <tbody>{v.items.map((i) => <tr key={i.itemId} className="border-t border-lead/20"><td className="p-1">{i.name}</td><td className="p-1 text-right">{i.qty}</td><td className="p-1 text-right">{formatCurrency(i.unitCost)}</td><td className="p-1 text-right">{formatCurrency(i.value)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

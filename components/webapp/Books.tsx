"use client";

import { useMemo, useState } from "react";
import type { AppData } from "@/lib/types";
import { profitAndLoss, runningBook } from "@/lib/books";
import { saveData } from "@/lib/storage";

type BooksProps = { data: AppData; onSaved: () => void };

export function Books({ data, onSaved }: BooksProps) {
  const [tab, setTab] = useState<"party" | "cash" | "bank" | "pnl" | "opening">("party");
  const [cashOpen, setCashOpen] = useState("0");
  const [partyName, setPartyName] = useState("");
  const [partyAmt, setPartyAmt] = useState("0");

  const parties = useMemo(() => {
    const map = new Map<string, { name: string; bal: number }>();
    for (const e of data.khataEntries || []) {
      if ((e.accountType || "party") !== "party") continue;
      const key = e.customerId || e.customerName;
      const cur = map.get(key) || { name: e.customerName, bal: 0 };
      cur.bal += e.isCredit ? e.amount : -e.amount;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.bal - a.bal);
  }, [data.khataEntries]);

  const cash = runningBook(data.khataEntries || [], "cash");
  const bank = runningBook(data.khataEntries || [], "bank");
  const pnl = profitAndLoss(data);

  function addOpening() {
    const next = { ...data, khataEntries: [...(data.khataEntries || [])] };
    const cashAmt = Number(cashOpen) || 0;
    if (cashAmt) {
      next.khataEntries.push({
        id: `open_cash_${Date.now()}`,
        customerId: "",
        customerName: "Cash",
        amount: Math.abs(cashAmt),
        description: "Opening balance",
        createdAt: new Date().toISOString(),
        isCredit: cashAmt >= 0,
        accountType: "cash",
        sourceType: "opening",
        sourceId: "opening",
      });
    }
    const udhaar = Number(partyAmt) || 0;
    if (partyName.trim() && udhaar) {
      next.khataEntries.push({
        id: `open_party_${Date.now()}`,
        customerId: "",
        customerName: partyName.trim(),
        amount: Math.abs(udhaar),
        description: "Opening udhaar",
        createdAt: new Date().toISOString(),
        isCredit: udhaar >= 0,
        accountType: "party",
        sourceType: "opening",
        sourceId: "opening",
      });
    }
    saveData(next);
    onSaved();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-ink">Books</h2>
        <p className="text-sm text-slate">Party, cash, bank, and P&amp;L. No journal screen.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["party", "cash", "bank", "pnl", "opening"] as const).map((t) => (
          <button
            key={t}
            className={`rounded-full px-4 py-1.5 text-sm ${tab === t ? "bg-brand-violet text-white" : "bg-plaster"}`}
            onClick={() => setTab(t)}
          >
            {t === "pnl" ? "P&L" : t === "opening" ? "Opening" : t}
          </button>
        ))}
      </div>
      {tab === "party" && (
        <div className="rounded-card border border-bone bg-white p-4">
          {parties.length === 0 ? (
            <p className="text-slate">No party balances yet. Save a credit bill or record a payment.</p>
          ) : (
            <ul className="divide-y divide-bone">
              {parties.map((p) => (
                <li key={p.name} className="flex justify-between py-2">
                  <span className="font-medium text-ink">{p.name}</span>
                  <span className={p.bal >= 0 ? "text-ink" : "text-green-700"}>
                    {p.bal >= 0 ? `Udhaar ₹${p.bal.toFixed(0)}` : `Advance ₹${Math.abs(p.bal).toFixed(0)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {tab === "cash" && <BookTable rows={cash} empty="No cash movements yet." />}
      {tab === "bank" && <BookTable rows={bank} empty="No bank/UPI movements yet." />}
      {tab === "pnl" && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Sales" value={pnl.sales} />
          <Stat label="COGS" value={pnl.cogs} />
          <Stat label="Expenses" value={pnl.expenses} />
          <Stat label="Profit" value={pnl.profit} />
        </div>
      )}
      {tab === "opening" && (
        <div className="max-w-md space-y-3 rounded-card border border-bone bg-white p-4">
          <p className="text-sm text-slate">Set opening cash and party udhaar so reports are real, not toys.</p>
          <label className="block text-sm">
            Opening cash
            <input className="mt-1 w-full rounded-card border border-bone px-3 py-2" value={cashOpen} onChange={(e) => setCashOpen(e.target.value)} />
          </label>
          <label className="block text-sm">
            Party name
            <input className="mt-1 w-full rounded-card border border-bone px-3 py-2" value={partyName} onChange={(e) => setPartyName(e.target.value)} />
          </label>
          <label className="block text-sm">
            Opening udhaar
            <input className="mt-1 w-full rounded-card border border-bone px-3 py-2" value={partyAmt} onChange={(e) => setPartyAmt(e.target.value)} />
          </label>
          <button className="btn-primary w-full" onClick={addOpening}>
            Save opening balances
          </button>
        </div>
      )}
    </div>
  );
}

function BookTable({ rows, empty }: { rows: Array<{ id: string; description: string; amount: number; isCredit: boolean; runningBalance?: number }>; empty: string }) {
  if (!rows.length) return <p className="rounded-card border border-bone bg-white p-4 text-slate">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-card border border-bone bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-bone">
            <th className="px-3 py-2">Particulars</th>
            <th className="px-3 py-2">In</th>
            <th className="px-3 py-2">Out</th>
            <th className="px-3 py-2">Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-bone">
              <td className="px-3 py-2">{r.description}</td>
              <td className="px-3 py-2">{r.isCredit ? r.amount.toFixed(0) : ""}</td>
              <td className="px-3 py-2">{r.isCredit ? "" : r.amount.toFixed(0)}</td>
              <td className="px-3 py-2">{r.runningBalance?.toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-bone bg-white p-4">
      <div className="text-xs text-slate">{label}</div>
      <div className="text-xl font-bold text-ink">₹{value.toFixed(0)}</div>
    </div>
  );
}

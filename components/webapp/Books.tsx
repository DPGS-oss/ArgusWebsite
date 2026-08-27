"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { AppData } from "@/lib/types";
import { persistLedger, postManualLedger, profitAndLoss, runningBook } from "@/lib/books";
import { loadData, saveData } from "@/lib/storage";
import { t } from "@/lib/i18n";

type BooksProps = { data: AppData; onSaved: () => void };

export function Books({ data, onSaved }: BooksProps) {
  const [tab, setTab] = useState<"party" | "cash" | "bank" | "pnl" | "opening">("party");
  const [cashOpen, setCashOpen] = useState("0");
  const [bankOpen, setBankOpen] = useState("0");
  const [openingParty, setOpeningParty] = useState("");
  const [partyAmt, setPartyAmt] = useState("0");

  const [partyName, setPartyName] = useState("");
  const [partyAmount, setPartyAmount] = useState("");
  const [partyKind, setPartyKind] = useState<"udhaar" | "payment">("udhaar");
  const [partyNote, setPartyNote] = useState("");
  const [partyPostTo, setPartyPostTo] = useState<"none" | "cash" | "bank">("cash");

  const [cashAmount, setCashAmount] = useState("");
  const [cashDir, setCashDir] = useState<"in" | "out">("in");
  const [cashNote, setCashNote] = useState("");

  const [bankAmount, setBankAmount] = useState("");
  const [bankDir, setBankDir] = useState<"in" | "out">("in");
  const [bankNote, setBankNote] = useState("");

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
  const partyNames = Array.from(
    new Set([
      ...data.parties.map((p) => p.name),
      ...parties.map((p) => p.name),
    ]),
  );

  function addPartyEntry() {
    const amt = Number(partyAmount) || 0;
    if (!partyName.trim() || amt <= 0) return;
    const isPayment = partyKind === "payment";
    persistLedger(
      postManualLedger(loadData(), {
        accountType: "party",
        name: partyName.trim(),
        amount: amt,
        isCredit: !isPayment,
        description: partyNote.trim() || (isPayment ? "Payment received" : "Udhaar"),
        partyKind: "customer",
        counterpart: isPayment && partyPostTo !== "none" ? partyPostTo : undefined,
      }),
    );
    setPartyAmount("");
    setPartyNote("");
    onSaved();
  }

  function addCashBank(account: "cash" | "bank") {
    const raw = account === "cash" ? cashAmount : bankAmount;
    const dir = account === "cash" ? cashDir : bankDir;
    const note = account === "cash" ? cashNote : bankNote;
    const amt = Number(raw) || 0;
    if (amt <= 0) return;
    persistLedger(
      postManualLedger(loadData(), {
        accountType: account,
        name: account === "bank" ? "Bank" : "Cash",
        amount: amt,
        isCredit: dir === "in",
        description: note.trim() || (dir === "in" ? "Money in" : "Money out"),
      }),
    );
    if (account === "cash") {
      setCashAmount("");
      setCashNote("");
    } else {
      setBankAmount("");
      setBankNote("");
    }
    onSaved();
  }

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
    const bankAmt = Number(bankOpen) || 0;
    if (bankAmt) {
      next.khataEntries.push({
        id: `open_bank_${Date.now()}`,
        customerId: "",
        customerName: "Bank",
        amount: Math.abs(bankAmt),
        description: "Opening balance",
        createdAt: new Date().toISOString(),
        isCredit: bankAmt >= 0,
        accountType: "bank",
        sourceType: "opening",
        sourceId: "opening",
      });
    }
    const udhaar = Number(partyAmt) || 0;
    if (openingParty.trim() && udhaar) {
      next.khataEntries.push({
        id: `open_party_${Date.now()}`,
        customerId: "",
        customerName: openingParty.trim(),
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
        <h2 className="text-2xl font-bold text-ink">{t("booksTitle")}</h2>
        <p className="text-sm text-slate">{t("booksSubtitle")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["party", "cash", "bank", "pnl", "opening"] as const).map((key) => (
          <button
            key={key}
            className={`rounded-full px-4 py-1.5 text-sm ${tab === key ? "bg-brand-violet text-white" : "bg-plaster"}`}
            onClick={() => setTab(key)}
          >
            {t(key)}
          </button>
        ))}
      </div>
      {tab === "party" && (
        <div className="space-y-3">
          <EntryCard>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-slate">
                {t("partyName")}
                <input
                  list="book-parties"
                  className="input-field mt-1"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder="Customer or supplier"
                />
                <datalist id="book-parties">
                  {partyNames.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </label>
              <label className="block text-sm text-slate">
                {t("amount")} (₹)
                <input
                  type="number"
                  min={0}
                  className="input-field mt-1"
                  value={partyAmount}
                  onChange={(e) => setPartyAmount(e.target.value)}
                  placeholder="0"
                />
              </label>
              <label className="block text-sm text-slate">
                Type
                <select
                  className="input-field mt-1"
                  value={partyKind}
                  onChange={(e) => setPartyKind(e.target.value as "udhaar" | "payment")}
                >
                  <option value="udhaar">{t("udhaar")}</option>
                  <option value="payment">{t("paymentReceived")}</option>
                </select>
              </label>
              {partyKind === "payment" && (
                <label className="block text-sm text-slate">
                  {t("postTo")}
                  <select
                    className="input-field mt-1"
                    value={partyPostTo}
                    onChange={(e) => setPartyPostTo(e.target.value as "none" | "cash" | "bank")}
                  >
                    <option value="cash">{t("cash")}</option>
                    <option value="bank">{t("bank")}</option>
                    <option value="none">{t("none")}</option>
                  </select>
                </label>
              )}
              <label className="block text-sm text-slate sm:col-span-2">
                {t("particulars")}
                <input
                  className="input-field mt-1"
                  value={partyNote}
                  onChange={(e) => setPartyNote(e.target.value)}
                  placeholder="Optional note"
                />
              </label>
            </div>
            <button className="btn-primary mt-3" onClick={addPartyEntry}>
              {t("addEntry")}
            </button>
          </EntryCard>
          <div className="rounded-card border border-bone bg-white p-4">
            {parties.length === 0 ? (
              <p className="text-slate">{t("noParty")}</p>
            ) : (
              <ul className="divide-y divide-bone">
                {parties.map((p) => (
                  <li key={p.name} className="flex justify-between py-2">
                    <span className="font-medium text-ink">{p.name}</span>
                    <span className={p.bal >= 0 ? "text-ink" : "text-green-700"}>
                      {p.bal >= 0 ? `${t("udhaar")} ₹${p.bal.toFixed(0)}` : `${t("advance")} ₹${Math.abs(p.bal).toFixed(0)}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {tab === "cash" && (
        <MoneyTab
          amount={cashAmount}
          dir={cashDir}
          note={cashNote}
          onAmount={setCashAmount}
          onDir={setCashDir}
          onNote={setCashNote}
          onAdd={() => addCashBank("cash")}
          rows={cash}
          empty={t("noCash")}
        />
      )}
      {tab === "bank" && (
        <MoneyTab
          amount={bankAmount}
          dir={bankDir}
          note={bankNote}
          onAmount={setBankAmount}
          onDir={setBankDir}
          onNote={setBankNote}
          onAdd={() => addCashBank("bank")}
          rows={bank}
          empty={t("noBank")}
        />
      )}
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
          <p className="text-sm text-slate">Set opening Cash, Bank, and Party udhaar so reports are real, not toys.</p>
          <label className="block text-sm">
            Opening Cash
            <input className="input-field mt-1" value={cashOpen} onChange={(e) => setCashOpen(e.target.value)} />
          </label>
          <label className="block text-sm">
            Opening Bank
            <input className="input-field mt-1" value={bankOpen} onChange={(e) => setBankOpen(e.target.value)} />
          </label>
          <label className="block text-sm">
            Party name
            <input className="input-field mt-1" value={openingParty} onChange={(e) => setOpeningParty(e.target.value)} />
          </label>
          <label className="block text-sm">
            Opening udhaar
            <input className="input-field mt-1" value={partyAmt} onChange={(e) => setPartyAmt(e.target.value)} />
          </label>
          <button className="btn-primary w-full" onClick={addOpening}>
            Save opening balances
          </button>
        </div>
      )}
    </div>
  );
}

function EntryCard({ children }: { children: ReactNode }) {
  return <div className="rounded-card border border-bone bg-white p-4">{children}</div>;
}

function MoneyTab({
  amount,
  dir,
  note,
  onAmount,
  onDir,
  onNote,
  onAdd,
  rows,
  empty,
}: {
  amount: string;
  dir: "in" | "out";
  note: string;
  onAmount: (v: string) => void;
  onDir: (v: "in" | "out") => void;
  onNote: (v: string) => void;
  onAdd: () => void;
  rows: Array<{ id: string; description: string; amount: number; isCredit: boolean; runningBalance?: number }>;
  empty: string;
}) {
  return (
    <div className="space-y-3">
      <EntryCard>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm text-slate">
            {t("amount")} (₹)
            <input type="number" min={0} className="input-field mt-1" value={amount} onChange={(e) => onAmount(e.target.value)} placeholder="0" />
          </label>
          <label className="block text-sm text-slate">
            Type
            <select className="input-field mt-1" value={dir} onChange={(e) => onDir(e.target.value as "in" | "out")}>
              <option value="in">{t("moneyIn")}</option>
              <option value="out">{t("moneyOut")}</option>
            </select>
          </label>
          <label className="block text-sm text-slate">
            {t("particulars")}
            <input className="input-field mt-1" value={note} onChange={(e) => onNote(e.target.value)} placeholder="Optional note" />
          </label>
        </div>
        <button className="btn-primary mt-3" onClick={onAdd}>
          {t("addEntry")}
        </button>
      </EntryCard>
      <BookTable rows={rows} empty={empty} />
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

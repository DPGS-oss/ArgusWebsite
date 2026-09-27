"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { formatCurrency } from "@/lib/gst";
import type { AppData, Expense, PayrollEntry } from "@/lib/types";
import { deletePayrollEntry, generateId, saveExpense, savePayrollEntry } from "@/lib/storage";
import { persistLedger } from "@/lib/books";
import { loadData } from "@/lib/storage";

type Props = { data: AppData; onSaved: () => void };

const METHODS = ["Cash", "UPI", "Bank Transfer", "Cheque"];

export function Payroll({ data, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [amount, setAmount] = useState(0);
  const [period, setPeriod] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const rows = data.payroll || [];
  const due = rows.filter((e) => e.status !== "paid").reduce((s, e) => s + e.amount, 0);
  const paid = rows.filter((e) => e.status === "paid").reduce((s, e) => s + e.amount, 0);

  function save() {
    if (!name.trim() || amount <= 0) return;
    const now = new Date().toISOString();
    const entry: PayrollEntry = {
      id: generateId(),
      employeeName: name.trim(),
      role: role.trim(),
      amount,
      payDate,
      periodLabel: period.trim(),
      status: "pending",
      paidOn: "",
      method: "Cash",
      note: "",
      createdAt: now,
      updatedAt: now,
    };
    savePayrollEntry(entry);
    onSaved();
    setOpen(false);
    setName("");
    setRole("");
    setAmount(0);
    setPeriod("");
  }

  function confirm(entry: PayrollEntry, method: string) {
    const paidOn = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();
    savePayrollEntry({ ...entry, status: "paid", paidOn, method, updatedAt: now });
    const expense: Expense = {
      id: generateId(),
      category: "Salaries",
      description: `Salary ${entry.employeeName}${entry.periodLabel ? ` · ${entry.periodLabel}` : ""}`,
      amount: entry.amount,
      date: paidOn,
      paymentMode: method,
      vendor: entry.employeeName,
      gstAmount: 0,
      isGstClaimable: false,
      createdAt: now,
      updatedAt: now,
    };
    saveExpense(expense);
    const books = loadData();
    persistLedger({
      ...books,
      khataEntries: [
        ...(books.khataEntries || []),
        {
          id: generateId(),
          customerId: "",
          customerName: method === "Cash" ? "Cash" : "Bank",
          amount: entry.amount,
          description: `Salary ${entry.employeeName}`,
          createdAt: now,
          isCredit: false,
          accountType: method === "Cash" ? "cash" : "bank",
          paymentMethod: method,
          sourceType: "payroll",
          sourceId: entry.id,
        },
      ],
    });
    onSaved();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Payroll</h1>
          <p className="text-sm text-slate">Enter salary and a pay date. Confirm when paid. No bank login.</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add salary
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-bone bg-white p-4">
          <div className="text-xs text-ash">To pay</div>
          <div className="text-xl font-bold text-ink">{formatCurrency(due)}</div>
        </div>
        <div className="rounded-xl border border-bone bg-white p-4">
          <div className="text-xs text-ash">Paid</div>
          <div className="text-xl font-bold text-ink">{formatCurrency(paid)}</div>
        </div>
      </div>

      {open && (
        <div className="mb-6 rounded-2xl border border-bone bg-white p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-slate">Employee
              <input className="input-field mt-1" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="text-sm text-slate">Role
              <input className="input-field mt-1" value={role} onChange={(e) => setRole(e.target.value)} />
            </label>
            <label className="text-sm text-slate">Amount
              <input type="number" className="input-field mt-1" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} />
            </label>
            <label className="text-sm text-slate">Pay date
              <input type="date" className="input-field mt-1" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </label>
            <label className="text-sm text-slate">Period
              <input className="input-field mt-1" placeholder="Sep 2026" value={period} onChange={(e) => setPeriod(e.target.value)} />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="btn-primary" onClick={save}>Save</button>
            <button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {rows.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bone bg-white px-4 py-3">
            <div>
              <div className="font-medium text-ink">{e.employeeName}</div>
              <div className="text-sm text-slate">
                {e.role || "Staff"}{e.periodLabel ? ` · ${e.periodLabel}` : ""} · Pay by {e.payDate}
                {e.status === "paid" ? ` · Paid ${e.paidOn} · ${e.method}` : ""}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="font-semibold">{formatCurrency(e.amount)}</div>
              {e.status === "paid" ? (
                <span className="text-sm text-emerald-700">Paid</span>
              ) : (
                <>
                  <select id={`pay-${e.id}`} className="input-field" defaultValue="Cash">
                    {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <button
                    className="btn-primary !py-2"
                    onClick={() => {
                      const el = document.getElementById(`pay-${e.id}`) as HTMLSelectElement | null;
                      confirm(e, el?.value || "Cash");
                    }}
                  >
                    Paid
                  </button>
                  <button className="text-sm text-ash" onClick={() => {
                    if (!window.confirm(`Remove salary entry for ${e.employeeName}?`)) return;
                    deletePayrollEntry(e.id);
                    onSaved();
                  }}>Remove</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

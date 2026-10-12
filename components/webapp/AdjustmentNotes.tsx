"use client";

import { useState } from "react";
import { Plus, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/gst";
import type { AppData, CreditNote, DebitNote } from "@/lib/types";
import { cancelCreditNote, cancelDebitNote, generateId, generateInvoiceNumber, loadData, saveCreditNote, saveDebitNote } from "@/lib/storage";
import { persistLedger, postNoteLedger } from "@/lib/books";
import { creditableOnBill, noteFromBill } from "@/lib/notes";
import { todayIST } from "@/lib/dates";

type Kind = "credit_note" | "debit_note";
type Props = { data: AppData; onSaved: () => void; kind: Kind };

const COPY = {
  credit_note: {
    title: "Credit notes",
    help: "Use when goods come back or you charged too much. Pick the bill and the amount; GST is worked out at that bill's rates.",
    button: "New credit note",
    amountLabel: "Amount to reduce or refund (GST included)",
    prefix: "CN",
    empty: "No credit notes yet.",
  },
  debit_note: {
    title: "Debit notes",
    help: "Use when you charged too little. Pick the bill and the extra amount; GST is worked out at that bill's rates.",
    button: "New debit note",
    amountLabel: "Extra amount to charge (GST included)",
    prefix: "DN",
    empty: "No debit notes yet.",
  },
} as const;

type AnyNote = (CreditNote | DebitNote) & { number: string };

export function AdjustmentNotes({ data, onSaved, kind }: Props) {
  const copy = COPY[kind];
  const [open, setOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  // Not memoised: storage updates these lists in place.
  const bills = data.invoices.filter(
    (i) => i.status !== "draft" && i.status !== "cancelled" && (i.type === "tax_invoice" || i.type === "bill_of_supply"),
  );
  const notes: AnyNote[] =
    kind === "credit_note"
      ? (data.creditNotes || []).map((n) => ({ ...n, number: n.creditNoteNumber }))
      : (data.debitNotes || []).map((n) => ({ ...n, number: n.debitNoteNumber }));
  const bill = bills.find((b) => b.id === invoiceId);
  const preview = bill ? noteFromBill(bill, Number(amount) || 0) : null;
  const maxCredit = bill && kind === "credit_note" ? creditableOnBill(data, bill) : null;

  function reset() {
    setOpen(false);
    setInvoiceId("");
    setAmount("");
    setReason("");
    setError("");
  }

  function save() {
    if (!bill) return setError("Pick the bill this note is for.");
    const value = Number(amount) || 0;
    if (value <= 0) return setError("Enter an amount above zero.");
    if (maxCredit != null && value > maxCredit + 0.001) {
      return setError(`Only ${formatCurrency(maxCredit)} is left on this bill to credit.`);
    }
    const amounts = noteFromBill(bill, value);
    const date = todayIST();
    const now = new Date().toISOString();
    const existing = notes.map((n) => ({ invoiceNumber: n.number }));
    const number = generateInvoiceNumber(existing, copy.prefix, date);
    const common = {
      id: generateId(),
      invoiceId: bill.id,
      date,
      customerName: bill.partyName,
      customerId: bill.partyId,
      reason: reason.trim(),
      ...amounts,
      notes: "",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    if (kind === "credit_note") {
      const note: CreditNote = { ...common, creditNoteNumber: number };
      saveCreditNote(note);
      persistLedger(postNoteLedger(loadData(), note, kind));
    } else {
      const note: DebitNote = { ...common, debitNoteNumber: number };
      saveDebitNote(note);
      persistLedger(postNoteLedger(loadData(), note, kind));
    }
    onSaved();
    reset();
  }

  function cancel(note: AnyNote) {
    if (!window.confirm(`Cancel ${note.number}? It stays in your records as cancelled.`)) return;
    if (kind === "credit_note") cancelCreditNote(note.id);
    else cancelDebitNote(note.id);
    const latest = loadData();
    const saved =
      kind === "credit_note"
        ? (latest.creditNotes || []).find((n) => n.id === note.id)
        : (latest.debitNotes || []).find((n) => n.id === note.id);
    if (saved) persistLedger(postNoteLedger(latest, saved, kind));
    onSaved();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{copy.title}</h1>
          <p className="text-sm text-slate">{copy.help}</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary flex shrink-0 items-center gap-2">
          <Plus className="h-4 w-4" /> {copy.button}
        </button>
      </div>

      {open && (
        <div className="mb-6 rounded-2xl border border-bone bg-white p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-slate sm:col-span-2">
              Bill
              <select className="input-field mt-1" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
                <option value="">Pick a bill</option>
                {bills.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.invoiceNumber} · {b.partyName || "Walk-in"} · {formatCurrency(b.grandTotal)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate">
              {copy.amountLabel}
              <input type="number" min="0" step="0.01" className="input-field mt-1" value={amount} onChange={(e) => setAmount(e.target.value)} />
              {maxCredit != null ? <span className="mt-1 block text-xs text-ash">Up to {formatCurrency(maxCredit)}</span> : null}
            </label>
            <label className="text-sm text-slate">
              Reason
              <input className="input-field mt-1" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Goods returned, price corrected…" />
            </label>
          </div>
          {preview && preview.totalAmount > 0 ? (
            <p className="mt-4 rounded-card bg-mist p-3 text-sm text-ink">
              Value before tax {formatCurrency(preview.subtotal)} + GST {formatCurrency(preview.totalGstAmount)} = {formatCurrency(preview.totalAmount)}
            </p>
          ) : null}
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          <div className="mt-4 flex gap-2">
            <button className="btn-primary" onClick={save}>Save</button>
            <button className="btn-secondary" onClick={reset}>Close</button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-bone py-16 text-center">
          <FileText className="mb-3 h-10 w-10 text-ash" />
          <p className="text-slate">{copy.empty}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => {
            const original = data.invoices.find((i) => i.id === n.invoiceId);
            const cancelled = n.status === "cancelled";
            return (
              <div key={n.id} className="flex items-center justify-between gap-3 rounded-xl border border-bone bg-white px-4 py-3">
                <div className="min-w-0">
                  <div className={`font-medium ${cancelled ? "text-ash line-through" : "text-ink"}`}>{n.number}</div>
                  <div className="truncate text-sm text-slate">
                    {n.customerName}
                    {original ? ` · against ${original.invoiceNumber}` : ""}
                    {n.reason ? ` · ${n.reason}` : ""}
                  </div>
                  <div className="text-xs text-ash">{n.date || n.createdAt.slice(0, 10)}{cancelled ? " · cancelled" : ""}</div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="font-semibold text-ink">{formatCurrency(n.totalAmount)}</div>
                  {!cancelled ? (
                    <button className="text-sm text-ash hover:text-red-600" onClick={() => cancel(n)}>Cancel</button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

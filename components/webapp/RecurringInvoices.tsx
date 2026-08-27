"use client";

import { useState } from "react";
import { Repeat, Calendar, Plus, Pause, Play, Trash2 } from "lucide-react";
import type { AppData, GSTRate, Invoice, RecurringConfig } from "@/lib/types";
import { generateId, generateInvoiceNumber, saveInvoice, deleteInvoice, loadData } from "@/lib/storage";
import { persistLedger, postInvoiceLedger } from "@/lib/books";
import { round2 } from "@/lib/gst";

type Props = {
  data: AppData;
  onSaved: () => void;
};

const GST_RATES: GSTRate[] = [0, 3, 5, 12, 18, 28];
const FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
] as const;

type RecurringRaw = RecurringConfig & { next_run?: string; end_date?: string };

function recurringOf(inv: Invoice): RecurringConfig | null {
  const raw = inv.recurring as RecurringRaw | undefined;
  if (!raw) return null;
  return {
    frequency: raw.frequency || "monthly",
    interval: raw.interval || 1,
    nextRun: raw.nextRun || raw.next_run,
    endDate: raw.endDate || raw.end_date,
    active: raw.active !== false,
  };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addPeriod(iso: string, frequency: string, interval = 1): string {
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso);
  const start = Number.isNaN(d.getTime()) ? new Date() : d;
  const n = Math.max(1, interval);
  switch (frequency) {
    case "weekly":
      start.setDate(start.getDate() + 7 * n);
      break;
    case "quarterly":
      start.setMonth(start.getMonth() + 3 * n);
      break;
    case "yearly":
      start.setFullYear(start.getFullYear() + n);
      break;
    default:
      start.setMonth(start.getMonth() + n);
  }
  return start.toISOString().slice(0, 10);
}

function frequencyLabel(rc: RecurringConfig): string {
  const n = rc.interval <= 1 ? "" : `every ${rc.interval} `;
  switch ((rc.frequency || "monthly").toLowerCase()) {
    case "weekly":
      return n ? `Every ${rc.interval} weeks` : "Weekly";
    case "quarterly":
      return n ? `Every ${rc.interval} quarters` : "Quarterly";
    case "yearly":
      return n ? `Every ${rc.interval} years` : "Yearly";
    default:
      return n ? `Every ${rc.interval} months` : "Monthly";
  }
}

function splitInclusive(total: number, gstRate: GSTRate, interState: boolean) {
  const taxable = round2(total / (1 + gstRate / 100));
  const tax = round2(total - taxable);
  const cgst = interState ? 0 : round2(tax / 2);
  const sgst = interState ? 0 : round2(tax / 2);
  const igst = interState ? tax : 0;
  return { taxable, tax, cgst, sgst, igst, grandTotal: round2(total) };
}

export function RecurringInvoices({ data, onSaved }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [partyName, setPartyName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [gstRate, setGstRate] = useState<GSTRate>(data.settings.defaultGstRate || 18);
  const [frequency, setFrequency] = useState("monthly");
  const [startDate, setStartDate] = useState(todayIso());

  const recurringInvoices = data.invoices.filter((inv) => recurringOf(inv));
  const customers = data.parties.filter((p) => p.type !== "supplier");

  function resetForm() {
    setPartyName("");
    setDescription("");
    setAmount(0);
    setGstRate(data.settings.defaultGstRate || 18);
    setFrequency("monthly");
    setStartDate(todayIso());
    setShowForm(false);
  }

  function handleSave() {
    if (!partyName.trim()) {
      alert("Enter a party name.");
      return;
    }
    if (amount <= 0) {
      alert("Enter an amount.");
      return;
    }
    const business = data.businesses.find((b) => b.id === data.activeBusinessId) || data.businesses[0];
    const party = data.parties.find((p) => p.name.toLowerCase() === partyName.trim().toLowerCase());
    const split = splitInclusive(amount, gstRate, false);
    const now = new Date().toISOString();
    const invoiceNumber = generateInvoiceNumber(
      data.invoiceCounter,
      data.settings.invoicePrefix,
      data.settings.invoiceSuffix,
    );
    const invoice: Invoice = {
      id: generateId(),
      invoiceNumber,
      type: "tax_invoice",
      status: "unpaid",
      businessId: business?.id || "",
      partyId: party?.id || "",
      partyName: party?.name || partyName.trim(),
      partyGstin: party?.gstin || "",
      partyPhone: party?.phone || "",
      date: startDate,
      dueDate: startDate,
      items: [
        {
          id: generateId(),
          description: description.trim() || "Recurring bill",
          hsn: "",
          quantity: 1,
          unit: "NOS",
          rate: amount,
          discount: 0,
          gstRate,
          taxableAmount: split.taxable,
          cgst: split.cgst,
          sgst: split.sgst,
          igst: split.igst,
          total: split.grandTotal,
        },
      ],
      subtotal: amount,
      totalDiscount: 0,
      totalTaxable: split.taxable,
      totalCgst: split.cgst,
      totalSgst: split.sgst,
      totalIgst: split.igst,
      totalTax: split.tax,
      roundOff: 0,
      grandTotal: split.grandTotal,
      paidAmount: 0,
      balanceDue: split.grandTotal,
      paymentMode: "credit",
      notes: "",
      terms: data.settings.defaultTerms || "",
      placeOfSupply: party?.state || business?.state || "",
      isInterState: false,
      isTotalMode: true,
      createdAt: now,
      updatedAt: now,
      recurring: {
        frequency,
        interval: 1,
        nextRun: addPeriod(startDate, frequency, 1),
        active: true,
      },
    };
    saveInvoice(invoice);
    persistLedger(postInvoiceLedger(loadData(), invoice));
    onSaved();
    resetForm();
  }

  function toggleActive(inv: Invoice) {
    const rc = recurringOf(inv);
    if (!rc) return;
    saveInvoice({ ...inv, recurring: { ...rc, active: !rc.active }, updatedAt: new Date().toISOString() });
    onSaved();
  }

  function generateNow(inv: Invoice) {
    const rc = recurringOf(inv);
    if (!rc) return;
    const now = new Date().toISOString();
    const date = todayIso();
    const latest = loadData();
    const generated: Invoice = {
      ...inv,
      id: generateId(),
      invoiceNumber: generateInvoiceNumber(
        latest.invoiceCounter,
        latest.settings.invoicePrefix,
        latest.settings.invoiceSuffix,
      ),
      date,
      dueDate: date,
      status: "unpaid",
      paidAmount: 0,
      balanceDue: inv.grandTotal,
      createdAt: now,
      updatedAt: now,
      recurring: undefined,
    };
    saveInvoice(generated);
    saveInvoice({
      ...inv,
      recurring: { ...rc, nextRun: addPeriod(date, rc.frequency, rc.interval) },
      updatedAt: now,
    });
    persistLedger(postInvoiceLedger(loadData(), generated));
    onSaved();
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this recurring invoice?")) return;
    deleteInvoice(id);
    onSaved();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Recurring Invoices</h1>
          <p className="mt-1 text-sm text-slate">Rent, retainers, and monthly bills that repeat on a schedule.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Recurring
        </button>
      </div>

      <div className="mb-6 rounded-xl border border-bone bg-white p-4">
        <div className="flex items-center gap-3">
          <Repeat className="h-5 w-5 shrink-0 text-signal-blue" />
          <p className="text-sm text-slate">
            Saving creates the first bill now. Use <span className="font-medium text-ink">Generate now</span> when the next period is due.
          </p>
        </div>
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl border border-bone bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">New Recurring Invoice</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate">Party</label>
              <input
                list="recurring-parties"
                type="text"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                className="input-field"
                placeholder="Customer name"
              />
              <datalist id="recurring-parties">
                {customers.map((p) => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate">Amount (₹, incl. GST)</label>
              <input
                type="number"
                min={0}
                value={amount || ""}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="input-field"
                placeholder="0"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-slate">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field"
                placeholder="Monthly rent, retainer…"
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
              <label className="mb-1 block text-sm text-slate">Repeat</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="input-field">
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate">First bill date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" />
            </div>
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

      {recurringInvoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-bone py-16 text-center">
          <Calendar className="mb-3 h-10 w-10 text-ash" />
          <p className="text-slate">No recurring invoices yet.</p>
          <p className="mt-1 text-sm text-ash">Add rent, retainers, or any bill that repeats.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recurringInvoices.map((inv) => {
            const rc = recurringOf(inv)!;
            return (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bone bg-white p-4">
                <div>
                  <div className="font-semibold text-ink">{inv.partyName}</div>
                  <div className="text-sm text-slate">
                    {inv.invoiceNumber} · {inv.items[0]?.description || "Recurring bill"}
                  </div>
                  <div className="text-xs text-ash">
                    {frequencyLabel(rc)}
                    {rc.nextRun ? ` · Next ${rc.nextRun}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="mr-2 text-right">
                    <div className="font-semibold text-ink">₹{inv.grandTotal.toFixed(2)}</div>
                    <div className={`text-xs ${rc.active ? "text-emerald-600" : "text-ash"}`}>{rc.active ? "Active" : "Paused"}</div>
                  </div>
                  <button
                    onClick={() => generateNow(inv)}
                    className="rounded-lg border border-bone px-3 py-1.5 text-xs font-medium text-ink hover:bg-plaster"
                  >
                    Generate now
                  </button>
                  <button
                    onClick={() => toggleActive(inv)}
                    className="rounded-lg p-2 text-slate hover:bg-plaster"
                    title={rc.active ? "Pause" : "Resume"}
                  >
                    {rc.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <button onClick={() => handleDelete(inv.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, Search, Sparkles, ArrowLeft, Save } from "lucide-react";
import type { AppData, BusinessProfile, Invoice, InvoiceItem, InvoiceType, InvoiceStatus, Party, GSTRate } from "@/lib/types";
import { INDIAN_STATES, UNITS, PAYMENT_MODES } from "@/lib/types";
import { calculateItem, calculateInvoiceTotals, formatCurrency, searchHSN, suggestHSN, isInterState } from "@/lib/gst";
import { generateId, generateInvoiceNumber } from "@/lib/storage";

type InvoiceFormProps = {
  data: AppData;
  business: BusinessProfile | null;
  editingInvoice: Invoice | null;
  onSave: (invoice: Invoice) => void;
  onBack: () => void;
};

const GST_RATES: GSTRate[] = [0, 3, 5, 12, 18, 28];
const INVOICE_TYPES: { value: InvoiceType; label: string }[] = [
  { value: "tax_invoice", label: "Tax Invoice" },
  { value: "bill_of_supply", label: "Bill of Supply" },
  { value: "credit_note", label: "Credit Note" },
  { value: "debit_note", label: "Debit Note" },
];

function emptyItem(businessStateCode: string, partyStateCode: string, defaultGstRate: GSTRate): InvoiceItem {
  const calc = calculateItem({
    quantity: 1,
    rate: 0,
    discount: 0,
    gstRate: defaultGstRate,
    isInterState: isInterState(businessStateCode, partyStateCode),
  });
  return {
    id: generateId(),
    description: "",
    hsn: "",
    quantity: 1,
    unit: "NOS",
    rate: 0,
    discount: 0,
    gstRate: defaultGstRate,
    taxableAmount: calc.taxableAmount,
    cgst: calc.cgst,
    sgst: calc.sgst,
    igst: calc.igst,
    total: calc.total,
  };
}

export function InvoiceForm({ data, business, editingInvoice, onSave, onBack }: InvoiceFormProps) {
  const today = new Date().toISOString().split("T")[0];
  const dueDate = new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0];

  const parties = data.parties;

  const [invoiceType, setInvoiceType] = useState<InvoiceType>(editingInvoice?.type || "tax_invoice");
  const [status, setStatus] = useState<InvoiceStatus>(editingInvoice?.status || "draft");
  const [partyId, setPartyId] = useState(editingInvoice?.partyId || "");
  const [date, setDate] = useState(editingInvoice?.date || today);
  const [dueDateVal, setDueDateVal] = useState(editingInvoice?.dueDate || dueDate);
  const [items, setItems] = useState<InvoiceItem[]>(
    editingInvoice?.items || [emptyItem(business?.stateCode || "", "", data.settings.defaultGstRate)]
  );
  const [paymentMode, setPaymentMode] = useState(editingInvoice?.paymentMode || "");
  const [notes, setNotes] = useState(editingInvoice?.notes || data.settings.defaultNotes);
  const [terms, setTerms] = useState(editingInvoice?.terms || data.settings.defaultTerms);
  const [paidAmount, setPaidAmount] = useState(editingInvoice?.paidAmount || 0);
  const [hsnSearch, setHsnSearch] = useState<string | null>(null);
  const [hsnItemIdx, setHsnItemIdx] = useState<number | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<{ idx: number; suggestions: { code: string; description: string; gstRate: GSTRate }[] } | null>(null);

  const selectedParty = parties.find((p) => p.id === partyId);
  const businessStateCode = business?.stateCode || "";
  const partyStateCode = selectedParty?.stateCode || "";
  const interState = isInterState(businessStateCode, partyStateCode);

  const totals = useMemo(() => calculateInvoiceTotals(items, data.settings.roundOff), [items, data.settings.roundOff]);

  function updateItem(idx: number, patch: Partial<InvoiceItem>) {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[idx], ...patch };
      const calc = calculateItem({
        quantity: item.quantity,
        rate: item.rate,
        discount: item.discount,
        gstRate: item.gstRate,
        isInterState: interState,
      });
      next[idx] = {
        ...item,
        taxableAmount: calc.taxableAmount,
        cgst: calc.cgst,
        sgst: calc.sgst,
        igst: calc.igst,
        total: calc.total,
      };
      return next;
    });
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem(businessStateCode, partyStateCode, data.settings.defaultGstRate)]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleHsnSearch(idx: number, query: string) {
    setHsnItemIdx(idx);
    setHsnSearch(query);
  }

  function selectHsn(code: string, gstRate: GSTRate) {
    if (hsnItemIdx !== null) {
      updateItem(hsnItemIdx, { hsn: code, gstRate });
    }
    setHsnSearch(null);
    setHsnItemIdx(null);
  }

  function handleAiSuggest(idx: number) {
    const item = items[idx];
    if (!item.description) return;
    const suggestions = suggestHSN(item.description);
    setAiSuggestions({ idx, suggestions });
  }

  function handleSave() {
    if (!business) {
      alert("Please set up your business profile first in Settings.");
      return;
    }
    if (!partyId) {
      alert("Please select a party (customer/supplier).");
      return;
    }
    if (items.length === 0 || items.every((i) => !i.description)) {
      alert("Please add at least one item.");
      return;
    }

    const party = parties.find((p) => p.id === partyId);
    if (!party) return;

    const invoiceNumber = editingInvoice?.invoiceNumber || generateInvoiceNumber(
      data.invoiceCounter,
      data.settings.invoicePrefix,
      data.settings.invoiceSuffix
    );

    const balanceDue = totals.grandTotal - paidAmount;

    const invoice: Invoice = {
      id: editingInvoice?.id || generateId(),
      invoiceNumber,
      type: invoiceType,
      status,
      businessId: business.id,
      partyId,
      partyName: party.name,
      partyGstin: party.gstin,
      date,
      dueDate: dueDateVal,
      items: items.filter((i) => i.description),
      subtotal: totals.subtotal,
      totalDiscount: totals.totalDiscount,
      totalTaxable: totals.totalTaxable,
      totalCgst: totals.totalCgst,
      totalSgst: totals.totalSgst,
      totalIgst: totals.totalIgst,
      totalTax: totals.totalTax,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      paidAmount,
      balanceDue,
      paymentMode,
      notes,
      terms,
      placeOfSupply: party.state || business.state || "",
      isInterState: interState,
      createdAt: editingInvoice?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(invoice);
  }

  const hsnResults = hsnSearch !== null ? searchHSN(hsnSearch) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="rounded-lg p-2 text-silver hover:bg-graphite hover:text-starlight">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl text-starlight">
            {editingInvoice ? `Edit ${editingInvoice.invoiceNumber}` : "New Invoice"}
          </h1>
        </div>
        <button onClick={handleSave} className="btn-primary">
          <Save className="mr-1 h-4 w-4" /> Save Invoice
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border border-lead/20 bg-midnight p-5">
            <h2 className="mb-4 text-lg text-starlight">Invoice Details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-silver">
                Invoice Type
                <select
                  value={invoiceType}
                  onChange={(e) => setInvoiceType(e.target.value as InvoiceType)}
                  className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-starlight outline-none focus:border-mercury-blue"
                >
                  {INVOICE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-silver">
                Status
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
                  className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-starlight outline-none focus:border-mercury-blue"
                >
                  <option value="draft">Draft</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              <label className="block text-sm text-silver">
                Date
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-starlight outline-none focus:border-mercury-blue"
                />
              </label>
              <label className="block text-sm text-silver">
                Due Date
                <input
                  type="date"
                  value={dueDateVal}
                  onChange={(e) => setDueDateVal(e.target.value)}
                  className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-starlight outline-none focus:border-mercury-blue"
                />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-lead/20 bg-midnight p-5">
            <h2 className="mb-4 text-lg text-starlight">Bill To</h2>
            {parties.length === 0 ? (
              <p className="text-sm text-silver">
                No parties added yet. Go to Parties to add customers/suppliers.
              </p>
            ) : (
              <select
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                className="w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-starlight outline-none focus:border-mercury-blue"
              >
                <option value="">Select a party...</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.gstin ? `(${p.gstin})` : ""}
                  </option>
                ))}
              </select>
            )}
            {selectedParty && (
              <div className="mt-3 rounded-lg bg-graphite p-3 text-sm text-silver">
                <p className="text-starlight">{selectedParty.name}</p>
                <p>{selectedParty.address}</p>
                <p>{selectedParty.city}, {selectedParty.state} - {selectedParty.pincode}</p>
                <p>GSTIN: {selectedParty.gstin || "Unregistered"}</p>
                <p className="mt-1 text-xs text-mercury-blue">
                  {interState ? "Inter-state (IGST applies)" : "Intra-state (CGST + SGST applies)"}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-lead/20 bg-midnight p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg text-starlight">Items</h2>
              <button onClick={addItem} className="btn-secondary !py-2">
                <Plus className="mr-1 h-4 w-4" /> Add Item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={item.id} className="rounded-lg bg-graphite p-4">
                  <div className="grid gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-4">
                      <label className="text-xs text-silver">Description</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(idx, { description: e.target.value })}
                        placeholder="Item description"
                        className="mt-1 w-full rounded-btn border border-lead/30 bg-abyss px-3 py-2 text-sm text-starlight outline-none focus:border-mercury-blue"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="flex items-center justify-between text-xs text-silver">
                        HSN
                        <button
                          onClick={() => handleAiSuggest(idx)}
                          className="text-mercury-blue hover:underline"
                          title="AI suggest HSN"
                        >
                          <Sparkles className="h-3 w-3" />
                        </button>
                      </label>
                      <div className="relative mt-1">
                        <input
                          type="text"
                          value={item.hsn}
                          onChange={(e) => {
                            updateItem(idx, { hsn: e.target.value });
                            handleHsnSearch(idx, e.target.value);
                          }}
                          onFocus={() => { setHsnItemIdx(idx); setHsnSearch(item.hsn); }}
                          placeholder="HSN code"
                          className="w-full rounded-btn border border-lead/30 bg-abyss px-3 py-2 text-sm text-starlight outline-none focus:border-mercury-blue"
                        />
                        {hsnSearch !== null && hsnItemIdx === idx && hsnResults.length > 0 && (
                          <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-lead/30 bg-midnight shadow-xl">
                            {hsnResults.map((h) => (
                              <button
                                key={h.code}
                                onClick={() => selectHsn(h.code, h.gstRate)}
                                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-graphite"
                              >
                                <span className="text-starlight">{h.code}</span>
                                <span className="text-silver">{h.description}</span>
                                <span className="text-mercury-blue">{h.gstRate}%</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="sm:col-span-1">
                      <label className="text-xs text-silver">Qty</label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                        className="mt-1 w-full rounded-btn border border-lead/30 bg-abyss px-3 py-2 text-sm text-starlight outline-none focus:border-mercury-blue"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="text-xs text-silver">Unit</label>
                      <select
                        value={item.unit}
                        onChange={(e) => updateItem(idx, { unit: e.target.value })}
                        className="mt-1 w-full rounded-btn border border-lead/30 bg-abyss px-2 py-2 text-sm text-starlight outline-none focus:border-mercury-blue"
                      >
                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs text-silver">Rate (₹)</label>
                      <input
                        type="number"
                        value={item.rate}
                        onChange={(e) => updateItem(idx, { rate: parseFloat(e.target.value) || 0 })}
                        className="mt-1 w-full rounded-btn border border-lead/30 bg-abyss px-3 py-2 text-sm text-starlight outline-none focus:border-mercury-blue"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="text-xs text-silver">Disc%</label>
                      <input
                        type="number"
                        value={item.discount}
                        onChange={(e) => updateItem(idx, { discount: parseFloat(e.target.value) || 0 })}
                        className="mt-1 w-full rounded-btn border border-lead/30 bg-abyss px-3 py-2 text-sm text-starlight outline-none focus:border-mercury-blue"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="text-xs text-silver">GST%</label>
                      <select
                        value={item.gstRate}
                        onChange={(e) => updateItem(idx, { gstRate: parseFloat(e.target.value) as GSTRate })}
                        className="mt-1 w-full rounded-btn border border-lead/30 bg-abyss px-2 py-2 text-sm text-starlight outline-none focus:border-mercury-blue"
                      >
                        {GST_RATES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>

                  {aiSuggestions && aiSuggestions.idx === idx && (
                    <div className="mt-2 rounded-lg bg-abyss p-2">
                      <p className="mb-1 flex items-center gap-1 text-xs text-mercury-blue">
                        <Sparkles className="h-3 w-3" /> AI Suggestions:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {aiSuggestions.suggestions.length === 0 ? (
                          <span className="text-xs text-silver">No suggestions. Try a more detailed description.</span>
                        ) : (
                          aiSuggestions.suggestions.map((s) => (
                            <button
                              key={s.code}
                              onClick={() => {
                                selectHsn(s.code, s.gstRate);
                                setAiSuggestions(null);
                              }}
                              className="rounded-btn border border-mercury-blue/30 px-2 py-1 text-xs text-silver hover:border-mercury-blue"
                            >
                              {s.code} - {s.description} ({s.gstRate}%)
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm text-starlight">
                      Total: {formatCurrency(item.total)}
                    </span>
                    {items.length > 1 && (
                      <button
                        onClick={() => removeItem(idx)}
                        className="rounded p-1 text-silver hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-silver">
              Notes
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-sm text-starlight outline-none focus:border-mercury-blue"
              />
            </label>
            <label className="block text-sm text-silver">
              Terms & Conditions
              <textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-sm text-starlight outline-none focus:border-mercury-blue"
              />
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-lead/20 bg-midnight p-5">
            <h2 className="mb-4 text-lg text-starlight">Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-silver">
                <span>Subtotal</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              {totals.totalDiscount > 0 && (
                <div className="flex justify-between text-silver">
                  <span>Discount</span>
                  <span>-{formatCurrency(totals.totalDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-silver">
                <span>Taxable Amount</span>
                <span>{formatCurrency(totals.totalTaxable)}</span>
              </div>
              {totals.totalCgst > 0 && (
                <div className="flex justify-between text-silver">
                  <span>CGST</span>
                  <span>{formatCurrency(totals.totalCgst)}</span>
                </div>
              )}
              {totals.totalSgst > 0 && (
                <div className="flex justify-between text-silver">
                  <span>SGST</span>
                  <span>{formatCurrency(totals.totalSgst)}</span>
                </div>
              )}
              {totals.totalIgst > 0 && (
                <div className="flex justify-between text-silver">
                  <span>IGST</span>
                  <span>{formatCurrency(totals.totalIgst)}</span>
                </div>
              )}
              {totals.roundOff !== 0 && (
                <div className="flex justify-between text-silver">
                  <span>Round Off</span>
                  <span>{formatCurrency(totals.roundOff)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-lead/20 pt-2 text-lg font-medium text-starlight">
                <span>Grand Total</span>
                <span>{formatCurrency(totals.grandTotal)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-lead/20 bg-midnight p-5">
            <h2 className="mb-4 text-lg text-starlight">Payment</h2>
            <label className="block text-sm text-silver">
              Paid Amount (₹)
              <input
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-sm text-starlight outline-none focus:border-mercury-blue"
              />
            </label>
            <label className="mt-3 block text-sm text-silver">
              Payment Mode
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-sm text-starlight outline-none focus:border-mercury-blue"
              >
                <option value="">Select...</option>
                {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <div className="mt-3 flex justify-between text-sm">
              <span className="text-silver">Balance Due</span>
              <span className="text-amber-400">{formatCurrency(totals.grandTotal - paidAmount)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

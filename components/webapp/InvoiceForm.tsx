"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, Sparkles, ArrowLeft, Save, ScanLine, Package, X } from "lucide-react";
import type { AppData, BusinessProfile, Invoice, InvoiceItem, InvoiceType, InvoiceStatus, GSTRate, StockItem } from "@/lib/types";
import { UNITS, PAYMENT_MODES, INDIAN_STATES } from "@/lib/types";
import {
  calculateItem,
  calculateInvoiceTotals,
  formatCurrency,
  searchHSN,
  suggestHSN,
  isInterState,
  round2,
  gstRatePickerOptions,
  gstRateLabel,
  defaultGstRateForNew,
  resolvePlaceOfSupply,
  resolveShipTo,
  formatPartyAddress,
  buildInvoiceDocument,
  openHistoricalInvoice,
  stateCodeFromPlaceOfSupply,
} from "@/lib/gst";
import { generateId, generateInvoiceNumber } from "@/lib/storage";
import { BarcodeScannerModal } from "./BarcodeScannerModal";
import { validateGstin } from "@/lib/gstin";

type InvoiceFormProps = {
  data: AppData;
  business: BusinessProfile | null;
  editingInvoice: Invoice | null;
  onSave: (invoice: Invoice) => void;
  onBack: () => void;
};

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
    uqc: "NOS",
    rate: 0,
    discount: 0,
    gstRate: defaultGstRate,
    taxableAmount: calc.taxableAmount,
    cgst: calc.cgst,
    sgst: calc.sgst,
    igst: calc.igst,
    cess: calc.cess ?? 0,
    total: calc.total,
  };
}

export function InvoiceForm({ data, business, editingInvoice, onSave, onBack }: InvoiceFormProps) {
  const today = new Date().toISOString().split("T")[0];
  const dueDate = new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0];
  const openedInvoice = editingInvoice ? openHistoricalInvoice(editingInvoice) : null;

  const parties = data.parties;
  const newInvoiceGstRate = defaultGstRateForNew(data.settings.defaultGstRate);

  const [invoiceType, setInvoiceType] = useState<InvoiceType>(openedInvoice?.type || "tax_invoice");
  const [status, setStatus] = useState<InvoiceStatus>(openedInvoice?.status || "draft");
  const [partyId, setPartyId] = useState(openedInvoice?.partyId || "");
  const [date, setDate] = useState(openedInvoice?.date || today);
  const [dueDateVal, setDueDateVal] = useState(openedInvoice?.dueDate || dueDate);
  const [items, setItems] = useState<InvoiceItem[]>(
    openedInvoice?.items || [emptyItem(business?.stateCode || "", "", newInvoiceGstRate)]
  );
  const [paymentMode, setPaymentMode] = useState(openedInvoice?.paymentMode || "");
  const [notes, setNotes] = useState(openedInvoice?.notes || data.settings.defaultNotes);
  const [terms, setTerms] = useState(openedInvoice?.terms || data.settings.defaultTerms);
  const [paidAmount, setPaidAmount] = useState(openedInvoice?.paidAmount || 0);
  const [hsnSearch, setHsnSearch] = useState<string | null>(null);
  const [hsnItemIdx, setHsnItemIdx] = useState<number | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<{ idx: number; suggestions: { code: string; description: string; gstRate: GSTRate }[] } | null>(null);
  const [isTotalMode, setIsTotalMode] = useState(openedInvoice?.isTotalMode ?? true);
  const [totalAmount, setTotalAmount] = useState(openedInvoice?.isTotalMode ? openedInvoice.grandTotal : 0);
  const [totalGstRate, setTotalGstRate] = useState<GSTRate>(openedInvoice?.isTotalMode ? (openedInvoice.items[0]?.gstRate || newInvoiceGstRate) : newInvoiceGstRate);
  const [totalDescription, setTotalDescription] = useState(openedInvoice?.isTotalMode ? (openedInvoice.items[0]?.description || "") : "");
  const [totalDiscount, setTotalDiscount] = useState(openedInvoice?.isTotalMode ? (openedInvoice.items[0]?.discount || 0) : 0);
  const [totalStockItemId, setTotalStockItemId] = useState<string | undefined>(openedInvoice?.isTotalMode ? openedInvoice.items[0]?.stockItemId : undefined);
  const [inlinePartyName, setInlinePartyName] = useState(openedInvoice && !openedInvoice.partyId ? openedInvoice.partyName : "");
  const [inlinePartyPhone, setInlinePartyPhone] = useState(openedInvoice?.partyPhone || "");
  const [showStockPicker, setShowStockPicker] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [shipToGstin, setShipToGstin] = useState(openedInvoice?.shipToGstin || "");
  const [shipToAddress, setShipToAddress] = useState(openedInvoice?.shipToAddress || "");
  const [shipToStateCode, setShipToStateCode] = useState(
    stateCodeFromPlaceOfSupply(openedInvoice?.placeOfSupply) || ""
  );
  const [reverseCharge, setReverseCharge] = useState(!!openedInvoice?.reverseCharge);
  const [gstinError, setGstinError] = useState("");

  const selectedParty = parties.find((p) => p.id === partyId);
  const businessStateCode = business?.stateCode || "";
  // Hydrating the POS dropdown from a mapped historical name is not a user edit.
  const originalPosCode = openedInvoice
    ? stateCodeFromPlaceOfSupply(openedInvoice.placeOfSupply) || ""
    : "";
  const originalShipGstin = openedInvoice?.shipToGstin || "";
  const originalShipAddress = openedInvoice?.shipToAddress || "";
  const posEdited =
    !!openedInvoice &&
    ((shipToStateCode || "") !== originalPosCode ||
      (shipToGstin || "") !== originalShipGstin ||
      (shipToAddress || "") !== originalShipAddress);
  const preserveStoredTax = !!openedInvoice && !posEdited;
  // Historical walk-ins stored empty party state (treated as IGST on main).
  // Do not fill that with the seller state or an accidental save rewrites the split.
  const partyStateCode = selectedParty?.stateCode || (preserveStoredTax ? "" : businessStateCode);
  const partyAddress = selectedParty
    ? formatPartyAddress(selectedParty)
    : "";
  const resolvedShip = resolveShipTo({
    billToGstin: selectedParty?.gstin || "",
    billToAddress: partyAddress,
    billToStateCode: partyStateCode,
    shipToGstin,
    shipToAddress,
    shipToStateCode,
  });
  const userSetShipTo = !!(shipToGstin.trim() || shipToAddress.trim() || shipToStateCode.trim());
  const placeOfSupply = userSetShipTo
    ? resolvePlaceOfSupply(resolvedShip.shipToStateCode, partyStateCode)
    : stateCodeFromPlaceOfSupply(openedInvoice?.placeOfSupply) ||
      resolvePlaceOfSupply(resolvedShip.shipToStateCode, partyStateCode);
  const computedInterState = isInterState(businessStateCode, placeOfSupply);
  const interState = preserveStoredTax
    ? (openedInvoice?.isInterState ?? computedInterState)
    : computedInterState;

  const totals = useMemo(() => {
    if (isTotalMode) {
      const afterDiscount = round2(totalAmount * (1 - totalDiscount / 100));
      const taxable = round2(afterDiscount / (1 + totalGstRate / 100));
      const tax = round2(afterDiscount - taxable);
      let cgst = 0, sgst = 0, igst = 0;
      if (interState) { igst = tax; } else { cgst = round2(tax / 2); sgst = round2(tax / 2); }
      const grandTotal = data.settings.roundOff ? Math.round(afterDiscount) : afterDiscount;
      const roundOff = round2(grandTotal - afterDiscount);
      const discountAmount = round2(totalAmount - afterDiscount);
      return {
        subtotal: round2(totalAmount),
        totalDiscount: discountAmount,
        totalTaxable: taxable,
        totalCgst: cgst,
        totalSgst: sgst,
        totalIgst: igst,
        totalCess: 0,
        totalTax: tax,
        roundOff,
        grandTotal: round2(grandTotal),
      };
    }
    return calculateInvoiceTotals(items, data.settings.roundOff);
  }, [isTotalMode, totalAmount, totalGstRate, totalDiscount, interState, data.settings.roundOff, items]);

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
        cess: calc.cess ?? 0,
        uqc: item.uqc || item.unit,
        total: calc.total,
      };
      return next;
    });
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem(businessStateCode, placeOfSupply, newInvoiceGstRate)]);
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

  function addStockItemToInvoice(stock: StockItem) {
    if (isTotalMode) {
      setTotalDescription(stock.name);
      setTotalGstRate(stock.gstRate);
      setTotalStockItemId(stock.id);
      if (totalAmount === 0) {
        setTotalAmount(stock.rate);
      }
      return;
    }
    const calc = calculateItem({
      quantity: 1,
      rate: stock.rate,
      discount: 0,
      gstRate: stock.gstRate,
      isInterState: interState,
    });
    const newItem: InvoiceItem = {
      id: generateId(),
      description: stock.name,
      hsn: stock.hsn,
      quantity: 1,
      unit: stock.unit,
      uqc: stock.unit,
      rate: stock.rate,
      discount: 0,
      gstRate: stock.gstRate,
      taxableAmount: calc.taxableAmount,
      cgst: calc.cgst,
      sgst: calc.sgst,
      igst: calc.igst,
      cess: calc.cess ?? 0,
      total: calc.total,
      stockItemId: stock.id,
    };
    setItems((prev) => [...prev, newItem]);
  }

  function handleScanBarcode() {
    if (!("BarcodeDetector" in window)) {
      alert("Barcode scanning is not supported on this device/browser. Try using Chrome on Android.");
      return;
    }
    setShowScanner(true);
  }

  function applyPartyShipTo(nextPartyId: string) {
    setPartyId(nextPartyId);
    const p = parties.find((x) => x.id === nextPartyId);
    if (!p) {
      setShipToGstin("");
      setShipToAddress("");
      setShipToStateCode("");
      return;
    }
    const ship = resolveShipTo({
      billToGstin: p.gstin,
      billToAddress: formatPartyAddress(p),
      billToStateCode: p.stateCode,
      shipToGstin: p.shipToGstin,
      shipToAddress: p.shipToAddress,
      shipToStateCode: p.shipToStateCode,
    });
    const partyHasShipTo = !!(p.shipToGstin || p.shipToAddress || p.shipToStateCode);
    setShipToGstin(partyHasShipTo ? ship.shipToGstin : "");
    setShipToAddress(partyHasShipTo ? ship.shipToAddress : "");
    setShipToStateCode(partyHasShipTo ? ship.shipToStateCode : "");
  }

  function handleSave() {
    if (!business) {
      alert("Please set up your business profile first in Settings.");
      return;
    }

    const party = partyId ? parties.find((p) => p.id === partyId) : null;
    const billToGstin = party?.gstin || "";
    const billCheck = validateGstin(billToGstin);
    if (!billCheck.ok) {
      setGstinError(billCheck.error);
      alert(billCheck.error);
      return;
    }
    const shipCheck = validateGstin(shipToGstin);
    if (!shipCheck.ok) {
      setGstinError(shipCheck.error);
      alert(shipCheck.error);
      return;
    }
    setGstinError("");

    if (isTotalMode) {
      if (totalAmount <= 0) {
        alert("Please enter a total amount.");
        return;
      }
    } else {
      if (items.length === 0 || items.every((i) => !i.description)) {
        alert("Please add at least one item.");
        return;
      }
    }

    const invoiceNumber = editingInvoice?.invoiceNumber || generateInvoiceNumber(
      data.invoiceCounter,
      data.settings.invoicePrefix,
      data.settings.invoiceSuffix
    );

    let invoiceItems: InvoiceItem[];
    if (isTotalMode) {
      const afterDiscount = round2(totalAmount * (1 - totalDiscount / 100));
      const taxable = round2(afterDiscount / (1 + totalGstRate / 100));
      const tax = round2(afterDiscount - taxable);
      let cgst = 0, sgst = 0, igst = 0;
      if (interState) { igst = tax; } else { cgst = round2(tax / 2); sgst = round2(tax / 2); }
      invoiceItems = [{
        id: generateId(),
        description: totalDescription || "Total Amount",
        hsn: "",
        quantity: 1,
        unit: "NOS",
        uqc: "NOS",
        rate: totalAmount,
        discount: totalDiscount,
        gstRate: totalGstRate,
        taxableAmount: taxable,
        cgst,
        sgst,
        igst,
        cess: 0,
        total: round2(afterDiscount),
        stockItemId: totalStockItemId,
      }];
    } else {
      invoiceItems = items.filter((i) => i.description).map((i) => ({
        ...i,
        uqc: i.uqc || i.unit,
        cess: i.cess ?? 0,
      }));
    }

    const invoice = buildInvoiceDocument({
      id: editingInvoice?.id || generateId(),
      invoiceNumber,
      type: invoiceType,
      status,
      businessId: business.id,
      sellerGstin: business.gstin || "",
      sellerStateCode: business.stateCode || "",
      partyId: party?.id || "",
      partyName: party?.name || inlinePartyName || "",
      partyGstin: billToGstin,
      partyPhone: party?.phone || inlinePartyPhone || "",
      partyAddress: party ? formatPartyAddress(party) : "",
      partyStateCode: party?.stateCode || (preserveStoredTax ? "" : business.stateCode || ""),
      shipToGstin,
      shipToAddress,
      shipToStateCode,
      placeOfSupply: openedInvoice?.placeOfSupply,
      preserveStoredTax,
      storedIsInterState: openedInvoice?.isInterState,
      date,
      dueDate: dueDateVal,
      items: invoiceItems,
      roundOffEnabled: data.settings.roundOff,
      paidAmount,
      paymentMode,
      notes,
      terms,
      reverseCharge,
      isTotalMode,
      createdAt: editingInvoice?.createdAt || new Date().toISOString(),
    });

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
            <select
              value={partyId}
              onChange={(e) => applyPartyShipTo(e.target.value)}
              className="w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-starlight outline-none focus:border-mercury-blue"
            >
              <option value="">No Party (Walk-in customer)</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.gstin ? `(${p.gstin})` : ""}
                </option>
              ))}
            </select>
            {selectedParty ? (
              <div className="mt-3 rounded-lg bg-graphite p-3 text-sm text-silver">
                <p className="text-starlight">{selectedParty.name}</p>
                <p>{selectedParty.address}</p>
                <p>{selectedParty.city}, {selectedParty.state} - {selectedParty.pincode}</p>
                <p>GSTIN: {selectedParty.gstin || "URP (Unregistered)"}</p>
                <p className="mt-1 text-xs text-mercury-blue">
                  Place of supply: {placeOfSupply || "—"} · {interState ? "Inter-state (IGST applies)" : "Intra-state (CGST + SGST applies)"}
                </p>
              </div>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm text-silver">
                  Customer Name (optional)
                  <input
                    type="text"
                    value={inlinePartyName}
                    onChange={(e) => setInlinePartyName(e.target.value)}
                    placeholder="Walk-in customer name"
                    className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-sm text-starlight outline-none focus:border-mercury-blue"
                  />
                </label>
                <label className="block text-sm text-silver">
                  Phone Number (optional)
                  <input
                    type="tel"
                    value={inlinePartyPhone}
                    onChange={(e) => setInlinePartyPhone(e.target.value)}
                    placeholder="Phone number"
                    className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-sm text-starlight outline-none focus:border-mercury-blue"
                  />
                </label>
              </div>
            )}
            {gstinError ? <p className="mt-2 text-xs text-red-400">{gstinError}</p> : null}
          </div>

          <div className="rounded-lg border border-lead/20 bg-midnight p-5">
            <h2 className="mb-1 text-lg text-starlight">Ship To</h2>
            <p className="mb-4 text-xs text-silver">Optional. Leave blank to copy bill-to. Use URP if the ship-to party is unregistered.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-silver">
                Ship-to GSTIN
                <input
                  type="text"
                  value={shipToGstin}
                  onChange={(e) => setShipToGstin(e.target.value.toUpperCase())}
                  placeholder="Same as bill-to, or URP"
                  className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-sm text-starlight outline-none focus:border-mercury-blue"
                />
              </label>
              <label className="block text-sm text-silver">
                Ship-to state (place of supply)
                <select
                  value={shipToStateCode}
                  onChange={(e) => setShipToStateCode(e.target.value)}
                  className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-sm text-starlight outline-none focus:border-mercury-blue"
                >
                  <option value="">Same as bill-to</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-silver sm:col-span-2">
                Ship-to address
                <input
                  type="text"
                  value={shipToAddress}
                  onChange={(e) => setShipToAddress(e.target.value)}
                  placeholder="Leave blank to copy bill-to address"
                  className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-sm text-starlight outline-none focus:border-mercury-blue"
                />
              </label>
            </div>
            <p className="mt-3 text-xs text-mercury-blue">
              {interState ? "Inter-state (IGST)" : "Intra-state (CGST + SGST)"} · POS {placeOfSupply || "—"}
              {resolvedShip.shipToGstin ? ` · Ship-to GSTIN ${resolvedShip.shipToGstin}` : ""}
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm text-silver">
              <input
                type="checkbox"
                checked={reverseCharge}
                onChange={(e) => setReverseCharge(e.target.checked)}
              />
              Reverse charge
            </label>
          </div>

          <div className="rounded-lg border border-lead/20 bg-midnight p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg text-starlight">Items</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setIsTotalMode(!isTotalMode)}
                  className="rounded-btn border border-lead/30 bg-graphite px-3 py-1.5 text-xs text-silver hover:border-mercury-blue"
                >
                  {isTotalMode ? "Switch to Itemized" : "Switch to Total Mode"}
                </button>
                <button onClick={() => setShowStockPicker(true)} className="btn-secondary !py-2" disabled={data.stock.length === 0}>
                  <Package className="mr-1 h-4 w-4" /> Inventory
                </button>
                <button onClick={handleScanBarcode} className="btn-secondary !py-2">
                  <ScanLine className="mr-1 h-4 w-4" /> Scan
                </button>
                {!isTotalMode && (
                  <button onClick={addItem} className="btn-secondary !py-2">
                    <Plus className="mr-1 h-4 w-4" /> Add Item
                  </button>
                )}
              </div>
            </div>

            {isTotalMode ? (
              <div className="rounded-lg bg-graphite p-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="sm:col-span-4">
                    <label className="text-xs text-silver">Description (optional)</label>
                    <input
                      type="text"
                      value={totalDescription}
                      onChange={(e) => setTotalDescription(e.target.value)}
                      placeholder="What is this invoice for?"
                      className="mt-1 w-full rounded-btn border border-lead/30 bg-abyss px-3 py-2 text-sm text-starlight outline-none focus:border-mercury-blue"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-silver">Total Amount (₹)</label>
                    <input
                      type="number"
                      value={totalAmount || ""}
                      onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                      placeholder="Enter total including GST"
                      className="mt-1 w-full rounded-btn border border-lead/30 bg-abyss px-3 py-2 text-sm text-starlight outline-none focus:border-mercury-blue"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-silver">GST Rate</label>
                    <select
                      value={totalGstRate}
                      onChange={(e) => setTotalGstRate(parseFloat(e.target.value) as GSTRate)}
                      className="mt-1 w-full rounded-btn border border-lead/30 bg-abyss px-2 py-2 text-sm text-starlight outline-none focus:border-mercury-blue"
                    >
                      {gstRatePickerOptions(totalGstRate).map((r) => <option key={r} value={r}>{gstRateLabel(r)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-silver">Discount %</label>
                    <input
                      type="number"
                      value={totalDiscount || ""}
                      onChange={(e) => setTotalDiscount(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      min="0"
                      max="100"
                      className="mt-1 w-full rounded-btn border border-lead/30 bg-abyss px-3 py-2 text-sm text-starlight outline-none focus:border-mercury-blue"
                    />
                  </div>
                </div>
                {totalAmount > 0 && (
                  <div className="mt-3 rounded-lg bg-abyss p-3 text-sm text-silver">
                    {totalDiscount > 0 && (
                      <div className="flex justify-between"><span>After Discount:</span><span>{formatCurrency(round2(totalAmount * (1 - totalDiscount / 100)))}</span></div>
                    )}
                    <div className="flex justify-between"><span>Taxable Amount:</span><span>{formatCurrency(round2(totalAmount * (1 - totalDiscount / 100) / (1 + totalGstRate / 100)))}</span></div>
                    <div className="flex justify-between"><span>GST ({totalGstRate}%):</span><span>{formatCurrency(round2(totalAmount * (1 - totalDiscount / 100) - totalAmount * (1 - totalDiscount / 100) / (1 + totalGstRate / 100)))}</span></div>
                    <div className="flex justify-between font-medium text-starlight"><span>Grand Total:</span><span>{formatCurrency(round2(totalAmount * (1 - totalDiscount / 100)))}</span></div>
                  </div>
                )}
              </div>
            ) : (
              <>
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
                        {gstRatePickerOptions(item.gstRate).map((r) => <option key={r} value={r}>{gstRateLabel(r)}</option>)}
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
              </>
            )}
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
              {totals.totalCess > 0 && (
                <div className="flex justify-between text-silver">
                  <span>Cess</span>
                  <span>{formatCurrency(totals.totalCess)}</span>
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

      {showStockPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowStockPicker(false)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg bg-midnight p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg text-starlight">Pick from Inventory</h3>
              <button onClick={() => setShowStockPicker(false)} className="rounded p-1 text-silver hover:text-starlight">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2">
              {data.stock.map((stock) => (
                <button
                  key={stock.id}
                  onClick={() => { addStockItemToInvoice(stock); setShowStockPicker(false); }}
                  className="flex w-full items-center justify-between rounded-lg bg-graphite p-3 text-left hover:border-mercury-blue"
                >
                  <div>
                    <p className="text-sm text-starlight">{stock.name}</p>
                    <p className="text-xs text-silver">HSN: {stock.hsn} | Stock: {stock.currentStock} {stock.unit}</p>
                  </div>
                  <span className="text-sm text-mercury-blue">{formatCurrency(stock.rate)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showScanner && (
        <BarcodeScannerModal
          onClose={() => setShowScanner(false)}
          onDetected={(code) => {
            const stockItem = data.stock.find((s) => s.barcode === code);
            if (stockItem) {
              addStockItemToInvoice(stockItem);
              setShowScanner(false);
            } else {
              alert(`No inventory item found for barcode: ${code}`);
            }
          }}
        />
      )}
    </div>
  );
}

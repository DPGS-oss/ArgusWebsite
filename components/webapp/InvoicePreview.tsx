"use client";

import { ArrowLeft, Download, FileJson, FileText, Edit } from "lucide-react";
import type { AppData, BusinessProfile, Invoice } from "@/lib/types";
import { formatCurrency, formatDate, generateInvoiceHTML } from "@/lib/gst";
import { saveInvoiceToFile, saveInvoiceAsHTML, downloadInvoiceFile, downloadInvoiceHTML, isUsingFileSystem } from "@/lib/storage";

type InvoicePreviewProps = {
  invoice: Invoice;
  business: BusinessProfile | null;
  onBack: () => void;
  onEdit: (invoice: Invoice) => void;
};

export function InvoicePreview({ invoice, business, onBack, onEdit }: InvoicePreviewProps) {
  async function handleSaveJSON() {
    if (!business) return;
    if (isUsingFileSystem()) {
      await saveInvoiceToFile(invoice, business.name);
      alert(`Invoice saved to folder as ${invoice.invoiceNumber}.json`);
    } else {
      downloadInvoiceFile(invoice, business.name);
    }
  }

  async function handleSaveHTML() {
    if (!business) return;
    const html = generateInvoiceHTML(invoice, business);
    if (isUsingFileSystem()) {
      await saveInvoiceAsHTML(invoice, business.name, html);
      alert(`Invoice saved to folder as ${invoice.invoiceNumber}.html`);
    } else {
      downloadInvoiceHTML(invoice, business.name, html);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="rounded-lg p-2 text-silver hover:bg-graphite hover:text-starlight">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl text-starlight">{invoice.invoiceNumber}</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onEdit(invoice)} className="btn-secondary !py-2">
            <Edit className="mr-1 h-4 w-4" /> Edit
          </button>
          <button onClick={handleSaveJSON} className="btn-secondary !py-2">
            <FileJson className="mr-1 h-4 w-4" /> JSON
          </button>
          <button onClick={handleSaveHTML} className="btn-primary !py-2">
            <FileText className="mr-1 h-4 w-4" /> Save HTML
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-lead/20 bg-white p-8 text-gray-800">
        <div className="mb-6 flex justify-between border-b-2 border-[#5266eb] pb-4">
          <div>
            <h1 className="text-2xl font-bold text-[#5266eb]">Argus</h1>
            {business && (
              <>
                <h2 className="text-lg font-semibold">{business.name}</h2>
                <p className="text-sm text-gray-600">
                  {business.address}<br />
                  {business.city}, {business.state} - {business.pincode}<br />
                  GSTIN: {business.gstin}<br />
                  {business.phone} | {business.email}
                </p>
              </>
            )}
          </div>
          <div className="text-right">
            <h3 className="text-xl font-bold text-[#5266eb]">{invoice.invoiceNumber}</h3>
            <p className="text-sm text-gray-600">Type: {invoice.type.replace(/_/g, " ").toUpperCase()}</p>
            <p className="text-sm text-gray-600">Date: {formatDate(invoice.date)}</p>
            <p className="text-sm text-gray-600">Due: {formatDate(invoice.dueDate)}</p>
            <span className={`mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-bold uppercase ${
              invoice.status === "paid" ? "bg-green-100 text-green-700" :
              invoice.status === "unpaid" ? "bg-red-100 text-red-700" :
              "bg-gray-100 text-gray-600"
            }`}>
              {invoice.status}
            </span>
          </div>
        </div>

        <div className="mb-6">
          <h4 className="mb-1 text-xs uppercase text-gray-400">Bill To</h4>
          <p className="font-semibold">{invoice.partyName}</p>
          <p className="text-sm text-gray-600">GSTIN: {invoice.partyGstin || "Unregistered"}</p>
          <p className="text-sm text-gray-600">Place of Supply: {invoice.placeOfSupply}</p>
        </div>

        <table className="mb-6 w-full text-sm">
          <thead>
            <tr className="bg-[#5266eb] text-white">
              <th className="p-2 text-left">Description</th>
              <th className="p-2 text-center">HSN</th>
              <th className="p-2 text-right">Qty</th>
              <th className="p-2 text-right">Rate</th>
              <th className="p-2 text-right">Disc%</th>
              <th className="p-2 text-right">Taxable</th>
              <th className="p-2 text-center">GST%</th>
              {invoice.isInterState ? (
                <th className="p-2 text-right">IGST</th>
              ) : (
                <>
                  <th className="p-2 text-right">CGST</th>
                  <th className="p-2 text-right">SGST</th>
                </>
              )}
              <th className="p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="p-2">{item.description}</td>
                <td className="p-2 text-center">{item.hsn}</td>
                <td className="p-2 text-right">{item.quantity} {item.unit}</td>
                <td className="p-2 text-right">{formatCurrency(item.rate)}</td>
                <td className="p-2 text-right">{item.discount}%</td>
                <td className="p-2 text-right">{formatCurrency(item.taxableAmount)}</td>
                <td className="p-2 text-center">{item.gstRate}%</td>
                {invoice.isInterState ? (
                  <td className="p-2 text-right">{formatCurrency(item.igst)}</td>
                ) : (
                  <>
                    <td className="p-2 text-right">{formatCurrency(item.cgst)}</td>
                    <td className="p-2 text-right">{formatCurrency(item.sgst)}</td>
                  </>
                )}
                <td className="p-2 text-right font-semibold">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto w-72">
          <table className="w-full text-sm">
            <tbody>
              <tr><td className="py-1 text-gray-600">Subtotal</td><td className="py-1 text-right">{formatCurrency(invoice.subtotal)}</td></tr>
              {invoice.totalDiscount > 0 && (
                <tr><td className="py-1 text-gray-600">Discount</td><td className="py-1 text-right">-{formatCurrency(invoice.totalDiscount)}</td></tr>
              )}
              <tr><td className="py-1 text-gray-600">Taxable Amount</td><td className="py-1 text-right">{formatCurrency(invoice.totalTaxable)}</td></tr>
              {invoice.totalCgst > 0 && (
                <tr><td className="py-1 text-gray-600">CGST</td><td className="py-1 text-right">{formatCurrency(invoice.totalCgst)}</td></tr>
              )}
              {invoice.totalSgst > 0 && (
                <tr><td className="py-1 text-gray-600">SGST</td><td className="py-1 text-right">{formatCurrency(invoice.totalSgst)}</td></tr>
              )}
              {invoice.totalIgst > 0 && (
                <tr><td className="py-1 text-gray-600">IGST</td><td className="py-1 text-right">{formatCurrency(invoice.totalIgst)}</td></tr>
              )}
              {invoice.roundOff !== 0 && (
                <tr><td className="py-1 text-gray-600">Round Off</td><td className="py-1 text-right">{formatCurrency(invoice.roundOff)}</td></tr>
              )}
              <tr className="bg-[#5266eb] text-white">
                <td className="py-2 font-bold">Grand Total</td>
                <td className="py-2 text-right font-bold">{formatCurrency(invoice.grandTotal)}</td>
              </tr>
              {invoice.paidAmount > 0 && (
                <tr><td className="py-1 text-gray-600">Paid</td><td className="py-1 text-right">{formatCurrency(invoice.paidAmount)}</td></tr>
              )}
              {invoice.balanceDue > 0 && (
                <tr><td className="py-1 font-semibold text-gray-700">Balance Due</td><td className="py-1 text-right font-semibold text-red-600">{formatCurrency(invoice.balanceDue)}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {business?.bankName && (
          <div className="mt-6 rounded-lg bg-gray-50 p-4">
            <h4 className="mb-2 text-sm font-semibold">Bank Details</h4>
            <p className="text-xs text-gray-600">
              Bank: {business.bankName} | Account: {business.bankAccount} | IFSC: {business.bankIfsc}
              {business.upiId && ` | UPI: ${business.upiId}`}
            </p>
          </div>
        )}

        {invoice.notes && (
          <div className="mt-4 text-xs text-gray-600"><strong>Notes:</strong> {invoice.notes}</div>
        )}
        {invoice.terms && (
          <div className="mt-1 text-xs text-gray-600"><strong>Terms:</strong> {invoice.terms}</div>
        )}

        <div className="mt-6 border-t border-gray-200 pt-4 text-center text-xs text-gray-400">
          <p>This is a computer-generated invoice from Argus GST Billing App</p>
          <p>© {new Date().getFullYear()} {business?.name}</p>
        </div>
      </div>
    </div>
  );
}

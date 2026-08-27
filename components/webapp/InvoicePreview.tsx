"use client";

import { useState } from "react";
import { ArrowLeft, FileJson, FileText, Edit, FileDown } from "lucide-react";
import { useAuth } from "@/lib/auth-provider";
import type { BusinessProfile, Invoice } from "@/lib/types";
import { formatCurrency, formatDate, generateInvoiceHTML } from "@/lib/gst";
import { saveInvoiceToFile, saveInvoiceAsHTML, saveInvoiceAsPDF, downloadInvoiceFile, downloadInvoiceHTML, downloadInvoicePDF, isUsingFileSystem } from "@/lib/storage";
import { InvoiceShareActions } from "./InvoiceShareActions";

type InvoicePreviewProps = {
  invoice: Invoice;
  business: BusinessProfile | null;
  onBack: () => void;
  onEdit: (invoice: Invoice) => void;
  onAddUpi?: () => void;
};

export function InvoicePreview({ invoice, business, onBack, onEdit, onAddUpi }: InvoicePreviewProps) {
  const { token, firebaseUser } = useAuth();
  const [savingPDF, setSavingPDF] = useState(false);
  const [savingEinvoice, setSavingEinvoice] = useState(false);

  async function handleDownloadEinvoice() {
    if (!token || !firebaseUser) {
      alert("Sign in with a Business account to download NIC e-invoice JSON.");
      return;
    }
    setSavingEinvoice(true);
    try {
      const r = await fetch(
        `/api/ca/clients/${encodeURIComponent(firebaseUser.uid)}/einvoice?invoice=${encodeURIComponent(invoice.invoiceNumber)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error || `Download failed (${r.status})`);
      }
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `EInvoice_${invoice.invoiceNumber}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not download e-invoice JSON.");
    } finally {
      setSavingEinvoice(false);
    }
  }

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

  async function handleSavePDF() {
    if (!business) return;
    setSavingPDF(true);
    try {
      const pdfBlob = await generatePDFBlob(invoice, business);
      if (isUsingFileSystem()) {
        await saveInvoiceAsPDF(invoice, business.name, pdfBlob);
        alert(`Invoice saved to folder as ${invoice.invoiceNumber}.pdf`);
      } else {
        downloadInvoicePDF(invoice, business.name, pdfBlob);
      }
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("Failed to generate PDF. Try using Print instead.");
    } finally {
      setSavingPDF(false);
    }
  }

  async function generatePDFBlob(inv: Invoice, biz: BusinessProfile): Promise<Blob> {
    const html = generateInvoiceHTML(inv, biz);
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.innerHTML = html;
    document.body.appendChild(container);
    const invoiceEl = container.querySelector(".invoice") as HTMLElement;
    const { jsPDF } = await import("jspdf");
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(invoiceEl, { scale: 2, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    const pdfBlob = pdf.output("blob");
    document.body.removeChild(container);
    return pdfBlob;
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
        <div className="flex flex-wrap gap-2">
          <InvoiceShareActions
            invoice={invoice}
            business={business}
            onAddUpi={onAddUpi}
            preparingPdf={savingPDF}
            onPreparePdf={
              business
                ? async () => {
                    setSavingPDF(true);
                    try {
                      const pdfBlob = await generatePDFBlob(invoice, business);
                      return new File([pdfBlob], `${invoice.invoiceNumber}.pdf`, {
                        type: "application/pdf",
                      });
                    } finally {
                      setSavingPDF(false);
                    }
                  }
                : undefined
            }
          />
          <button onClick={() => onEdit(invoice)} className="btn-secondary !py-2">
            <Edit className="mr-1 h-4 w-4" /> Edit
          </button>
          <button onClick={handleSavePDF} disabled={savingPDF} className="btn-secondary !py-2 disabled:opacity-50">
            <FileDown className="mr-1 h-4 w-4" /> {savingPDF ? "Generating..." : "PDF"}
          </button>
          <button onClick={handleDownloadEinvoice} disabled={savingEinvoice} className="btn-secondary !py-2 disabled:opacity-50">
            <FileJson className="mr-1 h-4 w-4" /> {savingEinvoice ? "Preparing..." : "Download e-invoice JSON"}
          </button>
          <button onClick={handleSaveJSON} className="btn-secondary !py-2">
            <FileJson className="mr-1 h-4 w-4" /> JSON
          </button>
          <button onClick={handleSaveHTML} className="btn-secondary !py-2">
            <FileText className="mr-1 h-4 w-4" /> HTML
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
            <p className="text-sm text-gray-600">Type: {invoice.type.replace(/_/g, " ").toUpperCase()}{invoice.documentType ? ` (${invoice.documentType})` : ""}</p>
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

        <div className="mb-6 grid gap-6 sm:grid-cols-2">
          <div>
            <h4 className="mb-1 text-xs uppercase text-gray-400">Bill To</h4>
            <p className="font-semibold">{invoice.partyName || "—"}</p>
            {invoice.partyPhone && <p className="text-sm text-gray-600">Phone: {invoice.partyPhone}</p>}
            <p className="text-sm text-gray-600">GSTIN: {invoice.partyGstin === "URP" || !invoice.partyGstin ? "URP (Unregistered)" : invoice.partyGstin}</p>
            <p className="text-sm text-gray-600">Place of Supply: {invoice.placeOfSupply}</p>
            {invoice.documentType && <p className="text-sm text-gray-600">Document: {invoice.documentType}</p>}
            {invoice.reverseCharge && <p className="text-sm text-gray-600">Reverse Charge: Yes</p>}
          </div>
          {(invoice.shipToAddress || (invoice.shipToGstin && invoice.shipToGstin !== invoice.partyGstin)) && (
            <div>
              <h4 className="mb-1 text-xs uppercase text-gray-400">Ship To</h4>
              {invoice.shipToAddress && <p className="text-sm text-gray-600">{invoice.shipToAddress}</p>}
              <p className="text-sm text-gray-600">GSTIN: {invoice.shipToGstin === "URP" ? "URP (Unregistered)" : (invoice.shipToGstin || invoice.partyGstin)}</p>
            </div>
          )}
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
                <td className="p-2 text-right">{item.quantity} {item.uqc || item.unit}</td>
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
              {(invoice.totalCess || 0) > 0 && (
                <tr><td className="py-1 text-gray-600">Cess</td><td className="py-1 text-right">{formatCurrency(invoice.totalCess || 0)}</td></tr>
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

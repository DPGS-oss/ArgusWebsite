"use client";

import { MessageCircle, IndianRupee } from "lucide-react";
import type { BusinessProfile, Invoice } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/gst";
import { buildUpiPayUri, buildWhatsAppInvoiceText, buildWhatsAppShareUrl } from "@/lib/upi";

export function invoiceCollectAmount(invoice: Invoice): number {
  return invoice.balanceDue > 0 ? invoice.balanceDue : invoice.grandTotal;
}

type InvoiceShareActionsProps = {
  invoice: Invoice;
  business: BusinessProfile | null;
  onAddUpi?: () => void;
  compact?: boolean;
  preparingPdf?: boolean;
  onPreparePdf?: () => Promise<File | null>;
};

export function InvoiceShareActions({
  invoice,
  business,
  onAddUpi,
  compact,
  preparingPdf,
  onPreparePdf,
}: InvoiceShareActionsProps) {
  const upiUri = buildUpiPayUri({
    vpa: business?.upiId,
    amount: invoiceCollectAmount(invoice),
    invoiceNumber: invoice.invoiceNumber,
  });

  function promptAddUpi() {
    alert("Add a UPI ID on your business profile to collect payment.");
    onAddUpi?.();
  }

  function handleCollectUpi() {
    if (!upiUri) {
      promptAddUpi();
      return;
    }
    window.location.href = upiUri;
  }

  async function handleWhatsApp() {
    if (!business) return;

    const itemSummary = invoice.items
      .map((i) => `• ${i.description} - ${i.quantity} ${i.unit} @ ${formatCurrency(i.rate)}`)
      .join("\n");
    const extraLines = [
      `*Date:* ${formatDate(invoice.date)}`,
      `*Due:* ${formatDate(invoice.dueDate)}`,
      "",
      "*Items:*",
      itemSummary,
      "",
      `*Subtotal:* ${formatCurrency(invoice.subtotal)}`,
      invoice.totalDiscount > 0 ? `*Discount:* -${formatCurrency(invoice.totalDiscount)}` : "",
      `*Taxable:* ${formatCurrency(invoice.totalTaxable)}`,
      invoice.totalCgst > 0 ? `*CGST:* ${formatCurrency(invoice.totalCgst)}` : "",
      invoice.totalSgst > 0 ? `*SGST:* ${formatCurrency(invoice.totalSgst)}` : "",
      invoice.totalIgst > 0 ? `*IGST:* ${formatCurrency(invoice.totalIgst)}` : "",
      invoice.balanceDue > 0 ? `*Balance Due:* ${formatCurrency(invoice.balanceDue)}` : "",
    ]
      .filter((line) => line !== "")
      .join("\n");

    const message = buildWhatsAppInvoiceText({
      invoiceNumber: invoice.invoiceNumber,
      businessName: business.name,
      grandTotalLabel: formatCurrency(invoice.grandTotal),
      upiUri,
      extraLines,
    });

    if (onPreparePdf && typeof navigator !== "undefined" && navigator.canShare) {
      try {
        const probe = new File([""], "invoice.pdf", { type: "application/pdf" });
        if (navigator.canShare({ files: [probe] })) {
          const file = await onPreparePdf();
          if (file && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `Invoice ${invoice.invoiceNumber}`,
              text: message,
              files: [file],
            });
            return;
          }
        }
      } catch (err) {
        console.log("Web Share failed, falling back to URL:", err);
      }
    }

    window.open(buildWhatsAppShareUrl(invoice.partyPhone, message), "_blank");
  }

  if (compact) {
    return (
      <div className="flex gap-1">
        <button
          type="button"
          onClick={handleWhatsApp}
          className="rounded p-1.5 text-emerald-400 hover:bg-graphite"
          title="WhatsApp"
        >
          <MessageCircle className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleCollectUpi}
          className="rounded p-1.5 text-amber-300 hover:bg-graphite"
          title="Collect UPI"
        >
          <IndianRupee className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleWhatsApp}
        disabled={preparingPdf}
        className="btn-primary !bg-green-600 !py-2 hover:!bg-green-700 disabled:opacity-50"
      >
        <MessageCircle className="mr-1 h-4 w-4" /> {preparingPdf ? "Preparing..." : "WhatsApp"}
      </button>
      <button type="button" onClick={handleCollectUpi} className="btn-primary !py-2">
        <IndianRupee className="mr-1 h-4 w-4" /> Collect UPI
      </button>
    </>
  );
}

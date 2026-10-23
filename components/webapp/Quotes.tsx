"use client";

import { FileSignature, Plus, Receipt, Trash2 } from "lucide-react";
import type { AppData, Quote } from "@/lib/types";
import { saveQuote, deleteQuote } from "@/lib/storage";
import { formatCurrency } from "@/lib/gst";

type Props = {
  data: AppData;
  onSaved: () => void;
  /** Opens the bill form to write a quotation (items, GST, validity). */
  onNewQuote: () => void;
  /** Opens a new bill with the quote's customer and items. */
  onMakeBill: (quote: Quote) => void;
};

export function Quotes({ data, onSaved, onNewQuote, onMakeBill }: Props) {
  const quotes = [...(data.quotes ?? [])].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  function setStatus(q: Quote, status: string) {
    saveQuote({ ...q, status, updatedAt: new Date().toISOString() });
    onSaved();
  }

  function handleDelete(id: string) {
    if (confirm("Delete this quote?")) {
      deleteQuote(id);
      onSaved();
    }
  }

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    sent: "bg-blue-100 text-blue-700",
    accepted: "bg-green-100 text-green-700",
    invoiced: "bg-emerald-100 text-emerald-800",
    rejected: "bg-red-100 text-red-700",
    expired: "bg-amber-100 text-amber-700",
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Quotes</h1>
          <p className="text-sm text-slate">Send a price quote; when the customer agrees, make the bill from it in one step.</p>
        </div>
        <button onClick={onNewQuote} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> New quote
        </button>
      </div>

      {quotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-bone py-16 text-center">
          <FileSignature className="mb-3 h-10 w-10 text-ash" />
          <p className="text-slate">No quotes yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map((q) => {
            const expired = !!q.validUntil && q.validUntil < new Date().toISOString().slice(0, 10) && ["draft", "sent"].includes(q.status);
            const status = expired ? "expired" : q.status;
            return (
              <div key={q.id} className="flex flex-col gap-3 rounded-xl border border-bone bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-semibold text-ink">{q.quoteNumber}</div>
                  <div className="text-sm text-slate">{q.customerName || "Walk-in"} · {(q.items || []).length} item{(q.items || []).length === 1 ? "" : "s"}</div>
                  <div className="text-xs text-ash">
                    {new Date(q.createdAt).toLocaleDateString()}
                    {q.validUntil ? ` · Valid until ${new Date(q.validUntil).toLocaleDateString()}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs ${statusColors[status] ?? "bg-gray-100 text-gray-700"}`}>{status}</span>
                  <div className="text-right font-semibold text-ink">{formatCurrency(q.totalAmount || 0)}</div>
                  {q.status !== "invoiced" && (q.items || []).length > 0 ? (
                    <button onClick={() => onMakeBill(q)} className="btn-primary flex items-center gap-1 !px-3 !py-1.5 text-xs" title="Make the bill from this quote">
                      <Receipt className="h-3.5 w-3.5" /> Make bill
                    </button>
                  ) : null}
                  {["draft", "sent"].includes(q.status) ? (
                    <>
                      <button onClick={() => setStatus(q, "accepted")} className="rounded-lg px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50">Accepted</button>
                      <button onClick={() => setStatus(q, "rejected")} className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50">Rejected</button>
                    </>
                  ) : null}
                  <button onClick={() => handleDelete(q.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50" title="Delete quote">
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

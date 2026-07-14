"use client";

import { useState } from "react";
import { Search, Plus, Eye, Edit, Trash2, FileText } from "lucide-react";
import type { AppData, Invoice, InvoiceStatus } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/gst";

type InvoiceListProps = {
  data: AppData;
  onNew: () => void;
  onEdit: (invoice: Invoice) => void;
  onPreview: (invoice: Invoice) => void;
  onDelete: (id: string) => void;
};

const statusFilters: { value: InvoiceStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "unpaid", label: "Unpaid" },
  { value: "draft", label: "Draft" },
  { value: "cancelled", label: "Cancelled" },
];

export function InvoiceList({ data, onNew, onEdit, onPreview, onDelete }: InvoiceListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");

  const invoices = data.invoices
    .filter((i) => i.businessId === data.activeBusinessId)
    .filter((i) => statusFilter === "all" || i.status === statusFilter)
    .filter(
      (i) =>
        !search ||
        i.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
        i.partyName.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl text-starlight">Invoices</h1>
        <button onClick={onNew} className="btn-primary">
          <Plus className="mr-1 h-4 w-4" /> New Invoice
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lead" />
          <input
            type="text"
            placeholder="Search by invoice number or party..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-btn border border-lead/30 bg-graphite py-2.5 pl-10 pr-4 text-sm text-starlight outline-none focus:border-mercury-blue"
          />
        </div>
        <div className="flex gap-1 rounded-btn bg-graphite p-1">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-btn px-3 py-1.5 text-xs ${
                statusFilter === f.value
                  ? "bg-mercury-blue text-white"
                  : "text-silver hover:text-starlight"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-lg border border-lead/20 bg-midnight py-16 text-center">
          <FileText className="mx-auto mb-3 h-12 w-12 text-lead" />
          <p className="text-silver">No invoices found. Create one to get started!</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-lead/20 bg-midnight">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-lead/20 text-left text-silver">
                <th className="p-4">Invoice #</th>
                <th className="p-4">Party</th>
                <th className="p-4">Date</th>
                <th className="p-4">Type</th>
                <th className="p-4 text-right">Amount</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-lead/10 hover:bg-graphite/50">
                  <td className="p-4 text-starlight">{inv.invoiceNumber}</td>
                  <td className="p-4 text-silver">{inv.partyName}</td>
                  <td className="p-4 text-silver">{formatDate(inv.date)}</td>
                  <td className="p-4 text-silver">{inv.type.replace(/_/g, " ")}</td>
                  <td className="p-4 text-right text-starlight">{formatCurrency(inv.grandTotal)}</td>
                  <td className="p-4">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                        inv.status === "paid"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : inv.status === "unpaid"
                          ? "bg-amber-500/20 text-amber-300"
                          : inv.status === "cancelled"
                          ? "bg-red-500/20 text-red-300"
                          : "bg-lead/20 text-silver"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onPreview(inv)}
                        className="rounded p-1.5 text-silver hover:bg-graphite hover:text-mercury-blue"
                        title="Preview"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onEdit(inv)}
                        className="rounded p-1.5 text-silver hover:bg-graphite hover:text-mercury-blue"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete invoice ${inv.invoiceNumber}?`)) onDelete(inv.id);
                        }}
                        className="rounded p-1.5 text-silver hover:bg-graphite hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

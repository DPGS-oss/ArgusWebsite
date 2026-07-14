"use client";

import { TrendingUp, FileText, Users, IndianRupee, Clock, CheckCircle2 } from "lucide-react";
import type { AppData, BusinessProfile, Invoice } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/gst";

type DashboardProps = {
  data: AppData;
  business: BusinessProfile | null;
  onNavigate: (view: any) => void;
  onEditInvoice: (invoice: Invoice) => void;
};

export function Dashboard({ data, business, onNavigate, onEditInvoice }: DashboardProps) {
  const invoices = data.invoices.filter((i) => i.businessId === data.activeBusinessId);
  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const unpaidInvoices = invoices.filter((i) => i.status === "unpaid");
  const totalRevenue = paidInvoices.reduce((s, i) => s + i.grandTotal, 0);
  const totalOutstanding = unpaidInvoices.reduce((s, i) => s + i.balanceDue, 0);
  const parties = data.parties.length;

  const recentInvoices = [...invoices]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  const stats = [
    {
      label: "Total Revenue",
      value: formatCurrency(totalRevenue),
      icon: IndianRupee,
      color: "text-emerald-400",
    },
    {
      label: "Outstanding",
      value: formatCurrency(totalOutstanding),
      icon: Clock,
      color: "text-amber-400",
    },
    {
      label: "Total Invoices",
      value: String(invoices.length),
      icon: FileText,
      color: "text-mercury-blue",
    },
    {
      label: "Parties",
      value: String(parties),
      icon: Users,
      color: "text-purple-400",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-starlight">Dashboard</h1>
          <p className="text-sm text-silver">
            {business ? business.name : "No business selected"}
          </p>
        </div>
        <button
          onClick={() => onNavigate("invoice-form")}
          className="btn-primary"
        >
          + New Invoice
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-lg border border-lead/20 bg-midnight p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-silver">{label}</span>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div className="text-2xl font-medium text-starlight">{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-lead/20 bg-midnight p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg text-starlight">Recent Invoices</h2>
          <button
            onClick={() => onNavigate("invoices")}
            className="text-sm text-mercury-blue hover:underline"
          >
            View All →
          </button>
        </div>

        {recentInvoices.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="mx-auto mb-3 h-12 w-12 text-lead" />
            <p className="text-silver">No invoices yet. Create your first invoice!</p>
            <button
              onClick={() => onNavigate("invoice-form")}
              className="btn-primary mt-4"
            >
              Create Invoice
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-lead/20 text-left text-silver">
                  <th className="pb-3 pr-4">Invoice #</th>
                  <th className="pb-3 pr-4">Party</th>
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Amount</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-lead/10">
                    <td className="py-3 pr-4 text-starlight">{inv.invoiceNumber}</td>
                    <td className="py-3 pr-4 text-silver">{inv.partyName}</td>
                    <td className="py-3 pr-4 text-silver">{formatDate(inv.date)}</td>
                    <td className="py-3 pr-4 text-starlight">{formatCurrency(inv.grandTotal)}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                          inv.status === "paid"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : inv.status === "unpaid"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-lead/20 text-silver"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => onEditInvoice(inv)}
                        className="text-mercury-blue hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {business && (
        <div className="rounded-lg border border-lead/20 bg-midnight p-6">
          <h2 className="mb-4 text-lg text-starlight">Business Details</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs text-silver">GSTIN</p>
              <p className="text-sm text-starlight">{business.gstin || "Not set"}</p>
            </div>
            <div>
              <p className="text-xs text-silver">State</p>
              <p className="text-sm text-starlight">{business.state || "Not set"}</p>
            </div>
            <div>
              <p className="text-xs text-silver">Phone</p>
              <p className="text-sm text-starlight">{business.phone || "Not set"}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

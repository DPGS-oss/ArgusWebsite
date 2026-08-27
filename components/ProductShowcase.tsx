"use client";

import {
  ArrowRight,
  Building2,
  FileText,
  IndianRupee,
  TrendingUp,
  Users,
  CheckCircle2,
  Clock,
  Plus,
  Package,
} from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "./Reveal";

/** Sample preview only — illustrative shop data for the marketing mock. */
const stats = [
  { label: "Total Revenue", value: "₹1,24,500", icon: IndianRupee, color: "text-emerald-600" },
  { label: "Invoices Created", value: "147", icon: FileText, color: "text-brand-violet" },
  { label: "Active Parties", value: "38", icon: Users, color: "text-signal-blue" },
  { label: "To Collect", value: "₹18,240", icon: Clock, color: "text-amber-600" },
];

const recentInvoices = [
  { number: "INV-2026-0142", party: "Sharma Traders", date: "22 Aug", amount: "₹12,480", status: "Paid" },
  { number: "INV-2026-0141", party: "Mehta Retail", date: "21 Aug", amount: "₹8,260", status: "Paid" },
  { number: "INV-2026-0140", party: "Green Valley Stores", date: "20 Aug", amount: "₹21,150", status: "Unpaid" },
  { number: "INV-2026-0139", party: "Patel Distributors", date: "19 Aug", amount: "₹5,900", status: "Paid" },
  { number: "INV-2026-0138", party: "City Mart", date: "18 Aug", amount: "₹3,450", status: "Unpaid" },
];

const workflowSteps = [
  {
    icon: Building2,
    title: "Set up your business",
    description: "GSTIN, logo, and defaults once. Every invoice and report inherits them.",
  },
  {
    icon: Plus,
    title: "Bill & buy in one place",
    description: "Sales invoices, purchases, and stock updates — tax calculated for you.",
  },
  {
    icon: Package,
    title: "Keep books current",
    description: "Khata, expenses, quotes, and payments stay linked to the same parties.",
  },
  {
    icon: TrendingUp,
    title: "Close GST with confidence",
    description: "Sales and ITC views that match how you file — less spreadsheet scramble.",
  },
];

export function ProductShowcase() {
  return (
    <section id="workflow" className="bg-white py-20 md:py-28">
      <div className="container-page">
        <Reveal>
          <div className="section-header">
            <h2>Your shop, on one dashboard</h2>
            <p>
              Sample preview — revenue, invoices, parties, and dues the way Argus surfaces them
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1} y={60}>
          <div className="mb-16 overflow-hidden rounded-card border border-bone bg-mist shadow-subtle">
          <div className="flex items-center gap-2 border-b border-bone bg-plaster px-4 py-3">
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <div className="h-3 w-3 rounded-full bg-amber-400" />
            <div className="h-3 w-3 rounded-full bg-emerald-400" />
            <span className="ml-3 text-xs font-medium text-slate">Argus Web · Sample shop</span>
          </div>

          <div className="flex">
            <div className="hidden w-48 border-r border-bone bg-mist p-3 md:block">
              <div className="mb-4 flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-brand-violet" />
                <span className="text-sm font-bold text-ink">Argus</span>
              </div>
              <div className="space-y-1">
                {["Dashboard", "Invoices", "Books", "Inventory", "GST", "Khata", "Settings"].map((item, i) => (
                  <div
                    key={item}
                    className={`rounded-full px-3 py-2 text-xs ${
                      i === 0 ? "bg-brand-violet text-white" : "text-slate"
                    }`}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 p-4 md:p-6">
              <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {stats.map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="rounded-card border border-bone bg-white p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs text-slate">{label}</span>
                      <Icon className={`h-4 w-4 ${color}`} />
                    </div>
                    <div className="text-lg font-bold text-ink md:text-xl">{value}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-card border border-bone bg-white p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-ink">Recent Invoices</h3>
                  <button type="button" className="flex items-center gap-1 rounded-full bg-brand-violet px-3 py-1.5 text-xs font-bold text-white">
                    <Plus className="h-3 w-3" />
                    New Invoice
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs md:text-sm">
                    <thead>
                      <tr className="border-b border-bone text-left text-slate">
                        <th className="pb-2 pr-3 font-medium">Invoice #</th>
                        <th className="pb-2 pr-3 font-medium">Party</th>
                        <th className="hidden pb-2 pr-3 font-medium sm:table-cell">Date</th>
                        <th className="pb-2 pr-3 font-medium">Amount</th>
                        <th className="pb-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentInvoices.map((inv) => (
                        <tr key={inv.number} className="border-b border-bone/50">
                          <td className="py-2.5 pr-3 font-medium text-ink">{inv.number}</td>
                          <td className="py-2.5 pr-3 text-slate">{inv.party}</td>
                          <td className="hidden py-2.5 pr-3 text-slate sm:table-cell">{inv.date}</td>
                          <td className="py-2.5 pr-3 font-bold text-ink">{inv.amount}</td>
                          <td className="py-2.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                                inv.status === "Paid"
                                  ? "bg-emerald-500/15 text-emerald-600"
                                  : "bg-amber-500/15 text-amber-600"
                              }`}
                            >
                              {inv.status === "Paid" ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <Clock className="h-3 w-3" />
                              )}
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
        </Reveal>

        <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" stagger={0.12}>
          {workflowSteps.map((step, i) => (
            <StaggerItem
              key={step.title}
              className="group relative rounded-card border border-bone bg-mist p-6 transition hover:border-brand-violet/30 hover:bg-plaster"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-violet/10 text-brand-violet">
                  <step.icon className="h-5 w-5" />
                </div>
                <span className="text-2xl font-bold text-bone">{i + 1}</span>
              </div>
              <h3 className="mb-2 text-base font-bold text-ink">{step.title}</h3>
              <p className="text-sm leading-relaxed text-slate">{step.description}</p>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.2}>
          <div className="mt-12 text-center">
            <a
              href="/app/"
              className="group inline-flex items-center gap-2 rounded-full bg-ink px-8 py-4 text-sm font-bold text-white transition hover:bg-brand-violet"
            >
              Open the web app
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

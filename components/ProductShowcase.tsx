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
} from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "./Reveal";

const stats = [
  { label: "Total Revenue", value: "₹4,82,750", icon: IndianRupee, color: "text-emerald-600" },
  { label: "Invoices Created", value: "127", icon: FileText, color: "text-brand-violet" },
  { label: "Active Parties", value: "34", icon: Users, color: "text-signal-blue" },
  { label: "Pending Payments", value: "₹68,400", icon: Clock, color: "text-amber-600" },
];

const recentInvoices = [
  { number: "INV-2024-001", party: "Acme Corporation", date: "15 Jul 2026", amount: "₹59,900", status: "Paid" },
  { number: "INV-2024-002", party: "Sharma Traders", date: "14 Jul 2026", amount: "₹23,500", status: "Paid" },
  { number: "INV-2024-003", party: "Patel Electronics", date: "12 Jul 2026", amount: "₹1,12,200", status: "Unpaid" },
  { number: "INV-2024-004", party: "Global Imports Ltd", date: "10 Jul 2026", amount: "₹47,800", status: "Paid" },
  { number: "INV-2024-005", party: "Verma Wholesale", date: "08 Jul 2026", amount: "₹68,400", status: "Unpaid" },
];

const workflowSteps = [
  {
    icon: Building2,
    title: "Set Up Your Business",
    description: "Add your business details, GSTIN, and logo. Get started in under 2 minutes.",
  },
  {
    icon: Plus,
    title: "Create Professional Invoices",
    description: "Generate GST-compliant invoices with auto-calculated tax, discounts, and item details.",
  },
  {
    icon: Users,
    title: "Manage Parties & Inventory",
    description: "Track customers, suppliers, and stock levels. All your business contacts in one place.",
  },
  {
    icon: TrendingUp,
    title: "Analyze Reports & GSTR",
    description: "View sales reports, profit margins, and generate GSTR-1/GSTR-3B filings instantly.",
  },
];

export function ProductShowcase() {
  return (
    <section id="workflow" className="bg-white py-20 md:py-28">
      <div className="container-page">
        {/* Section Header */}
        <Reveal>
          <div className="section-header">
            <h2>See Argus in Action</h2>
            <p>A complete GST billing workflow — from invoice creation to tax filing</p>
          </div>
        </Reveal>

        {/* Dashboard Preview */}
        <Reveal delay={0.1} y={60}>
          <div className="mb-16 overflow-hidden rounded-card border border-bone bg-mist shadow-subtle">
          {/* Window chrome */}
          <div className="flex items-center gap-2 border-b border-bone bg-plaster px-4 py-3">
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <div className="h-3 w-3 rounded-full bg-amber-400" />
            <div className="h-3 w-3 rounded-full bg-emerald-400" />
            <span className="ml-3 text-xs font-medium text-slate">argusinvoicing.com / app / dashboard</span>
          </div>

          {/* Dashboard content */}
          <div className="flex">
            {/* Sidebar mock */}
            <div className="hidden w-48 border-r border-bone bg-mist p-3 md:block">
              <div className="mb-4 flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-brand-violet" />
                <span className="text-sm font-bold text-ink">Argus</span>
              </div>
              <div className="space-y-1">
                {["Dashboard", "Invoices", "Parties", "Items", "Reports", "Business", "Settings"].map((item, i) => (
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

            {/* Main content */}
            <div className="flex-1 p-4 md:p-6">
              {/* Stats grid */}
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

              {/* Recent invoices table */}
              <div className="rounded-card border border-bone bg-white p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-ink">Recent Invoices</h3>
                  <button className="flex items-center gap-1 rounded-full bg-brand-violet px-3 py-1.5 text-xs font-bold text-white">
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

        {/* Workflow Steps */}
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

        {/* CTA */}
        <Reveal delay={0.2}>
          <div className="mt-12 text-center">
            <a
              href="/app/"
              className="group inline-flex items-center gap-2 rounded-full bg-ink px-8 py-4 text-sm font-bold text-white transition hover:bg-brand-violet"
            >
              Try the Web App Now
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

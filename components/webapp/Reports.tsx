"use client";

import { useState } from "react";
import { BarChart3, Download, FileText } from "lucide-react";
import type { AppData, GSTRReportType, GSTRReport } from "@/lib/types";
import { generateGSTRReport, formatCurrency, formatDate } from "@/lib/gst";

type ReportsProps = {
  data: AppData;
};

const REPORT_TYPES: { value: GSTRReportType; label: string }[] = [
  { value: "gstr1", label: "GSTR-1 (Outward Supplies)" },
  { value: "gstr3b", label: "GSTR-3B (Summary Return)" },
  { value: "gstr2b", label: "GSTR-2B (ITC Available)" },
  { value: "gstr4", label: "GSTR-4 (Composition)" },
];

function getMonthRange(month: string): { from: string; to: string } {
  const [year, m] = month.split("-").map(Number);
  const from = new Date(year, m - 1, 1).toISOString().split("T")[0];
  const to = new Date(year, m, 0).toISOString().split("T")[0];
  return { from, to };
}

export function Reports({ data }: ReportsProps) {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [reportType, setReportType] = useState<GSTRReportType>("gstr1");
  const [month, setMonth] = useState(defaultMonth);
  const [report, setReport] = useState<GSTRReport | null>(null);

  const invoices = data.invoices.filter((i) => i.businessId === data.activeBusinessId);

  function generate() {
    const { from, to } = getMonthRange(month);
    const r = generateGSTRReport(invoices, reportType, from, to);
    setReport(r);
  }

  function downloadReport() {
    if (!report) return;
    const content = JSON.stringify(report, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.type.toUpperCase()}_${month}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl text-starlight">GSTR Reports</h1>

      <div className="rounded-lg border border-lead/20 bg-midnight p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm text-silver">
            Report Type
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as GSTRReportType)}
              className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-starlight outline-none focus:border-mercury-blue"
            >
              {REPORT_TYPES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-silver">
            Month
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-starlight outline-none focus:border-mercury-blue"
            />
          </label>
          <div className="flex items-end">
            <button onClick={generate} className="btn-primary w-full">
              <BarChart3 className="mr-1 h-4 w-4" /> Generate Report
            </button>
          </div>
        </div>
      </div>

      {report && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg text-starlight">
              {report.type.toUpperCase()} — {report.period}
            </h2>
            <button onClick={downloadReport} className="btn-secondary !py-2">
              <Download className="mr-1 h-4 w-4" /> Download
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-lead/20 bg-midnight p-4">
              <p className="text-xs text-silver">Total Invoices</p>
              <p className="text-xl text-starlight">{report.totalInvoices}</p>
            </div>
            <div className="rounded-lg border border-lead/20 bg-midnight p-4">
              <p className="text-xs text-silver">Taxable Value</p>
              <p className="text-xl text-starlight">{formatCurrency(report.totalTaxableValue)}</p>
            </div>
            <div className="rounded-lg border border-lead/20 bg-midnight p-4">
              <p className="text-xs text-silver">Total Tax</p>
              <p className="text-xl text-starlight">{formatCurrency(report.totalTax)}</p>
            </div>
            <div className="rounded-lg border border-lead/20 bg-midnight p-4">
              <p className="text-xs text-silver">Invoice Value</p>
              <p className="text-xl text-starlight">{formatCurrency(report.totalInvoiceValue)}</p>
            </div>
          </div>

          {report.sections.map((section) => (
            <div key={section.section} className="rounded-lg border border-lead/20 bg-midnight p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base text-starlight">
                  Section {section.section}: {section.description}
                </h3>
                <span className="text-sm text-silver">{section.invoices.length} invoices</span>
              </div>

              {section.invoices.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-lead/20 text-left text-silver">
                        <th className="pb-2 pr-4">Invoice #</th>
                        <th className="pb-2 pr-4">Party</th>
                        <th className="pb-2 pr-4">Date</th>
                        <th className="pb-2 pr-4 text-right">Taxable</th>
                        <th className="pb-2 pr-4 text-right">CGST</th>
                        <th className="pb-2 pr-4 text-right">SGST</th>
                        <th className="pb-2 pr-4 text-right">IGST</th>
                        <th className="pb-2 pr-4 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.invoices.map((inv) => (
                        <tr key={inv.id} className="border-b border-lead/10">
                          <td className="py-2 pr-4 text-starlight">{inv.invoiceNumber}</td>
                          <td className="py-2 pr-4 text-silver">{inv.partyName}</td>
                          <td className="py-2 pr-4 text-silver">{formatDate(inv.date)}</td>
                          <td className="py-2 pr-4 text-right text-silver">{formatCurrency(inv.totalTaxable)}</td>
                          <td className="py-2 pr-4 text-right text-silver">{formatCurrency(inv.totalCgst)}</td>
                          <td className="py-2 pr-4 text-right text-silver">{formatCurrency(inv.totalSgst)}</td>
                          <td className="py-2 pr-4 text-right text-silver">{formatCurrency(inv.totalIgst)}</td>
                          <td className="py-2 pr-4 text-right text-starlight">{formatCurrency(inv.grandTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-lead/20">
                        <td colSpan={3} className="pt-3 text-sm font-medium text-starlight">Total</td>
                        <td className="pt-3 text-right text-sm font-medium text-starlight">{formatCurrency(section.taxableValue)}</td>
                        <td className="pt-3 text-right text-sm font-medium text-starlight">{formatCurrency(section.cgst)}</td>
                        <td className="pt-3 text-right text-sm font-medium text-starlight">{formatCurrency(section.sgst)}</td>
                        <td className="pt-3 text-right text-sm font-medium text-starlight">{formatCurrency(section.igst)}</td>
                        <td className="pt-3 text-right text-sm font-medium text-starlight">{formatCurrency(section.invoiceValue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <FileText className="mx-auto mb-2 h-8 w-8 text-lead" />
                  <p className="text-sm text-silver">No invoices in this section</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

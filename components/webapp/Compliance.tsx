"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/gst";
import type { AppData } from "@/lib/types";
import { checkBooks, gstr3b, purchaseMatch } from "@/lib/compliance";
import { saveData } from "@/lib/storage";

type Props = { data: AppData; onSaved: () => void };

/** GSTR-3B for a month is filed in the next month, so default to last month. */
function defaultPeriod(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}` };
}

export function Compliance({ data, onSaved }: Props) {
  const [period, setPeriod] = useState(defaultPeriod);
  const seller = data.businesses.find((b) => b.id === data.activeBusinessId)?.gstin || "";
  const issues = useMemo(() => checkBooks(data), [data]);
  const summary = useMemo(() => {
    const { from, to } = monthRange(period);
    return gstr3b(data, from, to);
  }, [data, period]);
  const rows = useMemo(() => purchaseMatch(data.purchases || [], seller), [data.purchases, seller]);
  const errors = issues.filter((e) => e.severity === "error").length;

  function setTurnover(on: boolean) {
    saveData({ ...data, settings: { ...data.settings, turnoverAbove5Cr: on } });
    onSaved();
  }

  const figures: [string, number, string?][] = [
    ["Outward taxable value", summary.taxable],
    ["Nil / exempt", summary.nil],
    ["CGST", summary.cgst],
    ["SGST", summary.sgst],
    ["IGST", summary.igst],
    ["Eligible ITC", summary.eligible, "Purchases with supplier GSTIN, net of ineligible"],
    ["Ineligible ITC", summary.blocked, "Section 17(5) / marked not eligible"],
    ["Reverse charge tax", summary.rcm, "Paid in cash; cannot use ITC"],
  ];

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-ink">GST check</h1>
      <p className="mb-4 text-sm text-slate">
        Checks your books against GST rules (Rule 46, Rule 37, Sections 16 and 34, GST 2.0 rates) and
        prepares GSTR-3B figures. It is a checklist. File on the GST portal and confirm with your CA.
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-ink">
          Tax period
          <input
            type="month"
            className="input-field !w-auto"
            value={period}
            onChange={(e) => e.target.value && setPeriod(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={!!data.settings.turnoverAbove5Cr}
            onChange={(e) => setTurnover(e.target.checked)}
          />
          Turnover above ₹5 crore (6-digit HSN, e-invoice)
        </label>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-bone bg-white p-4">
          <div className="text-xs text-ash">Cash to pay for {period}</div>
          <div className="text-2xl font-bold text-ink">{formatCurrency(summary.cash)}</div>
          <div className="text-xs text-slate">Output tax minus ITC, plus reverse-charge tax</div>
        </div>
        <div className="rounded-xl border border-bone bg-white p-4">
          <div className="text-xs text-ash">ITC carried forward</div>
          <div className="text-2xl font-bold text-ink">{formatCurrency(summary.carryForward)}</div>
          <div className="text-xs text-slate">Credit left after this period</div>
        </div>
      </div>

      <div className="mb-6 grid gap-2 sm:grid-cols-2">
        {figures.map(([label, value, hint]) => (
          <div key={label} className="flex items-center justify-between rounded-xl border border-bone bg-white px-4 py-3">
            <span className="text-sm text-slate">
              {label}
              {hint ? <span className="block text-xs text-ash">{hint}</span> : null}
            </span>
            <span className="font-semibold">{formatCurrency(value)}</span>
          </div>
        ))}
      </div>

      <div className="mb-3 rounded-xl border border-bone bg-white p-4">
        <div className="font-medium text-ink">
          {issues.length === 0 ? "Nothing to fix" : `${errors} must-fix · ${issues.length - errors} to review`}
        </div>
        <div className="text-sm text-slate">Across all your books, not only this period.</div>
      </div>

      <div className="space-y-2">
        {issues.map((e, i) => (
          <div
            key={i}
            className={`rounded-xl border bg-white px-4 py-3 ${
              e.severity === "error" ? "border-red-200 border-l-4 border-l-red-500" : "border-bone border-l-4 border-l-amber-400"
            }`}
          >
            <div className="flex items-center gap-2 font-medium text-ink">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  e.severity === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                }`}
              >
                {e.severity === "error" ? "Must fix" : "Review"}
              </span>
              {e.title}
            </div>
            <div className="text-sm text-slate">{e.detail}</div>
          </div>
        ))}
      </div>

      {rows.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-lg font-semibold text-ink">Purchase ITC match</h2>
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.purchase.id} className="flex items-center justify-between gap-3 rounded-xl border border-bone bg-white px-4 py-3">
                <div>
                  <div className="font-medium text-ink">{row.purchase.supplierName}</div>
                  <div className="text-sm text-slate">{row.reason}</div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold">{formatCurrency(row.tax)}</div>
                  <div
                    className={
                      row.status === "eligible" ? "text-emerald-700" : row.status === "blocked" ? "text-red-700" : "text-amber-700"
                    }
                  >
                    {row.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

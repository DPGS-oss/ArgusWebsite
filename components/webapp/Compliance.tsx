"use client";

import { formatCurrency } from "@/lib/gst";
import type { AppData } from "@/lib/types";
import { checkBooks, gstr3b, purchaseMatch } from "@/lib/compliance";
import { saveData } from "@/lib/storage";

type Props = { data: AppData; onSaved: () => void };

export function Compliance({ data, onSaved }: Props) {
  const issues = checkBooks(data);
  const summary = gstr3b(data);
  const rows = purchaseMatch(data.purchases || []);
  const errors = issues.filter((e) => e.severity === "error").length;

  function setTurnover(on: boolean) {
    saveData({ ...data, settings: { ...data.settings, turnoverAbove5Cr: on } });
    onSaved();
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-ink">GST 2.0 check</h1>
      <p className="mb-4 text-sm text-slate">
        New bills use 0%, 5%, 18%, or 40% from 22 Sep 2025. Gold stays 3%, rough diamonds 0.25%. 12% and 28% are only for old bills. This is a checklist — file on the GST portal.
      </p>

      <label className="mb-4 flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={!!data.settings.turnoverAbove5Cr}
          onChange={(e) => setTurnover(e.target.checked)}
        />
        Turnover above ₹5 crore (6-digit HSN and IRN reminder)
      </label>

      <div className="mb-6 rounded-xl border border-bone bg-white p-4">
        <div className="font-medium text-ink">
          {issues.length === 0 ? "Nothing to fix" : `${errors} must-fix · ${issues.length - errors} to review`}
        </div>
        <div className="text-sm text-slate">Confirm with your CA before you submit a return.</div>
      </div>

      <div className="mb-6 grid gap-2 sm:grid-cols-2">
        {[
          ["Outward taxable", summary.taxable],
          ["Nil / exempt", summary.nil],
          ["CGST", summary.cgst],
          ["SGST", summary.sgst],
          ["IGST", summary.igst],
          ["Eligible ITC", summary.eligible],
          ["Reverse charge", summary.rcm],
          ["Net GST to check", summary.net],
        ].map(([label, value]) => (
          <div key={String(label)} className="flex justify-between rounded-xl border border-bone bg-white px-4 py-3">
            <span className="text-sm text-slate">{label}</span>
            <span className="font-semibold">{formatCurrency(Number(value))}</span>
          </div>
        ))}
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
              <div key={row.purchase.id} className="flex justify-between rounded-xl border border-bone bg-white px-4 py-3">
                <div>
                  <div className="font-medium text-ink">{row.purchase.supplierName}</div>
                  <div className="text-sm text-slate">{row.reason}</div>
                </div>
                <div className="text-sm">{row.status}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

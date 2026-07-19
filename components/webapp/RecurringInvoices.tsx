"use client";

import { Repeat, Calendar } from "lucide-react";
import type { AppData, Invoice } from "@/lib/types";

type Props = {
  data: AppData;
  onSaved: () => void;
};

export function RecurringInvoices({ data, onSaved }: Props) {
  const recurringInvoices = data.invoices.filter((inv) => {
    // Check if invoice has recurring config by looking for a recurring field
    // Since we don't have recurring on the web Invoice type yet, we check by pattern
    return false; // Placeholder — will be populated when recurring is added to invoices
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Recurring Invoices</h1>
        <p className="mt-1 text-sm text-slate">Manage automatically repeating invoices</p>
      </div>

      <div className="mb-6 rounded-xl border border-bone bg-white p-4">
        <div className="flex items-center gap-3">
          <Repeat className="h-5 w-5 text-signal-blue" />
          <div>
            <div className="font-medium text-ink">How it works</div>
            <div className="text-sm text-slate">
              Recurring invoices are automatically generated based on their schedule (weekly, monthly, quarterly, or yearly).
              Each recurring invoice creates a new invoice when its next run date is reached.
            </div>
          </div>
        </div>
      </div>

      {recurringInvoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-bone py-16 text-center">
          <Calendar className="mb-3 h-10 w-10 text-ash" />
          <p className="text-slate">No recurring invoices configured yet.</p>
          <p className="mt-1 text-sm text-ash">
            Set up recurring schedules when creating or editing an invoice in the mobile app.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recurringInvoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between rounded-xl border border-bone bg-white p-4">
              <div>
                <div className="font-semibold text-ink">{inv.invoiceNumber}</div>
                <div className="text-sm text-slate">{inv.partyName}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-ink">₹{inv.grandTotal.toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

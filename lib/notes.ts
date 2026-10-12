/**
 * Credit and debit notes against a bill. The owner types one amount (what is
 * being refunded or reduced, or what was undercharged, GST included); Argus
 * spreads it across the bill's lines in proportion, so each part carries that
 * line's GST rate, HSN and CGST/SGST or IGST split — as GSTR-1 needs.
 */
import { calculateItem } from "./gst";
import { toPaise } from "./money";
import type { AppData, Invoice, InvoiceItem } from "./types";

export type NoteAmounts = {
  items: InvoiceItem[];
  subtotal: number;
  totalGstAmount: number;
  totalAmount: number;
};

export function noteFromBill(bill: Invoice, amountInclusive: number): NoteAmounts {
  const amount = toPaise(amountInclusive);
  const lines = (bill.items || []).filter((l) => toPaise(l.total) > 0);
  const weight = lines.reduce((s, l) => s + toPaise(l.total), 0);
  if (amount <= 0 || weight <= 0) return { items: [], subtotal: 0, totalGstAmount: 0, totalAmount: 0 };
  let allocated = 0;
  const items = lines.map((l, idx) => {
    const share = idx === lines.length - 1 ? amount - allocated : Math.round((amount * toPaise(l.total)) / weight);
    allocated += share;
    const calc = calculateItem({
      quantity: 1, rate: 0, discount: 0, gstRate: l.gstRate, isInterState: !!bill.isInterState, inclusiveTotal: share / 100,
    });
    return {
      ...l,
      id: `${l.id}-adj`,
      ...calc,
      rate: calc.taxableAmount,
      quantity: 1,
      inclusiveTotal: share / 100,
    } as InvoiceItem;
  }).filter((l) => toPaise(l.total) > 0);
  const sum = (f: (l: InvoiceItem) => number) => items.reduce((s, l) => s + toPaise(f(l)), 0) / 100;
  return {
    items,
    subtotal: sum((l) => l.taxableAmount),
    totalGstAmount: sum((l) => l.cgst + l.sgst + l.igst + (l.cess || 0)),
    totalAmount: sum((l) => l.total),
  };
}

/** How much can still be credited against a bill (its total less earlier credit notes). */
export function creditableOnBill(data: AppData, bill: Invoice): number {
  const credited = (data.creditNotes || [])
    .filter((c) => c.invoiceId === bill.id && c.status !== "cancelled")
    .reduce((s, c) => s + toPaise(c.totalAmount), 0);
  return Math.max(0, toPaise(bill.grandTotal) - credited) / 100;
}

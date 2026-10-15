/**
 * Exception report: everything in the books that needs a look, in plain words.
 * Tally calls these exception reports (negative stock, negative cash, overdue
 * dues and so on). Each item says what is wrong and what to do.
 */
import type { AppData } from "./types";
import { runningBook, unbalancedPostings } from "./books";
import { billBalance } from "./notes";
import { todayIST, addDays } from "./dates";
import { toPaise } from "./money";
import { expiring } from "./stock";
import { isValidGstin } from "./gstin";

export type ExceptionItem = {
  group: string;
  severity: "error" | "warn";
  title: string;
  detail: string;
  amount?: number;
};

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) / 86400000);

export function exceptionReport(data: AppData, today: string = todayIST()): ExceptionItem[] {
  const out: ExceptionItem[] = [];

  // Stock below zero: sold more than was recorded as bought.
  for (const s of data.stock || []) {
    if ((s.currentStock || 0) < 0) {
      out.push({
        group: "Stock", severity: "error", title: `${s.name}: stock below zero (${s.currentStock} ${s.unit || ""})`.trim(),
        detail: "More was sold than recorded. Add the missing purchase or correct the stock count.",
      });
    }
  }

  // Batches expired or expiring within 30 days.
  for (const lot of expiring(data, 30, today)) {
    const gone = (lot.expiry || "") < today;
    out.push({
      group: "Stock", severity: gone ? "error" : "warn",
      title: `${lot.name}${lot.batch ? ` (batch ${lot.batch})` : ""}: ${lot.qty} ${gone ? "expired on" : "expires on"} ${lot.expiry}`,
      detail: gone ? "Do not sell it. Write it off with a stock adjustment." : "Sell it first, or return it to the supplier before it expires.",
    });
  }

  // Cash or bank went below zero at some point.
  for (const account of ["cash", "bank"] as const) {
    const book = runningBook(data.khataEntries || [], account);
    const low = book.reduce((m, e) => Math.min(m, e.runningBalance), 0);
    if (low < 0) {
      out.push({
        group: "Cash and bank", severity: "warn", amount: low,
        title: `${account === "cash" ? "Cash" : "Bank"} went below zero (lowest ₹${Math.abs(low).toFixed(2)} short)`,
        detail: "Some money in is missing, or an expense was recorded twice. Check the entries around that date.",
      });
    }
  }

  // Customers who have not paid after the due date, by age.
  const buckets: [string, number, number][] = [["1–30 days late", 1, 30], ["31–60 days late", 31, 60], ["61–90 days late", 61, 90], ["over 90 days late", 91, 1e9]];
  for (const [label, min, max] of buckets) {
    const late = data.invoices.filter((i) => {
      if (i.status === "draft" || i.status === "cancelled") return false;
      if (billBalance(data, i) <= 0) return false;
      const due = (i.dueDate || i.date || "").slice(0, 10);
      const age = due ? daysBetween(due, today) : 0;
      return age >= min && age <= max;
    });
    if (late.length) {
      const amount = late.reduce((s, i) => s + toPaise(billBalance(data, i)), 0) / 100;
      out.push({
        group: "Money owed to you", severity: max > 60 ? "error" : "warn", amount,
        title: `${late.length} bill${late.length === 1 ? "" : "s"} ${label}: ₹${amount.toFixed(2)}`,
        detail: late.slice(0, 5).map((i) => `${i.invoiceNumber} (${i.partyName || "Walk-in"})`).join(", ") + (late.length > 5 ? "…" : ""),
      });
    }
  }

  // Paid more than the bill: an advance or a mistake.
  for (const i of data.invoices) {
    if (i.status === "cancelled") continue;
    const over = toPaise(i.paidAmount || 0) - toPaise(i.grandTotal);
    if (over > 100) {
      out.push({
        group: "Money owed to you", severity: "warn", amount: over / 100,
        title: `${i.invoiceNumber}: paid ₹${(over / 100).toFixed(2)} more than the bill`,
        detail: "Record it as an advance for the next bill, or refund it.",
      });
    }
  }

  // Suppliers unpaid for over 180 days: GST claimed on them must be paid back (Rule 37).
  for (const p of data.purchases || []) {
    const unpaid = toPaise(p.totalAmount) - toPaise(p.paidAmount ?? p.totalAmount);
    const age = daysBetween(p.supplierInvoiceDate || p.createdAt, today);
    if (unpaid > 50 && age > 150) {
      out.push({
        group: "Money you owe", severity: age > 180 ? "error" : "warn", amount: unpaid / 100,
        title: `${p.supplierName} (${p.supplierInvoiceNumber || p.purchaseNumber}): ₹${(unpaid / 100).toFixed(2)} unpaid for ${age} days`,
        detail: age > 180
          ? "Over 180 days: the GST you claimed on this must be added back until you pay. Tell your CA."
          : "Pay within 180 days of the bill to keep the GST you claimed on it.",
      });
    }
  }

  // GST on a purchase is claimable only from a valid supplier GSTIN.
  for (const p of data.purchases || []) {
    const gstin = (p.supplierGstin || "").trim().toUpperCase();
    const tax = toPaise(p.totalGstAmount || 0);
    if (!p.reverseCharge && p.itcEligible !== false && tax > 0 && gstin && gstin !== "URP" && !isValidGstin(gstin)) {
      out.push({
        group: "Purchases", severity: "warn", amount: tax / 100,
        title: `${p.supplierName} (${p.supplierInvoiceNumber || p.purchaseNumber}): supplier GSTIN ${gstin} is not valid`,
        detail: "The GST on this bill is not counted as input credit until the GSTIN is corrected. Check it on the supplier's bill.",
      });
    }
  }

  // Drafts lying around.
  const oldDrafts = data.invoices.filter((i) => i.status === "draft" && (i.date || "") < addDays(today, -7));
  if (oldDrafts.length) {
    out.push({
      group: "Bills", severity: "warn",
      title: `${oldDrafts.length} draft bill${oldDrafts.length === 1 ? "" : "s"} older than a week`,
      detail: "Issue them or delete them, so they are not forgotten.",
    });
  }

  // Credit notes larger than what is left on the bill.
  for (const i of data.invoices) {
    const credited = (data.creditNotes || []).filter((c) => c.invoiceId === i.id && c.status !== "cancelled").reduce((s, c) => s + toPaise(c.totalAmount), 0);
    if (credited > toPaise(i.grandTotal) + 100) {
      out.push({
        group: "Bills", severity: "error", amount: credited / 100,
        title: `${i.invoiceNumber}: credit notes exceed the bill`,
        detail: "Credit notes cannot be more than the bill. Cancel the extra note.",
      });
    }
  }

  const unbalanced = unbalancedPostings(data.khataEntries || []);
  if (unbalanced.length) {
    out.push({
      group: "Books", severity: "error",
      title: `${unbalanced.length} entr${unbalanced.length === 1 ? "y does" : "ies do"} not balance`,
      detail: "Money in and out do not match. Open the bill or payment and save it again.",
    });
  }

  return out;
}

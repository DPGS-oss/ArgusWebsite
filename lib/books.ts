/**
 * Easy Tally: every money event posts ledger lines. Shopkeeper never sees vouchers.
 */
import type { AppData, CreditNote, DebitNote, Expense, Invoice, KhataEntry, Payment, Purchase } from "./types";
import { generateId, loadData, saveData } from "./storage";
import { isRegisteredGstin } from "./gstin";
import { round2, toPaise } from "./money";
import { withBalance } from "./notes";

/** "gst" holds GST collected on sales (owed to the government) less GST paid on purchases. */
export type LedgerAccount = "party" | "cash" | "bank" | "sales" | "purchase" | "expense" | "gst";

function methodAccount(method?: string): "cash" | "bank" {
  const m = (method || "cash").toLowerCase();
  return ["bank", "upi", "neft", "rtgs", "card"].includes(m) ? "bank" : "cash";
}

function line(partial: Omit<KhataEntry, "id" | "createdAt"> & { id?: string; createdAt?: string }): KhataEntry {
  return {
    id: partial.id || generateId(),
    customerId: partial.customerId,
    customerName: partial.customerName,
    amount: partial.amount,
    description: partial.description,
    createdAt: partial.createdAt || new Date().toISOString(),
    isCredit: partial.isCredit,
    accountType: partial.accountType,
    partyKind: partial.partyKind,
    paymentMethod: partial.paymentMethod,
    sourceType: partial.sourceType,
    sourceId: partial.sourceId,
  };
}

/**
 * Posts a bill: the customer owes the total (or it was paid), sales get the
 * value before tax, and the GST goes to the GST account because it is owed to
 * the government, not income. Payments recorded later are posted on their own.
 * A cancelled bill keeps its entries and gets reversing ones, so the customer
 * no longer owes it and the record of what happened stays.
 */
export function postInvoiceLedger(data: AppData, invoice: Invoice): AppData {
  const all = data.khataEntries || [];
  if (invoice.status === "draft") {
    return { ...data, khataEntries: all.filter((e) => !(e.sourceId === invoice.id && e.sourceType === "invoice")) };
  }
  if (invoice.status === "cancelled") return reverseSource(data, invoice.id, "invoice", `Cancelled ${invoice.invoiceNumber}`);

  const existing = all.filter((e) => !(e.sourceId === invoice.id && (e.sourceType === "invoice" || e.sourceType === "invoice_cancel")));
  // Money received through recorded payments is posted by postPaymentLedger.
  const viaPayments = (data.payments || []).filter((p) => p.invoiceId === invoice.id).reduce((s, p) => s + toPaise(p.amount), 0);
  const grand = toPaise(invoice.grandTotal);
  const paidAtBilling = Math.max(0, Math.min(grand, toPaise(invoice.paidAmount || 0) - viaPayments));
  const tax = toPaise(invoice.totalTax || 0);
  const reimbursed = toPaise(invoice.deliveryReimbursement || 0);
  const sales = grand - tax - reimbursed;
  const base = { sourceType: "invoice", sourceId: invoice.id };
  const next = [...existing];
  next.push(line({ ...base, customerId: "", customerName: "Sales", amount: sales / 100, description: `Sales ${invoice.invoiceNumber}`, isCredit: false, accountType: "sales" }));
  if (tax) next.push(line({ ...base, customerId: "", customerName: "GST", amount: tax / 100, description: `GST on ${invoice.invoiceNumber}`, isCredit: false, accountType: "gst" }));
  if (reimbursed) next.push(line({ ...base, customerId: "", customerName: "Delivery recovered", amount: reimbursed / 100, description: `Courier recovered ${invoice.invoiceNumber}`, isCredit: true, accountType: "expense" }));
  if (grand - paidAtBilling > 0) {
    next.push(line({ ...base, customerId: invoice.partyId, customerName: invoice.partyName, amount: (grand - paidAtBilling) / 100, description: `Bill ${invoice.invoiceNumber}`, isCredit: true, accountType: "party", partyKind: "customer" }));
  }
  if (paidAtBilling > 0) {
    const acct = methodAccount(invoice.paymentMode);
    next.push(line({ ...base, customerId: "", customerName: acct === "bank" ? "Bank" : "Cash", amount: paidAtBilling / 100, description: `In (${invoice.paymentMode || "cash"}) ${invoice.invoiceNumber}`, isCredit: true, accountType: acct, paymentMethod: invoice.paymentMode }));
  }
  return { ...data, khataEntries: next };
}

/** Adds entries that undo a document's postings, once. */
function reverseSource(data: AppData, sourceId: string, sourceType: string, description: string): AppData {
  const all = data.khataEntries || [];
  const reversalType = `${sourceType}_cancel`;
  if (all.some((e) => e.sourceId === sourceId && e.sourceType === reversalType)) return data;
  const posted = all.filter((e) => e.sourceId === sourceId && e.sourceType === sourceType);
  const reversals = posted.map((e) => line({ ...e, id: undefined, createdAt: undefined, isCredit: !e.isCredit, description, sourceType: reversalType }));
  return { ...data, khataEntries: [...all, ...reversals] };
}

/**
 * A credit note cuts sales, GST and what the customer owes; a debit note
 * (the customer was undercharged) adds to all three.
 */
export function postNoteLedger(data: AppData, note: CreditNote | DebitNote, kind: "credit_note" | "debit_note"): AppData {
  const number = "creditNoteNumber" in note ? note.creditNoteNumber : note.debitNoteNumber;
  if (note.status === "cancelled") return reverseSource(data, note.id, kind, `Cancelled ${number}`);
  const existing = (data.khataEntries || []).filter((e) => e.sourceId !== note.id);
  const total = toPaise(note.totalAmount);
  const tax = toPaise(note.totalGstAmount || 0);
  const reduces = kind === "credit_note";
  const label = reduces ? "Credit note" : "Debit note";
  const base = { sourceType: kind, sourceId: note.id };
  const next = [...existing];
  next.push(line({ ...base, customerId: "", customerName: "Sales", amount: (total - tax) / 100, description: `${label} ${number}`, isCredit: reduces, accountType: "sales" }));
  if (tax) next.push(line({ ...base, customerId: "", customerName: "GST", amount: tax / 100, description: `GST on ${number}`, isCredit: reduces, accountType: "gst" }));
  next.push(line({ ...base, customerId: note.customerId || "", customerName: note.customerName, amount: total / 100, description: `${label} ${number}`, isCredit: !reduces, accountType: "party", partyKind: "customer" }));
  return { ...data, khataEntries: next };
}

export function applyPaymentToInvoice(data: AppData, payment: Payment): AppData {
  const invoices = data.invoices.map((inv) => {
    if (inv.id !== payment.invoiceId) return inv;
    const paidAmount = round2((inv.paidAmount || 0) + payment.amount);
    const next = withBalance(data, { ...inv, paidAmount, status: inv.status === "draft" ? "unpaid" : inv.status, paymentMode: payment.method });
    return next;
  });
  const inv = invoices.find((i) => i.id === payment.invoiceId);
  let next = { ...data, invoices, payments: [...(data.payments || []), payment] };
  if (inv) next = postPaymentLedger(next, payment, inv.partyName, inv.partyId);
  return next;
}

export function postPaymentLedger(data: AppData, payment: Payment, partyName: string, partyId: string): AppData {
  const existing = (data.khataEntries || []).filter((e) => e.sourceId !== payment.id);
  const acct = methodAccount(payment.method);
  return {
    ...data,
    khataEntries: [
      ...existing,
      line({
        customerId: partyId,
        customerName: partyName,
        amount: payment.amount,
        description: `Payment (${payment.method})`,
        isCredit: false,
        accountType: "party",
        paymentMethod: payment.method,
        sourceType: "payment",
        sourceId: payment.id,
      }),
      line({
        customerId: "",
        customerName: acct === "bank" ? "Bank" : "Cash",
        amount: payment.amount,
        description: `In (${payment.method})`,
        isCredit: true,
        accountType: acct,
        paymentMethod: payment.method,
        sourceType: "payment",
        sourceId: payment.id,
      }),
    ],
  };
}

export function postPurchaseLedger(data: AppData, purchase: Purchase): AppData {
  const existing = (data.khataEntries || []).filter((e) => e.sourceId !== purchase.id);
  const paid = Math.min(purchase.paidAmount || 0, purchase.totalAmount);
  const due = Math.max(0, round2(purchase.totalAmount - paid));
  const next = [...existing];

  // GST paid on a purchase is claimed back (input tax credit) by a regular
  // GST-registered business; for anyone else it is part of the cost.
  const business = data.businesses.find((b) => b.id === data.activeBusinessId) || data.businesses[0];
  const claimable = !!business && isRegisteredGstin(business.gstin) && !business.composition;
  const gst = claimable ? round2(Math.min(purchase.totalGstAmount || 0, purchase.totalAmount)) : 0;
  next.push(
    line({
      customerId: "",
      customerName: "Purchases",
      amount: round2(purchase.totalAmount - gst),
      description: `Purchase ${purchase.purchaseNumber}`,
      isCredit: false,
      accountType: "purchase",
      sourceType: "purchase",
      sourceId: purchase.id,
    }),
  );
  if (gst > 0) {
    next.push(line({ customerId: "", customerName: "GST", amount: gst, description: `GST paid on ${purchase.purchaseNumber}`, isCredit: true, accountType: "gst", sourceType: "purchase", sourceId: purchase.id }));
  }

  if (due > 0) {
    next.push(
      line({
        customerId: purchase.supplierId || "",
        customerName: purchase.supplierName,
        amount: due,
        description: `Purchase ${purchase.purchaseNumber}`,
        isCredit: true,
        accountType: "party",
        partyKind: "supplier",
        sourceType: "purchase",
        sourceId: purchase.id,
      }),
    );
  }

  if (paid > 0) {
    const acct = methodAccount(purchase.paymentMethod);
    next.push(
      line({
        customerId: "",
        customerName: acct === "bank" ? "Bank" : "Cash",
        amount: paid,
        description: `Paid ${purchase.purchaseNumber} (${purchase.paymentMethod || "cash"})`,
        isCredit: false,
        accountType: acct,
        paymentMethod: purchase.paymentMethod,
        sourceType: "purchase",
        sourceId: purchase.id,
      }),
    );
  }

  return { ...data, khataEntries: next };
}

export function postExpenseLedger(data: AppData, expense: Expense): AppData {
  const existing = (data.khataEntries || []).filter((e) => e.sourceId !== expense.id);
  const acct = methodAccount(expense.paymentMode);
  return {
    ...data,
    khataEntries: [
      ...existing,
      line({
        customerId: "",
        customerName: expense.category || "Expense",
        amount: expense.amount,
        description: expense.description || expense.category,
        isCredit: false,
        accountType: "expense",
        paymentMethod: expense.paymentMode,
        sourceType: "expense",
        sourceId: expense.id,
      }),
      line({
        customerId: "",
        customerName: acct === "bank" ? "Bank" : "Cash",
        amount: expense.amount,
        description: `Expense (${expense.paymentMode || "cash"})`,
        isCredit: false,
        accountType: acct,
        paymentMethod: expense.paymentMode,
        sourceType: "expense",
        sourceId: expense.id,
      }),
    ],
  };
}

export function runningBook(entries: KhataEntry[], account: LedgerAccount) {
  const rows = entries
    .filter((e) => (e.accountType || (e.isCredit ? "party" : "party")) === account)
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let bal = 0;
  return rows.map((e) => {
    bal += e.isCredit ? e.amount : -e.amount;
    return { ...e, runningBalance: Math.round(bal * 100) / 100 };
  });
}

/**
 * Which side of the books an entry sits on. The khata flag means "money in /
 * owed to you" for customers, cash and bank (a debit), and "reverses income"
 * for sales and GST; for purchases, expenses and suppliers it is the other way.
 */
export function entrySide(e: KhataEntry): "debit" | "credit" {
  const type = e.accountType || "party";
  const debitWhenFlagged =
    type === "cash" || type === "bank" || type === "sales" || type === "gst" || (type === "party" && e.partyKind !== "supplier");
  return e.isCredit === debitWhenFlagged ? "debit" : "credit";
}

/**
 * Every bill, payment, purchase, expense and credit note must post equal
 * debits and credits. Returns the documents that do not, so a mistake shows up
 * instead of quietly skewing the books. Hand-written entries without a
 * counterpart (opening balances, udhaar) are one-sided by design and skipped.
 */
export function unbalancedPostings(entries: KhataEntry[]): { sourceId: string; sourceType: string; difference: number }[] {
  const groups = new Map<string, { sourceType: string; diff: number }>();
  for (const e of entries) {
    if (!e.sourceId || !e.sourceType || e.sourceType === "manual" || e.sourceType === "opening") continue;
    const type = e.sourceType.replace(/_cancel$/, "");
    const g = groups.get(e.sourceId) || { sourceType: type, diff: 0 };
    g.diff += (entrySide(e) === "debit" ? 1 : -1) * toPaise(e.amount);
    groups.set(e.sourceId, g);
  }
  return [...groups.entries()]
    .filter(([, g]) => Math.abs(g.diff) > 1)
    .map(([sourceId, g]) => ({ sourceId, sourceType: g.sourceType, difference: g.diff / 100 }));
}

/**
 * Profit before tax. Sales and purchases are counted without GST: GST
 * collected is owed to the government and GST paid is claimed back (when the
 * business can claim it). Cancelled bills are left out; credit notes are taken off and debit notes added.
 */
export function profitAndLoss(data: AppData) {
  const live = (data.invoices || []).filter((i) => i.status !== "cancelled" && i.status !== "draft");
  const salesPaise =
    live.reduce((s, i) => s + toPaise(i.grandTotal) - toPaise(i.totalTax || 0) - toPaise(i.deliveryReimbursement || 0), 0) -
    (data.creditNotes || [])
      .filter((c) => c.status !== "cancelled")
      .reduce((s, c) => s + toPaise(c.totalAmount) - toPaise(c.totalGstAmount || 0), 0) +
    (data.debitNotes || [])
      .filter((d) => d.status !== "cancelled")
      .reduce((s, d) => s + toPaise(d.totalAmount) - toPaise(d.totalGstAmount || 0), 0);
  const business = data.businesses.find((b) => b.id === data.activeBusinessId) || data.businesses[0];
  const claimable = !!business && isRegisteredGstin(business.gstin) && !business.composition;
  const cogsPaise = (data.purchases || []).reduce(
    (s, p) => s + toPaise(p.totalAmount) - (claimable ? toPaise(Math.min(p.totalGstAmount || 0, p.totalAmount)) : 0),
    0,
  );
  const expensesPaise = (data.expenses || []).reduce((s, e) => s + toPaise(e.amount), 0);
  return {
    sales: salesPaise / 100,
    cogs: cogsPaise / 100,
    expenses: expensesPaise / 100,
    profit: (salesPaise - cogsPaise - expensesPaise) / 100,
  };
}


export function postManualLedger(
  data: AppData,
  opts: {
    accountType: "party" | "cash" | "bank";
    name: string;
    amount: number;
    isCredit: boolean;
    description: string;
    partyKind?: "customer" | "supplier";
    counterpart?: "cash" | "bank";
  },
): AppData {
  const sourceId = generateId();
  const entries = [...(data.khataEntries || [])];
  entries.push(
    line({
      customerId: "",
      customerName: opts.name,
      amount: opts.amount,
      description: opts.description,
      isCredit: opts.isCredit,
      accountType: opts.accountType,
      partyKind: opts.partyKind,
      sourceType: "manual",
      sourceId,
    }),
  );
  if (opts.counterpart && opts.accountType === "party") {
    entries.push(
      line({
        customerId: "",
        customerName: opts.counterpart === "bank" ? "Bank" : "Cash",
        amount: opts.amount,
        description: opts.description,
        isCredit: !opts.isCredit,
        accountType: opts.counterpart,
        sourceType: "manual",
        sourceId,
      }),
    );
  }
  return { ...data, khataEntries: entries };
}

export function persistLedger(next: AppData) {
  saveData(next);
  return loadData();
}

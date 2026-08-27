/**
 * Easy Tally: every money event posts ledger lines. Shopkeeper never sees vouchers.
 */
import type { AppData, Expense, Invoice, KhataEntry, Payment, Purchase } from "./types";
import { generateId, loadData, saveData } from "./storage";

export type LedgerAccount = "party" | "cash" | "bank" | "sales" | "purchase" | "expense";

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

export function postInvoiceLedger(data: AppData, invoice: Invoice): AppData {
  if (invoice.status === "cancelled" || invoice.status === "draft") return data;
  const existing = (data.khataEntries || []).filter((e) => e.sourceId !== invoice.id);
  const partyDebit = line({
    customerId: invoice.partyId,
    customerName: invoice.partyName,
    amount: invoice.balanceDue > 0 ? invoice.balanceDue : invoice.grandTotal - (invoice.paidAmount || 0),
    description: `Bill ${invoice.invoiceNumber}`,
    isCredit: true,
    accountType: "party",
    partyKind: "customer",
    sourceType: "invoice",
    sourceId: invoice.id,
  });
  const sales = line({
    customerId: "",
    customerName: "Sales",
    amount: invoice.grandTotal,
    description: `Sales ${invoice.invoiceNumber}`,
    isCredit: false,
    accountType: "sales",
    sourceType: "invoice",
    sourceId: invoice.id,
  });
  const next = [...existing, sales];
  if (partyDebit.amount > 0) next.push(partyDebit);
  if ((invoice.paidAmount || 0) > 0) {
    const acct = methodAccount(invoice.paymentMode);
    next.push(
      line({
        customerId: "",
        customerName: acct === "bank" ? "Bank" : "Cash",
        amount: invoice.paidAmount,
        description: `In (${invoice.paymentMode || "cash"}) ${invoice.invoiceNumber}`,
        isCredit: true,
        accountType: acct,
        paymentMethod: invoice.paymentMode,
        sourceType: "invoice",
        sourceId: invoice.id,
      })
    );
  }
  return { ...data, khataEntries: next };
}

export function applyPaymentToInvoice(data: AppData, payment: Payment): AppData {
  const invoices = data.invoices.map((inv) => {
    if (inv.id !== payment.invoiceId) return inv;
    const paid = (inv.paidAmount || 0) + payment.amount;
    const balance = Math.max(0, inv.grandTotal - paid);
    return {
      ...inv,
      paidAmount: paid,
      balanceDue: balance,
      status: balance <= 0.009 ? "paid" : inv.status === "draft" ? "unpaid" : inv.status,
      paymentMode: payment.method,
    };
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

  next.push(
    line({
      customerId: "",
      customerName: "Purchases",
      amount: purchase.totalAmount,
      description: `Purchase ${purchase.purchaseNumber}`,
      isCredit: false,
      accountType: "purchase",
      sourceType: "purchase",
      sourceId: purchase.id,
    }),
  );

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

export function profitAndLoss(data: AppData) {
  const sales = (data.invoices || [])
    .filter((i) => i.status !== "cancelled" && i.status !== "draft")
    .reduce((s, i) => s + (i.grandTotal || 0), 0);
  const cogs = (data.purchases || []).reduce((s, p) => {
    if (p.items?.length) {
      return (
        s +
        p.items.reduce((n, item) => n + item.quantity * (item.rate || 0), 0)
      );
    }
    return s + (p.totalAmount - (p.totalGstAmount || 0));
  }, 0);
  const expenses = (data.expenses || []).reduce((s, e) => s + e.amount, 0);
  return {
    sales: round2(sales),
    cogs: round2(cogs),
    expenses: round2(expenses),
    profit: round2(sales - cogs - expenses),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
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

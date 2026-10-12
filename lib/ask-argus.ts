import type { AppData } from "./types";
import { generateGSTRReport, notesAsInvoices } from "./gst";
import { profitAndLoss } from "./books";
import { istDate } from "./dates";
import { round2 } from "./money";

export type AskArgusSummary = {
  period: { from: string; to: string };
  invoice_count: number;
  sales_total: number;
  sales_tax: number;
  purchases_total: number;
  purchase_tax: number;
  expenses_total: number;
  outstanding: number;
  party_count: number;
  inventory_skus: number;
  low_stock_items: number;
  gstr3b_tax_due_estimate: number;
  /** Profit before tax for the period: sales and purchases without GST, less expenses. */
  profit: number;
  include_party_names?: boolean;
  top_parties?: { label: string; total: number }[];
};

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function inRange(date: string, from: string, to: string) {
  if (!date) return true;
  return date >= from && date <= to;
}

/** Strip PII by default; party names only when owner opts in. */
export function buildAskArgusSummary(
  data: AppData,
  from: string,
  to: string,
  includePartyNames: boolean,
): AskArgusSummary {
  const bizId = data.activeBusinessId;
  // Drafts and cancelled bills are not sales.
  const invoices = data.invoices.filter(
    (inv) =>
      (!bizId || inv.businessId === bizId) &&
      inv.status !== "draft" &&
      inv.status !== "cancelled" &&
      inRange(inv.date.slice(0, 10), from, to),
  );
  const purchaseDay = (p: { date?: string; createdAt: string }) => p.date || istDate(new Date(p.createdAt));
  const purchases = (data.purchases ?? []).filter((p) => inRange(purchaseDay(p as { date?: string; createdAt: string }), from, to));
  const expenses = (data.expenses ?? []).filter((e) => inRange(e.date.slice(0, 10), from, to));

  let salesTotal = 0;
  let salesTax = 0;
  let outstanding = 0;
  const partyTotals = new Map<string, number>();

  for (const inv of invoices) {
    salesTotal += inv.grandTotal;
    salesTax += inv.totalTax;
    outstanding += inv.balanceDue;
    const key = inv.partyName || "Unknown";
    partyTotals.set(key, (partyTotals.get(key) || 0) + inv.grandTotal);
  }

  let purchaseTotal = 0;
  let purchaseTax = 0;
  for (const p of purchases) {
    purchaseTotal += p.totalAmount;
    purchaseTax += p.totalGstAmount;
  }

  let expenseTotal = 0;
  for (const e of expenses) {
    expenseTotal += e.amount;
  }

  const gstr3b = generateGSTRReport([...invoices, ...notesAsInvoices({ ...data, invoices })], "gstr3b", from, to, purchases);

  const stock = data.stock ?? [];
  const lowStock = stock.filter((s) => s.minStock > 0 && s.currentStock <= s.minStock).length;

  const summary: AskArgusSummary = {
    period: { from, to },
    invoice_count: invoices.length,
    sales_total: round2(salesTotal),
    sales_tax: round2(salesTax),
    purchases_total: round2(purchaseTotal),
    purchase_tax: round2(purchaseTax),
    expenses_total: round2(expenseTotal),
    outstanding: round2(outstanding),
    party_count: data.parties.length,
    inventory_skus: stock.length,
    low_stock_items: lowStock,
    gstr3b_tax_due_estimate: round2(gstr3b.totalTax),
    profit: profitAndLoss({
      ...data,
      invoices,
      purchases,
      expenses,
      creditNotes: (data.creditNotes ?? []).filter((c) => inRange(c.date || istDate(new Date(c.createdAt)), from, to)),
      debitNotes: (data.debitNotes ?? []).filter((d) => inRange(d.date || istDate(new Date(d.createdAt)), from, to)),
    }).profit,
  };

  if (includePartyNames) {
    summary.include_party_names = true;
    summary.top_parties = [...partyTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, total]) => ({ label, total: round2(total) }));
  }

  return summary;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const INTENTS: { words: RegExp; answer: (s: AskArgusSummary) => string }[] = [
  {
    words: /\b(gst|tax|kar)\b.*\b(due|pay|payable|owe|bharna|dena|kitna|liability|3b)\b|\b(due|pay|kitna)\b.*\b(gst|tax)\b/i,
    answer: (s) =>
      `GST to pay for ${s.period.from} to ${s.period.to}: about ${inr(s.gstr3b_tax_due_estimate)}.\n` +
      `• GST on your sales: ${inr(s.sales_tax)}\n• GST on your purchases: ${inr(s.purchase_tax)}\n` +
      "Your CA files the final figure in GSTR-3B.",
  },
  {
    words: /\b(profit|munafa|fayda|kamai|margin|loss|nuksan)\b/i,
    answer: (s) =>
      `Profit from ${s.period.from} to ${s.period.to}: ${inr(s.profit)} (before income tax).\n` +
      "Sales and purchases are counted without GST; expenses are taken off.",
  },
  {
    words: /\b(owe|owes|outstanding|pending|udhaar|udhar|baaki|baki|receivable)\b/i,
    answer: (s) =>
      `Customers owe you ${inr(s.outstanding)} on bills from ${s.period.from} to ${s.period.to}.` +
      (s.top_parties?.length ? `\nBiggest customers: ${s.top_parties.map((p) => `${p.label} ${inr(p.total)}`).join(", ")}.` : ""),
  },
  {
    words: /\b(sales|sale|sold|bikri|becha|revenue|turnover)\b/i,
    answer: (s) =>
      `Sales from ${s.period.from} to ${s.period.to}: ${inr(s.sales_total)} on ${s.invoice_count} bills, including ${inr(s.sales_tax)} GST.`,
  },
  {
    words: /\b(purchase|purchases|bought|kharid|kharida)\b/i,
    answer: (s) => `Purchases from ${s.period.from} to ${s.period.to}: ${inr(s.purchases_total)}, including ${inr(s.purchase_tax)} GST.`,
  },
  {
    words: /\b(expense|expenses|kharcha|kharche|spent)\b/i,
    answer: (s) => `Expenses from ${s.period.from} to ${s.period.to}: ${inr(s.expenses_total)}.`,
  },
  {
    words: /\b(stock|inventory|maal|khatam)\b/i,
    answer: (s) => `${s.low_stock_items} of your ${s.inventory_skus} items are at or below their minimum stock.`,
  },
];

/**
 * Answers common money questions straight from the books, with exact figures
 * and no AI. Returns null when the question needs the AI.
 */
export function answerFromBooks(question: string, summary: AskArgusSummary): string | null {
  const hit = INTENTS.find((i) => i.words.test(question));
  return hit ? hit.answer(summary) : null;
}

export async function askArgusQuestion(
  token: string,
  question: string,
  summary: AskArgusSummary,
): Promise<{ answer: string; configured?: boolean }> {
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question, summary }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Ask Argus failed");
  return data;
}

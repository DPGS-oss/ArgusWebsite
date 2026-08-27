import type { AppData } from "./types";
import { generateGSTRReport } from "./gst";

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
  const invoices = data.invoices.filter(
    (inv) => (!bizId || inv.businessId === bizId) && inRange(inv.date.slice(0, 10), from, to),
  );
  const purchases = (data.purchases ?? []).filter((p) => inRange(String(p.createdAt).slice(0, 10), from, to));
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

  const gstr3b = generateGSTRReport(invoices, "gstr3b", from, to, purchases);

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

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
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

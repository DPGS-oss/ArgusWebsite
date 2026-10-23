/**
 * GSTR-9 worksheet, GSTR-2B matching and the exempt supplies report. The
 * engines live in functions/_shared so the website (here, in the browser) and
 * the Android app (through /api/reports) get the same answers.
 */
import type { AppData } from "./types";
import gstr9 from "../functions/_shared/gstr9.js";
import gstr2b from "../functions/_shared/gstr2b.js";

export type Heads = { txval: number; igst: number; cgst: number; sgst: number; cess: number };
export type HsnRow = Heads & { hsn: string; uqc: string; rate: number; qty: number };
export type Gstr9 = {
  fy: string;
  period: { from: string; to: string };
  table4: Record<"A" | "B" | "G" | "I" | "J" | "N", Heads>;
  table5: Record<"C" | "D" | "H" | "I" | "N", Heads> & { turnover: number };
  table6: Record<"B" | "C" | "D" | "O", Heads>;
  table8: { A: Heads; B: Heads; D: Heads; monthsWith2b: number };
  table9: { payable: Omit<Heads, "txval"> };
  table17: HsnRow[];
  table18: HsnRow[];
  notes: string[];
};

export type Doc2b = {
  kind: "invoice" | "credit_note" | "debit_note";
  ctin: string; supplier: string; number: string; date: string; value: number;
  reverseCharge: boolean; itcAvailable: boolean; reason: string;
} & Heads;
export type Parsed2b = { gstin: string; period: string; generated: string; docs: Doc2b[] };
export type MatchStatus = "matched" | "amount_differs" | "only_in_2b" | "only_in_books" | "not_claimable" | "note";
export type MatchRow = {
  status: MatchStatus;
  doc: Doc2b | null;
  purchase: ({ id: string; number: string; date: string; supplier?: string; ctin?: string; value: number } & Heads) | null;
  difference: { taxable: number; tax: number } | null;
};
export type Match2b = {
  period: string;
  rows: MatchRow[];
  summary: { matched: number; amountDiffers: number; onlyIn2b: number; onlyInBooks: number; notClaimable: number; notes: number; claimableAsPer2b: number; creditNotesIn2b: number };
};
export type ExemptReport = {
  from: string; to: string; total: number;
  rows: { supply: string; kind: "nil" | "exempt"; value: number }[];
  lines: { number: string; date: string; party: string; item: string; hsn: string; kind: "nil" | "exempt"; value: number }[];
};

const g9 = gstr9 as unknown as {
  buildGstr9: (data: AppData, fy: string, itc2b?: Record<string, Omit<Heads, "txval">>) => Gstr9;
  gstr9Rows: (r: Gstr9) => (string | number)[][];
  exemptReport: (data: AppData, from: string, to: string) => ExemptReport;
};
const g2b = gstr2b as unknown as {
  parse2b: (json: unknown) => Parsed2b;
  match2b: (parsed: Parsed2b, purchases: AppData["purchases"], opts?: { tolerance?: number; period?: string }) => Match2b;
  itcTotals: (parsed: Parsed2b) => Omit<Heads, "txval">;
};

/** Uploaded GSTR-2B credit by month ("MMYYYY"), for GSTR-9 Table 8A. */
export function itcByMonth(data: AppData): Record<string, Omit<Heads, "txval">> {
  const out: Record<string, Omit<Heads, "txval">> = {};
  for (const [period, v] of Object.entries(data.gstr2b || {})) if (v?.itc) out[period] = v.itc;
  return out;
}

export const buildGstr9 = (data: AppData, fy: string) => g9.buildGstr9(data, fy, itcByMonth(data));
export const gstr9Rows = g9.gstr9Rows;
export const exemptReport = g9.exemptReport;
export const parse2b = g2b.parse2b;
export const match2b = g2b.match2b;
export const itcTotals = g2b.itcTotals;

/** Rows → CSV text (Excel opens it). */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\n");
}

export function downloadCsv(name: string, rows: (string | number | null | undefined)[][]) {
  const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------- CMP-08
/** Composition rates (CGST Rule 7): the total, half CGST and half SGST. */
export const COMPOSITION_RATES = [
  { rate: 1, label: "Trader or manufacturer — 1%" },
  { rate: 5, label: "Restaurant (no alcohol) — 5%" },
  { rate: 6, label: "Services or mixed supplies (section 10(2A)) — 6%" },
] as const;

export type Cmp08 = {
  quarter: string; from: string; to: string; due: string;
  turnover: number; exempt: number; taxable: number; rate: number;
  cgst: number; sgst: number; rcmCgst: number; rcmSgst: number; rcmIgst: number;
  bills: number;
};

const r2c = (n: number) => Math.round(n * 100) / 100;

/** Quarter bounds for "2025-26 Q1" style labels: Q1 = Apr–Jun ... Q4 = Jan–Mar. */
export function quarterRange(fy: string, q: 1 | 2 | 3 | 4): { from: string; to: string; due: string } {
  const start = Number(`20${fy.slice(0, 2)}`);
  const ranges = [["04-01", "06-30", "07-18"], ["07-01", "09-30", "10-18"], ["10-01", "12-31", "01-18"], ["01-01", "03-31", "04-18"]] as const;
  const [a, b, d] = ranges[q - 1];
  const y = q === 4 ? start + 1 : start;
  return { from: `${y}-${a}`, to: `${y}-${b}`, due: `${q >= 3 ? start + 1 : start}-${d}` };
}

/**
 * CMP-08, the composition dealer's quarterly statement: outward turnover
 * (bills of supply, less credit notes, plus debit notes), exempt goods left
 * out (tax is on taxable supplies), tax at the composition rate split in half,
 * and tax on inward supplies under reverse charge. Due on the 18th after the quarter.
 */
export function cmp08(data: AppData, fy: string, q: 1 | 2 | 3 | 4, rate: number, isExemptHsn: (hsn: string) => boolean = () => false): Cmp08 {
  const { from, to, due } = quarterRange(fy, q);
  const inQ = (d?: string) => !!d && d.slice(0, 10) >= from && d.slice(0, 10) <= to;
  const bills = data.invoices.filter((i) => i.status !== "draft" && i.status !== "cancelled" && inQ(i.date));
  const lineValue = (l: { taxableAmount?: number; total?: number }) => l.taxableAmount ?? l.total ?? 0;
  let turnover = 0;
  let exempt = 0;
  for (const b of bills) {
    for (const l of b.items || []) {
      const v = lineValue(l);
      turnover += v;
      if (isExemptHsn(l.hsn || "")) exempt += v;
    }
  }
  for (const n of data.creditNotes || []) if (n.status !== "cancelled" && inQ(n.date || n.createdAt)) turnover -= (n.totalAmount || 0) - (n.totalGstAmount || 0);
  for (const n of data.debitNotes || []) if (n.status !== "cancelled" && inQ(n.date || n.createdAt)) turnover += (n.totalAmount || 0) - (n.totalGstAmount || 0);
  const taxable = Math.max(0, turnover - exempt);
  const tax = r2c((taxable * rate) / 100);
  const rcm = (data.purchases || []).filter((p) => p.reverseCharge && inQ(p.supplierInvoiceDate || p.createdAt));
  return {
    quarter: `${fy} Q${q}`, from, to, due, turnover: r2c(turnover), exempt: r2c(exempt), taxable: r2c(taxable), rate,
    cgst: r2c(tax / 2), sgst: r2c(tax - r2c(tax / 2)),
    rcmCgst: r2c(rcm.reduce((t, p) => t + (p.totalCgst || 0), 0)),
    rcmSgst: r2c(rcm.reduce((t, p) => t + (p.totalSgst || 0), 0)),
    rcmIgst: r2c(rcm.reduce((t, p) => t + (p.totalIgst || 0), 0)),
    bills: bills.length,
  };
}

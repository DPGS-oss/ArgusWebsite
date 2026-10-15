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

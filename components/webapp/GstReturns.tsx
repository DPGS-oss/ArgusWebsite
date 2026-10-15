"use client";

import { useMemo, useState } from "react";
import { Upload, Download } from "lucide-react";
import { formatCurrency } from "@/lib/gst";
import type { AppData } from "@/lib/types";
import { loadData, saveData } from "@/lib/storage";
import { buildGstr9, downloadCsv, exemptReport, gstr9Rows, itcTotals, match2b, parse2b, type Heads, type Match2b, type MatchStatus } from "@/lib/gst-returns";
import { exceptionReport } from "@/lib/exceptions";
import { financialYear, monthRange, todayIST } from "@/lib/dates";

type Props = { data: AppData; onSaved: () => void };
type Tab = "2b" | "gstr9" | "exempt" | "exceptions";

const TABS: [Tab, string][] = [
  ["2b", "Match purchases with GSTR-2B"],
  ["gstr9", "GSTR-9 annual return"],
  ["exempt", "Exempt and nil-rated sales"],
  ["exceptions", "Things to check"],
];

const STATUS: Record<MatchStatus, { label: string; tone: string; help: string }> = {
  matched: { label: "Matched", tone: "text-green-700", help: "In 2B and in your books; amounts agree." },
  amount_differs: { label: "Amount differs", tone: "text-amber-700", help: "Same bill, different amount. Check with the supplier." },
  only_in_2b: { label: "Not in your books", tone: "text-amber-700", help: "The supplier reported it. Record the purchase to claim its GST." },
  only_in_books: { label: "Supplier hasn't reported", tone: "text-red-700", help: "You can't claim this GST until the supplier files it." },
  not_claimable: { label: "Not claimable", tone: "text-slate", help: "The portal says this credit isn't available." },
  note: { label: "Supplier's note", tone: "text-slate", help: "Credit or debit note from the supplier." },
};

const inr = (n: number) => formatCurrency(n || 0);
const taxOf = (h: Heads) => (h.igst || 0) + (h.cgst || 0) + (h.sgst || 0) + (h.cess || 0);

export function GstReturns({ data, onSaved }: Props) {
  const [tab, setTab] = useState<Tab>("2b");
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-ink">GST returns</h1>
      <p className="mb-4 text-sm text-slate">Check your purchases against what suppliers reported, prepare the annual return, and see what needs attention.</p>
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={tab === id ? "btn-primary px-4 py-2 text-sm" : "btn-outline px-4 py-2 text-sm"}>
            {label}
          </button>
        ))}
      </div>
      {tab === "2b" && <Match2bTab data={data} onSaved={onSaved} />}
      {tab === "gstr9" && <Gstr9Tab data={data} />}
      {tab === "exempt" && <ExemptTab data={data} />}
      {tab === "exceptions" && <ExceptionsTab data={data} />}
    </div>
  );
}

function Match2bTab({ data, onSaved }: Props) {
  const [result, setResult] = useState<Match2b | null>(null);
  const [error, setError] = useState("");
  const [show, setShow] = useState<MatchStatus | "all">("all");
  const own = (data.businesses.find((b) => b.id === data.activeBusinessId)?.gstin || "").toUpperCase();

  async function onFile(file: File) {
    setError("");
    try {
      const parsed = parse2b(JSON.parse(await file.text()));
      if (!parsed.docs.length && !parsed.period) throw new Error("This does not look like a GSTR-2B file.");
      if (parsed.gstin && own && parsed.gstin !== own) throw new Error(`This GSTR-2B is for ${parsed.gstin}, but your GSTIN is ${own}.`);
      const r = match2b(parsed, data.purchases || []);
      setResult(r);
      if (parsed.period) {
        const latest = loadData();
        saveData({ ...latest, gstr2b: { ...(latest.gstr2b || {}), [parsed.period]: { itc: itcTotals(parsed), summary: r.summary, uploadedAt: new Date().toISOString() } } });
        onSaved();
      }
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Could not read the file.");
    }
  }

  const rows = result ? result.rows.filter((r) => show === "all" || r.status === show) : [];
  return (
    <div className="space-y-4">
      <div className="rounded-card border border-bone bg-white p-4 text-sm text-slate">
        <p className="mb-2 text-ink">How to get your GSTR-2B file:</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Log in at gst.gov.in → Returns → Returns Dashboard.</li>
          <li>Pick the year and month, then GSTR-2B → View → <b>Download JSON</b>.</li>
          <li>Upload that file here. It stays on your device and in your books; nothing is sent to the GST portal.</li>
        </ol>
        <label className="btn-primary mt-3 inline-flex cursor-pointer items-center gap-2 px-4 py-2">
          <Upload className="h-4 w-4" /> Upload GSTR-2B JSON
          <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
        {error ? <p className="mt-2 text-red-600">{error}</p> : null}
      </div>

      {result ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="GST you can claim (as per 2B)" value={inr(result.summary.claimableAsPer2b)} />
            <Stat label="Matched" value={String(result.summary.matched)} />
            <Stat label="Need a look" value={String(result.summary.amountDiffers + result.summary.onlyIn2b + result.summary.onlyInBooks)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="input-field !w-auto" value={show} onChange={(e) => setShow(e.target.value as MatchStatus | "all")}>
              <option value="all">All ({result.rows.length})</option>
              {(Object.keys(STATUS) as MatchStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS[s].label} ({result.rows.filter((r) => r.status === s).length})</option>
              ))}
            </select>
            <button
              className="btn-outline inline-flex items-center gap-2 px-4 py-2 text-sm"
              onClick={() =>
                downloadCsv(`gstr2b-match-${result.period}.csv`, [
                  ["Result", "Supplier GSTIN", "Supplier", "Bill number", "Date", "Taxable (2B)", "GST (2B)", "Taxable (books)", "GST (books)", "Difference in GST"],
                  ...result.rows.map((r) => [
                    STATUS[r.status].label, r.doc?.ctin || r.purchase?.ctin || "", r.doc?.supplier || r.purchase?.supplier || "",
                    r.doc?.number || r.purchase?.number || "", r.doc?.date || r.purchase?.date || "",
                    r.doc?.txval ?? "", r.doc ? taxOf(r.doc) : "", r.purchase?.txval ?? "", r.purchase ? taxOf(r.purchase) : "", r.difference?.tax ?? "",
                  ]),
                ])
              }
            >
              <Download className="h-4 w-4" /> Download
            </button>
          </div>
          <div className="overflow-x-auto rounded-card border border-bone bg-white">
            <table className="w-full text-sm">
              <thead className="bg-mist text-left text-slate">
                <tr><th className="p-2">Result</th><th className="p-2">Supplier</th><th className="p-2">Bill</th><th className="p-2 text-right">GST in 2B</th><th className="p-2 text-right">GST in books</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-bone align-top">
                    <td className={`p-2 font-medium ${STATUS[r.status].tone}`} title={STATUS[r.status].help}>{STATUS[r.status].label}</td>
                    <td className="p-2">{r.doc?.supplier || r.purchase?.supplier || ""}<div className="text-xs text-ash">{r.doc?.ctin || r.purchase?.ctin}</div></td>
                    <td className="p-2">{r.doc?.number || r.purchase?.number}<div className="text-xs text-ash">{r.doc?.date || r.purchase?.date}</div></td>
                    <td className="p-2 text-right">{r.doc ? inr(taxOf(r.doc)) : "—"}</td>
                    <td className="p-2 text-right">{r.purchase ? inr(taxOf(r.purchase)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Gstr9Tab({ data }: { data: AppData }) {
  const thisFy = financialYear(todayIST());
  const choices = useMemo(() => {
    const start = Number(`20${thisFy.slice(0, 2)}`);
    return [0, 1, 2].map((k) => `${start - k}-${String((start - k + 1) % 100).padStart(2, "0")}`);
  }, [thisFy]);
  // GSTR-9 is filed for a finished year: open last year if it has bills, else this year.
  const [fy, setFy] = useState(() => {
    const hasBills = (y: string) => data.invoices.some((i) => i.status !== "draft" && financialYear(i.date) === y.slice(2));
    return choices.slice(1).find(hasBills) || choices[0];
  });
  const r = useMemo(() => buildGstr9(data, fy), [data, fy]);
  const row = (table: string, label: string, h: Heads, creditOnly = false) => (
    <tr key={table + label} className="border-t border-bone">
      <td className="p-2 font-mono text-xs text-ash">{table}</td>
      <td className="p-2">{label}</td>
      <td className="p-2 text-right">{creditOnly ? "—" : inr(h.txval)}</td>
      <td className="p-2 text-right">{inr(taxOf(h))}</td>
    </tr>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink">
          Year
          <select className="input-field !w-auto" value={fy} onChange={(e) => setFy(e.target.value)}>
            {choices.map((c) => <option key={c} value={c}>{c.replace("-", "–")} (April–March)</option>)}
          </select>
        </label>
        <button className="btn-outline inline-flex items-center gap-2 px-4 py-2 text-sm" onClick={() => downloadCsv(`gstr9-${fy}.csv`, gstr9Rows(r))}>
          <Download className="h-4 w-4" /> Download for your CA
        </button>
      </div>
      <p className="text-sm text-slate">Figures from your books, by GSTR-9 table. Compare them with the auto-filled GSTR-9 on the portal, then file there.</p>
      <p className="text-xs text-ash">GSTR-9 is optional when your turnover for the year is ₹2 crore or less (from 2024-25).</p>
      <div className="overflow-x-auto rounded-card border border-bone bg-white">
        <table className="w-full text-sm">
          <thead className="bg-mist text-left text-slate"><tr><th className="p-2">Table</th><th className="p-2">What it is</th><th className="p-2 text-right">Value</th><th className="p-2 text-right">GST</th></tr></thead>
          <tbody>
            {row("4A", "Sales to customers without GSTIN", r.table4.A)}
            {row("4B", "Sales to GST-registered customers", r.table4.B)}
            {row("4G", "Purchases where you paid GST (reverse charge)", r.table4.G)}
            {row("4I", "Credit notes (less)", r.table4.I)}
            {row("4J", "Debit notes", r.table4.J)}
            {row("4N", "Total on which GST is payable", r.table4.N)}
            {row("5C", "Nil-rated sales (0%)", r.table5.C)}
            {row("5D", "Exempt sales (bills of supply)", r.table5.D)}
            {row("5N", "Total with no GST", r.table5.N)}
            <tr className="border-t border-bone font-semibold"><td className="p-2 font-mono text-xs">5N</td><td className="p-2">Turnover for the year</td><td className="p-2 text-right">{inr(r.table5.turnover)}</td><td /></tr>
            {row("6B", "GST you claimed on purchases", r.table6.B)}
            {row("6C/6D", "GST claimed on reverse-charge purchases", { ...r.table6.C, igst: r.table6.C.igst + r.table6.D.igst, cgst: r.table6.C.cgst + r.table6.D.cgst, sgst: r.table6.C.sgst + r.table6.D.sgst, txval: r.table6.C.txval + r.table6.D.txval })}
            {row("8A", `GST as per GSTR-2B (${r.table8.monthsWith2b} of 12 months uploaded)`, r.table8.A, true)}
            {row("8D", "Difference: 2B minus what you claimed", r.table8.D, true)}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-slate">Item-wise (HSN) summaries for Tables 17 and 18 are in the download.</p>
      <ul className="list-disc space-y-1 pl-5 text-xs text-ash">{r.notes.map((n) => <li key={n}>{n}</li>)}</ul>
    </div>
  );
}

function ExemptTab({ data }: { data: AppData }) {
  const [month, setMonth] = useState(todayIST().slice(0, 7));
  const r = useMemo(() => {
    const { from, to } = monthRange(month);
    return exemptReport(data, from, to);
  }, [data, month]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink">
          Month
          <input type="month" className="input-field !w-auto" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        </label>
        <button
          className="btn-outline inline-flex items-center gap-2 px-4 py-2 text-sm"
          onClick={() => downloadCsv(`exempt-sales-${month}.csv`, [["Bill", "Date", "Customer", "Item", "HSN", "Type", "Value"], ...r.lines.map((l) => [l.number, l.date, l.party, l.item, l.hsn, l.kind === "exempt" ? "Exempt" : "Nil-rated", l.value])])}
        >
          <Download className="h-4 w-4" /> Download
        </button>
      </div>
      <p className="text-sm text-slate">Sales with no GST, as reported in GSTR-1 Table 8 and GSTR-3B 3.1(c).</p>
      <div className="overflow-x-auto rounded-card border border-bone bg-white">
        <table className="w-full text-sm">
          <thead className="bg-mist text-left text-slate"><tr><th className="p-2">Supply</th><th className="p-2">Type</th><th className="p-2 text-right">Value</th></tr></thead>
          <tbody>
            {r.rows.map((x) => (
              <tr key={x.supply + x.kind} className="border-t border-bone"><td className="p-2">{x.supply}</td><td className="p-2">{x.kind === "exempt" ? "Exempt (bill of supply)" : "Nil-rated (0%)"}</td><td className="p-2 text-right">{inr(x.value)}</td></tr>
            ))}
            <tr className="border-t border-bone font-semibold"><td className="p-2" colSpan={2}>Total</td><td className="p-2 text-right">{inr(r.total)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExceptionsTab({ data }: { data: AppData }) {
  const items = useMemo(() => exceptionReport(data), [data]);
  if (!items.length) return <p className="rounded-card border border-bone bg-white p-4 text-sm text-ink">Nothing needs attention. Stock, cash, dues and books all look right.</p>;
  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g} className="rounded-card border border-bone bg-white p-4">
          <h3 className="mb-2 font-semibold text-ink">{g}</h3>
          <ul className="space-y-2">
            {items.filter((i) => i.group === g).map((i) => (
              <li key={i.title} className="text-sm">
                <span className={i.severity === "error" ? "font-medium text-red-700" : "font-medium text-amber-700"}>{i.title}</span>
                <div className="text-slate">{i.detail}</div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-bone bg-white p-4">
      <div className="text-xs text-slate">{label}</div>
      <div className="text-xl font-semibold text-ink">{value}</div>
    </div>
  );
}

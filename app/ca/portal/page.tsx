"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-provider";
import { AuthModal } from "@/components/AuthModal";
import { BrandLogo } from "@/components/BrandLogo";
import { generateGSTRReport, generateGstnJson, formatCurrency } from "@/lib/gst";
import { t } from "@/lib/i18n";
import type { GSTRReport, GSTRReportType, Invoice, Purchase } from "@/lib/types";
import {
  decryptBooksPayload,
  loadCaShareKey,
  readKeyFromLocationHash,
  storeCaShareKey,
} from "@/lib/ca-crypto";

type Client = { owner_id: string; business_name?: string; gstin?: string };
type BusinessProfile = {
  name?: string;
  gstin?: string;
  pan?: string;
  email?: string;
  phone?: string;
  address?: string;
  state?: string;
  bankName?: string;
  upiId?: string;
};
type CaReport = {
  sales_total?: number;
  sales_tax?: number;
  purchases_total?: number;
  purchase_tax?: number;
  expenses_total?: number;
  gst_payable_estimate?: number;
  outstanding_invoices?: number;
  khata_net?: number;
  invoice_count?: number;
  purchase_count?: number;
  expense_count?: number;
  party_count?: number;
  low_stock_items?: number;
  inventory_skus?: number;
};
type Books = {
  business_profile?: BusinessProfile;
  report?: CaReport;
  invoices?: Array<Record<string, unknown>>;
  purchases?: Array<Record<string, unknown>>;
  expenses?: Array<Record<string, unknown>>;
  khata?: Array<Record<string, unknown>>;
  creditNotes?: Array<Record<string, unknown>>;
  party_outstanding?: number;
};

type Tab = "overview" | "invoices" | "purchases" | "expenses" | "khata" | "gst";

function tabLabel(tab: Tab) {
  const keys: Record<Tab, string> = {
    overview: "caOverview",
    invoices: "caInvoices",
    purchases: "caPurchases",
    expenses: "caExpenses",
    khata: "caKhata",
    gst: "caGst",
  };
  return t(keys[tab]);
}

const GST_TYPES: { value: GSTRReportType; label: string }[] = [
  { value: "gstr1", label: "GSTR-1 (Outward supplies)" },
  { value: "gstr2b", label: "GSTR-2 / GSTR-2B (ITC)" },
  { value: "gstr3b", label: "GSTR-3 / GSTR-3B (Summary)" },
];

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fyStart(d = new Date()) {
  const year = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${year}-04-01`;
}

function lastFyRange() {
  const start = fyStart();
  const year = Number(start.slice(0, 4)) - 1;
  return { from: `${year}-04-01`, to: `${Number(start.slice(0, 4))}-03-31` };
}

function monthRange(offset = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  const from = isoDate(d);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from, to: isoDate(end) };
}

function rowDate(row: Record<string, unknown>): string {
  return String(row.date || row.createdAt || row.created_at || row.dueDate || "").slice(0, 10);
}

function inRange(row: Record<string, unknown>, from: string, to: string) {
  const d = rowDate(row);
  if (!d) return true;
  return d >= from && d <= to;
}

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function coerceInvoice(row: Record<string, unknown>): Invoice {
  const date = rowDate(row);
  const grandTotal = num(row.grandTotal ?? row.total_amount);
  const totalTax = num(row.totalTax ?? row.total_gst_amount);
  const totalTaxable = num(row.totalTaxable ?? row.taxable_value) || Math.max(0, grandTotal - totalTax);
  return {
    id: String(row.id || ""),
    invoiceNumber: String(row.invoiceNumber || row.invoice_number || ""),
    type: (row.type as Invoice["type"]) || "tax_invoice",
    status: (row.status as Invoice["status"]) || "paid",
    businessId: String(row.businessId || ""),
    partyId: String(row.partyId || row.customer_id || ""),
    partyName: String(row.partyName || row.customer_name || ""),
    partyGstin: String(row.partyGstin || row.gstin || ""),
    partyPhone: String(row.partyPhone || ""),
    date,
    dueDate: String(row.dueDate || date),
    items: Array.isArray(row.items) ? (row.items as Invoice["items"]) : [],
    subtotal: num(row.subtotal) || totalTaxable,
    totalDiscount: num(row.totalDiscount),
    totalTaxable,
    totalCgst: num(row.totalCgst ?? row.cgst),
    totalSgst: num(row.totalSgst ?? row.sgst),
    totalIgst: num(row.totalIgst ?? row.igst),
    totalTax,
    roundOff: num(row.roundOff),
    grandTotal,
    paidAmount: num(row.paidAmount),
    balanceDue: num(row.balanceDue),
    paymentMode: String(row.paymentMode || ""),
    notes: "",
    terms: "",
    placeOfSupply: String(row.placeOfSupply || ""),
    isInterState: Boolean(row.isInterState) || num(row.totalIgst ?? row.igst) > 0,
    isTotalMode: false,
    createdAt: String(row.createdAt || date),
    updatedAt: String(row.updatedAt || date),
  };
}

function coercePurchase(row: Record<string, unknown>): Purchase {
  return {
    id: String(row.id || ""),
    purchaseNumber: String(row.purchaseNumber || row.purchase_number || ""),
    supplierName: String(row.supplierName || row.supplier_name || row.partyName || ""),
    supplierId: String(row.supplierId || row.supplier_id || ""),
    supplierGstin: String(row.supplierGstin || row.supplier_gstin || row.gstin || ""),
    createdAt: String(row.createdAt || row.created_at || row.date || ""),
    totalAmount: num(row.totalAmount ?? row.total_amount ?? row.grandTotal),
    totalGstAmount: num(row.totalGstAmount ?? row.total_gst_amount ?? row.totalTax),
    items: Array.isArray(row.items) ? (row.items as Purchase["items"]) : [],
    paymentMethod: String(row.paymentMethod || row.paymentMode || ""),
    paidAmount: num(row.paidAmount),
  };
}

function reportToCsv(report: GSTRReport) {
  const lines = [
    `Report,${report.type.toUpperCase()}`,
    `Period,${report.period}`,
    `From,${report.fromDate}`,
    `To,${report.toDate}`,
    `Documents,${report.totalInvoices}`,
    `Taxable,${report.totalTaxableValue}`,
    `CGST,${report.totalCgst}`,
    `SGST,${report.totalSgst}`,
    `IGST,${report.totalIgst}`,
    `Tax,${report.totalTax}`,
    `Value,${report.totalInvoiceValue}`,
  ];
  for (const section of report.sections) {
    lines.push("");
    lines.push(`${section.section},${section.description}`);
    lines.push("Number,Party,Taxable,CGST,SGST,IGST,Tax,Value");
    for (const inv of section.invoices) {
      lines.push(
        [
          inv.invoiceNumber,
          `"${String(inv.partyName || "").replace(/"/g, '""')}"`,
          inv.totalTaxable,
          inv.totalCgst,
          inv.totalSgst,
          inv.totalIgst,
          inv.totalTax,
          inv.grandTotal,
        ].join(",")
      );
    }
  }
  return lines.join("\n");
}

function downloadText(filename: string, content: string, mime = "text/csv") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CaPortalPage() {
  const { user, token, authReady, setShowAuthModal } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [books, setBooks] = useState<Books | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState("");
  const [from, setFrom] = useState(fyStart);
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [gstType, setGstType] = useState<GSTRReportType>("gstr1");
  const [showCalendar, setShowCalendar] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch("/api/ca/clients", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        const list = (d.clients || []) as Client[];
        setClients(list);
        const q = new URLSearchParams(window.location.search).get("owner");
        setOwnerId(q || list[0]?.owner_id || "");
      })
      .catch((e) => setError(String(e)));
  }, [token]);

  useEffect(() => {
    if (!token || !ownerId) return;
    setBooks(null);
    setError("");
    const hashKey = readKeyFromLocationHash();
    if (hashKey) storeCaShareKey(ownerId, hashKey);

    fetch(`/api/ca/clients/${encodeURIComponent(ownerId)}/books?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Could not load books");
        if (d.e2ee && d.ciphertext && d.iv) {
          const key = loadCaShareKey(ownerId) || hashKey;
          if (!key) {
            throw new Error(
              "This share is encrypted. Open the original invite link (it includes the decryption key), or ask the owner to resend it.",
            );
          }
          const plain = (await decryptBooksPayload(d.ciphertext, d.iv, key)) as Books;
          setBooks({
            ...plain,
            business_profile: plain.business_profile || d.business_profile,
          });
          return;
        }
        setBooks(d);
      })
      .catch((e) => setError(e.message));
  }, [token, ownerId, from, to]);

  const filtered = useMemo(() => {
    const invoices = (books?.invoices || []).filter((row) => inRange(row, from, to));
    const purchases = (books?.purchases || []).filter((row) => inRange(row, from, to));
    const expenses = (books?.expenses || []).filter((row) => inRange(row, from, to));
    const khata = (books?.khata || []).filter((row) => inRange(row, from, to));
    return { invoices, purchases, expenses, khata };
  }, [books, from, to]);

  const gstReport = useMemo(() => {
    if (!books) return null;
    const invoices = filtered.invoices.map(coerceInvoice);
    const notes = (books.creditNotes || [])
      .filter((row) => inRange(row, from, to))
      .map((row) => ({ ...coerceInvoice(row), type: "credit_note" as const }));
    const purchases = filtered.purchases.map(coercePurchase);
    return generateGSTRReport([...invoices, ...notes], gstType, from, to, purchases);
  }, [books, filtered, from, to, gstType]);

  const gstCsv = useMemo(() => (gstReport ? reportToCsv(gstReport) : ""), [gstReport]);

  const tableRows =
    tab === "invoices"
      ? filtered.invoices
      : tab === "purchases"
        ? filtered.purchases
        : tab === "expenses"
          ? filtered.expenses
          : filtered.khata;

  function applyPreset(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    setShowCalendar(true);
  }

  if (!authReady) return <div className="p-10 text-center text-slate">Loading…</div>;
  if (!user) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold">CA portal</h1>
        <p className="mb-4 text-sm text-slate">
          If Google sign-in is blocked in this browser, use email and password instead.
        </p>
        <button className="btn-primary" onClick={() => setShowAuthModal(true)}>
          Sign in
        </button>
        <AuthModal />
      </main>
    );
  }

  const lastFy = lastFyRange();
  const thisMonth = monthRange(0);
  const lastMonth = monthRange(-1);
  const yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);

  return (
    <main className="min-h-screen bg-mist">
      <header className="border-b border-bone bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandLogo href="/" size={32} />
            <div>
              <p className="text-xs uppercase tracking-wide text-slate">{t("caPlaintext")}</p>
              <h1 className="text-xl font-bold text-ink">CA client dashboard</h1>
            </div>
          </div>
          <a href="/app/" className="text-sm text-slate hover:text-ink">
            Owner billing app →
          </a>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[240px_1fr]">
        <aside className="rounded-card border border-bone bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Linked businesses</h2>
          {clients.length === 0 ? (
            <p className="text-sm text-slate">No clients yet. Redeem an invite link from the owner.</p>
          ) : (
            <ul className="space-y-1">
              {clients.map((c) => (
                <li key={c.owner_id}>
                  <button
                    className={`w-full rounded-full px-3 py-2 text-left text-sm ${
                      ownerId === c.owner_id ? "bg-brand-violet text-white" : "hover:bg-plaster"
                    }`}
                    onClick={() => setOwnerId(c.owner_id)}
                  >
                    {c.business_name || c.owner_id}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className="rounded-card border border-bone bg-white p-4">
          {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

          <div className="mb-4 rounded-card border border-bone bg-mist p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate">Date range</p>
              <button
                type="button"
                className="text-xs font-semibold text-brand-violet"
                onClick={() => setShowCalendar((v) => !v)}
              >
                {showCalendar ? "Hide calendar" : "Open calendar"}
              </button>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Preset label="This month" onClick={() => applyPreset(thisMonth.from, thisMonth.to)} active={from === thisMonth.from && to === thisMonth.to} />
              <Preset label="Last month" onClick={() => applyPreset(lastMonth.from, lastMonth.to)} active={from === lastMonth.from && to === lastMonth.to} />
              <Preset label="This FY" onClick={() => applyPreset(fyStart(), isoDate(new Date()))} active={from === fyStart()} />
              <Preset label="Last FY" onClick={() => applyPreset(lastFy.from, lastFy.to)} active={from === lastFy.from && to === lastFy.to} />
              <Preset label="Last 12 months" onClick={() => applyPreset(isoDate(yearAgo), isoDate(new Date()))} />
              <Preset label="All time" onClick={() => applyPreset("2000-01-01", isoDate(new Date()))} />
            </div>
            {showCalendar ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm text-ink">
                  From
                  <input
                    type="date"
                    value={from}
                    max={to}
                    onChange={(e) => setFrom(e.target.value || from)}
                    className="mt-1 w-full rounded-card border border-bone bg-white px-3 py-2"
                  />
                </label>
                <label className="block text-sm text-ink">
                  To
                  <input
                    type="date"
                    value={to}
                    min={from}
                    onChange={(e) => setTo(e.target.value || to)}
                    className="mt-1 w-full rounded-card border border-bone bg-white px-3 py-2"
                  />
                </label>
              </div>
            ) : null}
            <p className="mt-2 text-xs text-slate">
              Showing {from} to {to}. Previous months are included when you widen the range.
            </p>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {(["overview", "invoices", "purchases", "expenses", "khata", "gst"] as const).map((t) => (
              <button
                key={t}
                className={`rounded-full px-4 py-1.5 text-sm ${tab === t ? "bg-brand-violet text-white" : "bg-plaster"}`}
                onClick={() => setTab(t)}
              >
                {tabLabel(t)}
              </button>
            ))}
          </div>
          {!books ? (
            <p className="text-slate">Select a client to load books.</p>
          ) : tab === "overview" ? (
            <OverviewPanel books={books} client={clients.find((c) => c.owner_id === ownerId)} from={from} to={to} />
          ) : tab === "gst" ? (
            <div>
              <p className="mb-3 text-sm text-slate">
                GST pack for this owner across the selected dates: GSTR-1, GSTR-2 / 2B, and GSTR-3 / 3B.
              </p>
              <div className="mb-4 flex flex-wrap gap-2">
                {GST_TYPES.map((g) => (
                  <button
                    key={g.value}
                    className={`rounded-full px-4 py-1.5 text-sm ${gstType === g.value ? "bg-ink text-white" : "bg-plaster"}`}
                    onClick={() => setGstType(g.value)}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              {gstReport ? (
                <>
                  <div className="mb-4 grid gap-3 sm:grid-cols-4">
                    <Stat label="Documents" value={String(gstReport.totalInvoices)} />
                    <Stat label="Taxable" value={formatCurrency(gstReport.totalTaxableValue)} />
                    <Stat label="Tax" value={formatCurrency(gstReport.totalTax)} />
                    <Stat label="Value" value={formatCurrency(gstReport.totalInvoiceValue)} />
                  </div>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      className="btn-outline"
                      onClick={() => downloadText(`${gstReport.type.toUpperCase()}_${from}_${to}.csv`, gstCsv)}
                    >
                      Download CSV
                    </button>
                    <button
                      className="btn-outline"
                      onClick={() => {
                        const invoices = filtered.invoices.map(coerceInvoice);
                        const notes = (books.creditNotes || [])
                          .filter((row) => inRange(row, from, to))
                          .map((row) => ({ ...coerceInvoice(row), type: "credit_note" as const }));
                        const purchases = filtered.purchases.map(coercePurchase);
                        const gstn = generateGstnJson(
                          [...invoices, ...notes],
                          gstType,
                          from,
                          to,
                          purchases,
                          clients.find((c) => c.owner_id === ownerId)?.gstin || ""
                        );
                        downloadText(
                          `${gstReport.type.toUpperCase()}_GSTN_${from}_${to}.json`,
                          JSON.stringify(gstn, null, 2),
                          "application/json"
                        );
                      }}
                    >
                      {t("downloadGstn")}
                    </button>
                  </div>
                  {gstReport.sections.map((section) => (
                    <div key={section.section} className="mb-4 rounded-card border border-bone p-3">
                      <p className="font-semibold text-ink">
                        {section.section} — {section.description}
                      </p>
                      <p className="text-xs text-slate">
                        {section.invoices.length} docs · Tax {formatCurrency(section.tax)} · Value{" "}
                        {formatCurrency(section.invoiceValue)}
                      </p>
                    </div>
                  ))}
                  <pre className="mt-2 max-h-80 overflow-auto rounded bg-mist p-3 text-xs">{gstCsv}</pre>
                </>
              ) : (
                <p className="text-slate">No GST data in this range.</p>
              )}
            </div>
          ) : (
            <Table rows={tableRows} />
          )}
        </section>
      </div>
    </main>
  );
}

function OverviewPanel({
  books,
  client,
  from,
  to,
}: {
  books: Books;
  client?: Client;
  from: string;
  to: string;
}) {
  const profile = books.business_profile || {};
  const report = books.report || {};
  return (
    <div className="space-y-4">
      <div className="rounded-card border border-bone bg-mist p-4">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate">Business profile</h3>
        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          <p><span className="text-slate">Name:</span> {profile.name || client?.business_name || "—"}</p>
          <p><span className="text-slate">GSTIN:</span> {profile.gstin || client?.gstin || "—"}</p>
          <p><span className="text-slate">PAN:</span> {profile.pan || "—"}</p>
          <p><span className="text-slate">Phone:</span> {profile.phone || "—"}</p>
          <p className="sm:col-span-2"><span className="text-slate">Address:</span> {profile.address || "—"}</p>
          {profile.bankName ? <p><span className="text-slate">Bank:</span> {profile.bankName}</p> : null}
          {profile.upiId ? <p><span className="text-slate">UPI:</span> {profile.upiId}</p> : null}
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate">
          Period report ({from} to {to})
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Sales" value={formatCurrency(report.sales_total || 0)} />
          <Stat label="Output GST" value={formatCurrency(report.sales_tax || 0)} />
          <Stat label="Purchases" value={formatCurrency(report.purchases_total || 0)} />
          <Stat label="Input GST (ITC)" value={formatCurrency(report.purchase_tax || 0)} />
          <Stat label="Expenses" value={formatCurrency(report.expenses_total || 0)} />
          <Stat label="GST payable (est.)" value={formatCurrency(report.gst_payable_estimate || 0)} />
          <Stat label="Outstanding" value={formatCurrency(report.outstanding_invoices || 0)} />
          <Stat label="Khata net" value={formatCurrency(report.khata_net || 0)} />
          <Stat label="Invoices" value={String(report.invoice_count || 0)} />
          <Stat label="Parties" value={String(report.party_count || 0)} />
          <Stat label="Low stock SKUs" value={String(report.low_stock_items || 0)} />
          <Stat label="Inventory SKUs" value={String(report.inventory_skus || 0)} />
        </div>
      </div>
    </div>
  );
}

function Preset({
  label,
  onClick,
  active,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs ${active ? "bg-ink text-white" : "bg-white text-ink"}`}
    >
      {label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-bone bg-white p-3">
      <p className="text-xs text-slate">{label}</p>
      <p className="text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

function Table({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (!rows.length) return <p className="text-slate">Nothing in this date range.</p>;
  const preferred = ["invoiceNumber", "purchaseNumber", "partyName", "customerName", "supplierName", "date", "createdAt", "grandTotal", "totalAmount", "amount", "description"];
  const keys = [
    ...preferred.filter((k) => k in rows[0]),
    ...Object.keys(rows[0]).filter((k) => !preferred.includes(k) && k !== "items").slice(0, 4),
  ].slice(0, 7);
  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-xs text-slate">{rows.length} records</p>
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {keys.map((k) => (
              <th key={k} className="border-b border-bone py-2 pr-3 font-semibold capitalize text-ink">
                {k.replace(/([A-Z])/g, " $1")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row.id || i)}>
              {keys.map((k) => (
                <td key={k} className="border-b border-bone py-2 pr-3 text-slate">
                  {typeof row[k] === "object" ? "—" : String(row[k] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

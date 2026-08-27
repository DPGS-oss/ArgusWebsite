"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-provider";
import { AuthModal } from "@/components/AuthModal";

type Client = { owner_id: string; business_name?: string; gstin?: string };
type Books = {
  invoices?: Array<Record<string, unknown>>;
  purchases?: Array<Record<string, unknown>>;
  expenses?: Array<Record<string, unknown>>;
  khata?: Array<Record<string, unknown>>;
  party_outstanding?: number;
};

function currentMonthYm() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function filenameFromDisposition(header: string | null, fallback: string) {
  const match = (header || "").match(/filename="([^"]+)"/i);
  return match?.[1] || fallback;
}

export default function CaPortalPage() {
  const { user, token, authReady, setShowAuthModal } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [books, setBooks] = useState<Books | null>(null);
  const [tab, setTab] = useState<"invoices" | "purchases" | "expenses" | "khata" | "gst">("invoices");
  const [error, setError] = useState("");
  const [month, setMonth] = useState(currentMonthYm);
  const [downloading, setDownloading] = useState<"" | "gstr1" | "tally" | "einvoice">("");

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
    fetch(`/api/ca/clients/${encodeURIComponent(ownerId)}/books`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Could not load books");
        setBooks(d);
      })
      .catch((e) => setError(e.message));
  }, [token, ownerId]);

  const gstCsv = useMemo(() => {
    const rows = books?.invoices || [];
    const header = "Invoice,Party,Value,Tax,Date";
    const lines = rows.map((inv) =>
      [
        inv.invoiceNumber || inv.invoice_number || "",
        inv.partyName || inv.customer_name || "",
        inv.grandTotal || inv.total_amount || 0,
        inv.totalTax || inv.total_gst_amount || 0,
        inv.date || inv.created_at || "",
      ].join(",")
    );
    return [header, ...lines].join("\n");
  }, [books]);

  async function downloadHandoff(kind: "gstr1" | "tally" | "einvoice") {
    if (!token || !ownerId) return;
    setDownloading(kind);
    setError("");
    try {
      const path = kind === "gstr1" ? "gstr1" : kind === "tally" ? "tally" : "einvoice";
      const r = await fetch(
        `/api/ca/clients/${encodeURIComponent(ownerId)}/${path}?month=${encodeURIComponent(month)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error || `Download failed (${r.status})`);
      }
      const blob = await r.blob();
      const fallback =
        kind === "gstr1" ? `GSTR1_${month}.json` : kind === "tally" ? `Tally_${month}.xml` : `EInvoice_${month}.json`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filenameFromDisposition(r.headers.get("Content-Disposition"), fallback);
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDownloading("");
    }
  }

  if (!authReady) return <div className="p-10 text-center text-slate">Loading…</div>;
  if (!user) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold">CA portal</h1>
        <button className="btn-primary" onClick={() => setShowAuthModal(true)}>
          Sign in
        </button>
        <AuthModal />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-mist">
      <header className="border-b border-bone bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate">Read-only CA portal</p>
            <h1 className="text-xl font-bold text-ink">Client books</h1>
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
          <div className="mb-4 flex flex-wrap gap-2">
            {(["invoices", "purchases", "expenses", "khata", "gst"] as const).map((t) => (
              <button
                key={t}
                className={`rounded-full px-4 py-1.5 text-sm ${tab === t ? "bg-brand-violet text-white" : "bg-plaster"}`}
                onClick={() => setTab(t)}
              >
                {t === "gst" ? "GST pack" : t}
              </button>
            ))}
          </div>
          {!books ? (
            <p className="text-slate">Select a client to load books.</p>
          ) : tab === "gst" ? (
            <div>
              <p className="mb-3 text-sm text-slate">
                Download GSTN offline-tool JSON, TallyPrime XML, and NIC e-invoice JSON for this month,
                generated from the owner’s invoices in the cloud (works if the shop phone is offline).
                Argus does not file GSTR, mint IRNs, or push to Tally.
              </p>
              <label className="mb-4 flex items-center gap-2 text-sm text-ink">
                Month
                <input
                  type="month"
                  className="rounded-full border border-bone bg-white px-3 py-1.5"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </label>
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  className="btn-primary"
                  disabled={!ownerId || downloading === "gstr1"}
                  onClick={() => downloadHandoff("gstr1")}
                >
                  {downloading === "gstr1" ? "Preparing…" : "Download GSTR-1 JSON (this month)"}
                </button>
                <button
                  className="btn-outline"
                  disabled={!ownerId || downloading === "tally"}
                  onClick={() => downloadHandoff("tally")}
                >
                  {downloading === "tally" ? "Preparing…" : "Download Tally XML (this month)"}
                </button>
                <button
                  className="btn-outline"
                  disabled={!ownerId || downloading === "einvoice"}
                  onClick={() => downloadHandoff("einvoice")}
                >
                  {downloading === "einvoice" ? "Preparing…" : "Download e-invoice JSON"}
                </button>
              </div>
              <p className="mb-2 text-xs text-slate">Optional spreadsheet of all invoices (not GSTN JSON):</p>
              <button
                className="btn-outline"
                onClick={() => {
                  const blob = new Blob([gstCsv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `GSTR1_${ownerId}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download GSTR-1 CSV
              </button>
              <pre className="mt-4 max-h-80 overflow-auto rounded bg-mist p-3 text-xs">{gstCsv}</pre>
            </div>
          ) : (
            <Table
              rows={
                (tab === "invoices"
                  ? books.invoices
                  : tab === "purchases"
                    ? books.purchases
                    : tab === "expenses"
                      ? books.expenses
                      : books.khata) || []
              }
            />
          )}
        </section>
      </div>
    </main>
  );
}

function Table({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (!rows.length) return <p className="text-slate">Nothing here.</p>;
  const keys = Object.keys(rows[0]).slice(0, 6);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {keys.map((k) => (
              <th key={k} className="border-b border-bone py-2 pr-3 font-semibold text-ink">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((row, i) => (
            <tr key={i}>
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

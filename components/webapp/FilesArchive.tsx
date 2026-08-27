"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-provider";

type FileRow = {
  id: string;
  invoiceNumber?: string;
  name: string;
  createdAt?: string;
  mime?: string;
  size?: number;
  dataB64?: string;
};

export function FilesArchive() {
  const { token } = useAuth();
  const [rows, setRows] = useState<FileRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch("/api/files", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((body) => setRows(body.files || []))
      .catch(() => setError("Could not load files from cloud."));
  }, [token]);

  function download(row: FileRow) {
    if (!row.dataB64) return;
    const mime = row.mime || "application/pdf";
    const a = document.createElement("a");
    a.href = `data:${mime};base64,${row.dataB64}`;
    a.download = row.name || "invoice.pdf";
    a.click();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-ink">Saved files</h2>
        <p className="text-sm text-slate">Invoice PDFs synced from the phone and this browser via Firestore.</p>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {rows.length === 0 ? (
        <p className="text-slate">No archived files yet. Save &amp; share an invoice on the phone with sync on.</p>
      ) : (
        <ul className="divide-y divide-bone rounded-card border border-bone bg-white">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium text-ink">{row.name}</p>
                <p className="text-xs text-slate">{row.invoiceNumber} · {String(row.createdAt || "").slice(0, 10)}</p>
              </div>
              {row.dataB64 ? (
                <button className="text-sm text-brand-violet" onClick={() => download(row)}>
                  Download
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

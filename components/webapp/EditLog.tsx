"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import type { AppData } from "@/lib/types";
import type { AuditEntity } from "@/lib/audit";
import { downloadCsv } from "@/lib/gst-returns";
import { istDate } from "@/lib/dates";

const ENTITY: Record<AuditEntity, string> = {
  bill: "Bills", credit_note: "Credit notes", debit_note: "Debit notes", payment: "Payments", purchase: "Purchases",
  expense: "Expenses", stock: "Stock", customer: "Customers", business: "Business", settings: "Settings", user: "Users",
};
const ACTION: Record<string, string> = { created: "Added", edited: "Changed", cancelled: "Cancelled", deleted: "Deleted", recorded: "Recorded" };

function when(at: string) {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? at : d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
}

/** Read-only list of every change, newest first. Nothing here can be edited or deleted. */
export function EditLog({ data }: { data: AppData }) {
  const [entity, setEntity] = useState<AuditEntity | "all">("all");
  const [q, setQ] = useState("");
  const entries = useMemo(() => {
    const term = q.trim().toLowerCase();
    return [...(data.auditLog || [])]
      .reverse()
      .filter((e) => entity === "all" || e.entity === entity)
      .filter((e) => !term || `${e.ref} ${e.detail} ${e.byName}`.toLowerCase().includes(term));
  }, [data.auditLog, entity, q]);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-ink">Edit log</h1>
      <p className="mb-4 text-sm text-slate">
        Every change to your books: who made it, when, from the app or the website, and what changed. It can&apos;t be edited or cleared, as GST and company law require.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className="input-field !w-auto" value={entity} onChange={(e) => setEntity(e.target.value as AuditEntity | "all")}>
          <option value="all">Everything</option>
          {(Object.keys(ENTITY) as AuditEntity[]).map((k) => <option key={k} value={k}>{ENTITY[k]}</option>)}
        </select>
        <input className="input-field !w-auto" placeholder="Search bill number, name…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button
          className="btn-outline inline-flex items-center gap-2 px-4 py-2 text-sm"
          onClick={() =>
            downloadCsv(`edit-log-${istDate()}.csv`, [
              ["When", "Who", "Where", "What", "Action", "Reference", "Details"],
              ...entries.map((e) => [when(e.at), e.byName, e.device === "android" ? "Phone app" : "Website", ENTITY[e.entity] || e.entity, ACTION[e.action] || e.action, e.ref, e.detail]),
            ])
          }
        >
          <Download className="h-4 w-4" /> Download
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="rounded-card border border-bone bg-white p-4 text-sm text-slate">No changes recorded yet.</p>
      ) : (
        <ul className="divide-y divide-bone rounded-card border border-bone bg-white">
          {entries.slice(0, 500).map((e) => (
            <li key={e.id} className="p-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-ink">{ACTION[e.action] || e.action} · {e.ref || ENTITY[e.entity]}</span>
                <span className="text-xs text-ash">{when(e.at)} · {e.byName} · {e.device === "android" ? "Phone app" : "Website"}</span>
              </div>
              {e.detail ? <div className="mt-1 text-slate">{e.detail}</div> : null}
            </li>
          ))}
        </ul>
      )}
      {entries.length > 500 ? <p className="mt-2 text-xs text-ash">Showing the latest 500. Download for the full log.</p> : null}
    </div>
  );
}
